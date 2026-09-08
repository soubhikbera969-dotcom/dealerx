# Workspace CRM

🚀 ULTRA-DETAILED PROMPT — MULTI-TENANT BUSINESS CRM WEB APP

Prompt

Create a modern full-stack SaaS web application where businesses can create their own private workspace to manage leads, contacts, and deals.

The platform must support multiple companies (multi-tenant system) where each company has:

• its own workspace
• its own database (logically isolated)
• complete data privacy

No user should be able to access another company’s data.

🧠 1. CORE IDEA

Users enter:

👉 Business Name

System creates:

👉 A dedicated workspace for that business

This workspace stores:

• contacts
• deals
• lead status
• payment status

🎨 2. UI DESIGN SYSTEM

Theme

Modern SaaS dashboard (like startup tools)

Color Palette

Light Mode
Background: #F8FAFC
Primary: #3B82F6
Text: #111827

Dark Mode
Background: #0F172A
Primary: #60A5FA
Text: #E5E7EB

Accent
Purple Glow: #8B5CF6

UI Style

• clean dashboard
• glassmorphism cards
• minimal layout
• smooth animations
• sidebar navigation

🔐 3. AUTHENTICATION SYSTEM

Users must be able to:

Sign Up

Fields:

Name
Email
Password
Business Name

On signup:

👉 Create new workspace linked to business

Login

Users login and land inside:

👉 Their own workspace only

🏢 4. MULTI-TENANT SYSTEM (CRITICAL)

Each company must have:

• unique workspace ID
• isolated database records

Rules:

❌ No cross-company data access
❌ No shared contact lists
❌ No data leaks

Use:

• tenant-based database design
OR
• row-level security

🧾 5. DATA MODEL (IMPORTANT)

Each workspace stores:

Contacts Table

Contact Name
Email
Phone Number
Company Name

Deals Table

Linked Contact
Deal Status

Statuses:

• Lead
• In Progress
• Completed
• Payment Done

📊 6. DASHBOARD

Show:

• total leads
• completed deals
• pending payments
• recent contacts

Use:

• cards
• charts
• summary blocks

🧩 7. CONTACT MANAGEMENT

Users can:

• add contact
• edit contact
• delete contact
• search contact

🔄 8. DEAL PIPELINE

Create a simple pipeline view.

Columns:

Lead
In Progress
Completed
Payment Done

Allow:

• drag and drop deals
• status update

🌗 9. DARK / LIGHT MODE

User can toggle:

Light Mode
Dark Mode

UI must:

• smoothly transition
• change colors dynamically

💾 10. DATA PERSISTENCE

VERY IMPORTANT:

Even after:

• logout
• browser close
• system restart

👉 Data must NOT be lost

Use:

• database storage (not localStorage only)

🔒 11. SECURITY

• encrypted authentication
• secure API
• protected routes

⚡ 12. ANIMATIONS

Use subtle animations:

• page transitions
• hover effects
• card lift
• smooth loading states

📱 13. RESPONSIVENESS

Must be:

• mobile-friendly
• tablet optimized
• desktop dashboard

🧱 14. STRUCTURE

Pages:

Login
Signup
Dashboard
Contacts
Deals

🎯 FINAL GOAL

Build a secure, scalable CRM system where:

👉 each business has its own workspace
👉 data is private
👉 leads are managed easily

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dealerx.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e46a97e7-a2fc-4b80-a989-433fcf3a7b03).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
