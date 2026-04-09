import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function",
    function: {
      name: "add_contact",
      description: "Add a new contact to the CRM",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact full name" },
          email: { type: "string", description: "Email address" },
          phone: { type: "string", description: "Phone number" },
          company: { type: "string", description: "Company name" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_deal",
      description: "Create a new deal in the pipeline",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deal title" },
          value: { type: "number", description: "Deal value in dollars" },
          status: { type: "string", enum: ["lead", "in_progress", "completed", "payment_done"], description: "Deal status" },
          contact_name: { type: "string", description: "Name of the contact to link this deal to" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_data",
      description: "Query CRM data — contacts, deals, stats, pipeline info. Use this for ANY question about the user's data.",
      parameters: {
        type: "object",
        properties: {
          query_type: { type: "string", enum: ["contacts", "deals", "stats", "search"], description: "Type of data to query" },
          search_term: { type: "string", description: "Optional search term to filter results" },
          status_filter: { type: "string", enum: ["lead", "in_progress", "completed", "payment_done"], description: "Filter deals by status" },
        },
        required: ["query_type"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get workspace
    const { data: memberData } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) {
      return new Response(JSON.stringify({ error: "No workspace found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const workspaceId = memberData.workspace_id;

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // First AI call with tools
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a CRM assistant. You help users manage their contacts and deals by using the provided tools.
When a user wants to add a contact or deal, use the appropriate tool. When they ask questions about their data, use query_data.
Be concise and friendly. After performing actions, confirm what you did.
If the user provides multiple contacts or deals in one message, call the tool multiple times.`,
          },
          ...messages,
        ],
        tools,
        tool_choice: "auto",
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const txt = await aiResponse.text();
      console.error("AI error:", status, txt);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices[0];

    // If no tool calls, return the message directly
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      return new Response(JSON.stringify({ reply: choice.message.content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process tool calls
    const toolResults: { tool_call_id: string; role: string; content: string }[] = [];

    for (const toolCall of choice.message.tool_calls) {
      const fn = toolCall.function;
      const args = JSON.parse(fn.arguments);
      let result = "";

      if (fn.name === "add_contact") {
        const { error } = await supabase.from("contacts").insert({
          name: args.name,
          email: args.email || null,
          phone: args.phone || null,
          company: args.company || null,
          workspace_id: workspaceId,
        });
        result = error ? `Error adding contact: ${error.message}` : `Contact "${args.name}" added successfully.`;
      } else if (fn.name === "add_deal") {
        let contactId = null;
        if (args.contact_name) {
          const { data: contactData } = await supabase
            .from("contacts")
            .select("id")
            .eq("workspace_id", workspaceId)
            .ilike("name", `%${args.contact_name}%`)
            .limit(1)
            .single();
          contactId = contactData?.id || null;
        }
        const { error } = await supabase.from("deals").insert({
          title: args.title,
          value: args.value || null,
          status: args.status || "lead",
          contact_id: contactId,
          workspace_id: workspaceId,
        });
        result = error ? `Error creating deal: ${error.message}` : `Deal "${args.title}" created${args.value ? ` ($${args.value})` : ""}.`;
      } else if (fn.name === "query_data") {
        if (args.query_type === "contacts") {
          let query = supabase.from("contacts").select("*").eq("workspace_id", workspaceId);
          if (args.search_term) query = query.or(`name.ilike.%${args.search_term}%,email.ilike.%${args.search_term}%,company.ilike.%${args.search_term}%`);
          const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
          if (error) result = `Error: ${error.message}`;
          else if (!data?.length) result = "No contacts found.";
          else result = JSON.stringify(data.map(c => ({ name: c.name, email: c.email, phone: c.phone, company: c.company })));
        } else if (args.query_type === "deals") {
          let query = supabase.from("deals").select("*, contacts(name)").eq("workspace_id", workspaceId);
          if (args.status_filter) query = query.eq("status", args.status_filter);
          if (args.search_term) query = query.ilike("title", `%${args.search_term}%`);
          const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
          if (error) result = `Error: ${error.message}`;
          else if (!data?.length) result = "No deals found.";
          else result = JSON.stringify(data.map(d => ({ title: d.title, value: d.value, status: d.status, contact: (d.contacts as any)?.name })));
        } else if (args.query_type === "stats") {
          const [contactsRes, dealsRes] = await Promise.all([
            supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
            supabase.from("deals").select("*").eq("workspace_id", workspaceId),
          ]);
          const deals = dealsRes.data || [];
          const totalValue = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
          result = JSON.stringify({
            total_contacts: contactsRes.count || 0,
            total_deals: deals.length,
            leads: deals.filter(d => d.status === "lead").length,
            in_progress: deals.filter(d => d.status === "in_progress").length,
            completed: deals.filter(d => d.status === "completed").length,
            payment_done: deals.filter(d => d.status === "payment_done").length,
            total_deal_value: totalValue,
          });
        } else if (args.query_type === "search") {
          const term = args.search_term || "";
          const [contacts, deals] = await Promise.all([
            supabase.from("contacts").select("*").eq("workspace_id", workspaceId).or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`).limit(20),
            supabase.from("deals").select("*, contacts(name)").eq("workspace_id", workspaceId).ilike("title", `%${term}%`).limit(20),
          ]);
          result = JSON.stringify({ contacts: contacts.data, deals: deals.data });
        }
      }

      toolResults.push({ tool_call_id: toolCall.id, role: "tool", content: result });
    }

    // Second AI call with tool results
    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a CRM assistant. Present data clearly using markdown tables when showing lists. Be concise and helpful. After adding contacts/deals, confirm with details.`,
          },
          ...messages,
          choice.message,
          ...toolResults,
        ],
      }),
    });

    if (!finalResponse.ok) {
      const txt = await finalResponse.text();
      console.error("Final AI error:", txt);
      // Return tool results directly as fallback
      const fallback = toolResults.map(r => r.content).join("\n");
      return new Response(JSON.stringify({ reply: fallback }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const finalData = await finalResponse.json();
    const reply = finalData.choices[0].message.content;

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
