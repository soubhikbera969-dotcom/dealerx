import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache rates for 1 hour
let cachedRates: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const now = Date.now();
    if (cachedRates && now - cachedRates.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify({ rates: cachedRates.rates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the free exchangerate.host API (no key needed)
    const resp = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=EUR,INR");
    
    if (resp.ok) {
      const data = await resp.json();
      if (data.success !== false && data.rates) {
        cachedRates = { rates: { USD: 1, EUR: data.rates.EUR, INR: data.rates.INR }, timestamp: now };
        return new Response(JSON.stringify({ rates: cachedRates.rates }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback: try open.er-api.com (completely free, no key)
    const fallbackResp = await fetch("https://open.er-api.com/v6/latest/USD");
    if (fallbackResp.ok) {
      const fallbackData = await fallbackResp.json();
      if (fallbackData.rates) {
        cachedRates = {
          rates: { USD: 1, EUR: fallbackData.rates.EUR, INR: fallbackData.rates.INR },
          timestamp: now,
        };
        return new Response(JSON.stringify({ rates: cachedRates.rates }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Hardcoded fallback if all APIs fail
    const fallbackRates = { USD: 1, EUR: 0.92, INR: 83.5 };
    return new Response(JSON.stringify({ rates: fallbackRates, fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Exchange rate error:", e);
    return new Response(JSON.stringify({ rates: { USD: 1, EUR: 0.92, INR: 83.5 }, fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
