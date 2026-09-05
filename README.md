# 🚀 RecoverAI

> **An autonomous AI financial retention team that actively recovers failed SaaS payments using smart reasoning, dynamic Razorpay links, and live Voice AI.**

![RecoverAI](https://img.shields.io/badge/Status-Hackathon_Ready-emerald?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Next.js_|_Python_|_Supabase_|_Gemini-purple?style=for-the-badge)

## ⚠️ The Problem
Failed payments (involuntary churn) are a multi-billion dollar leak for SaaS and Enterprise companies. When a transaction drops due to network issues, card limits, or insufficient funds, companies typically send a generic *"Your payment failed"* email. 
Customers ignore these emails, their subscriptions cancel, and the revenue is lost forever.

## 💡 Our Solution
**RecoverAI** replaces dumb automated emails with an intelligent, autonomous agent that acts as your financial retention team. 
Instead of a one-size-fits-all approach, RecoverAI analyzes *why* a payment failed and executes a highly personalized recovery strategy in real-time to save the revenue.

---

## ✨ Core Features

### 🧠 Autonomous Reasoning Engine (Powered by Google Gemini)
A relentless Python background worker powered by **Gemini 3.5 Flash Lite** continuously monitors the Supabase database for failed payments. It analyzes the failure error code, the transaction amount, and the customer's lifetime value (LTV) to decide on the best recovery strategy.

### 💳 Dynamic Razorpay Recovery Links
The agent autonomously integrates with the Razorpay Python SDK to generate targeted payment links:
- **Full Recovery:** Standard links for transient network drops.
- **50% Upfront Partial Payment:** If the AI detects an "insufficient funds" error, it gracefully degrades the payment demand and generates a custom 50% partial payment link to ease the customer's burden and save the account.

### 📞 VIP Voice AI Dispatch (Powered by Vapi)
Emails aren't enough for massive enterprise failures. If a high-ticket transaction (e.g., ₹75,000+) fails, the AI flags the account as VIP. Through our Next.js dashboard, you can click **"Dispatch Voice AI"**, which instantly triggers a **live WebRTC voice call** using the **Vapi SDK**. The AI assistant (Sarah) is dynamically seeded with the exact context of the failure and speaks to the customer to resolve the issue on the spot.

### 🛡️ Graceful Agentic Escalation
We leverage Google GenAI's Automatic Function Calling (AFC). If the agent encounters a broken API or a Razorpay SDK `ServerError` while trying to generate a link, it doesn't just crash. The LLM catches the exception and autonomously decides to use the `escalate_to_human` tool to ping the Slack support channel instead, ensuring no VIP customer slips through the cracks.

### 📊 Real-Time Recovery Dashboard
A sleek, futuristic Next.js dashboard that visualizes:
- The total revenue currently "At Risk".
- The real-time "Recovered" revenue dial that ticks up the moment a Razorpay webhook confirms a successful payment.
- A live feed of the Agent's internal "Chain of Thought" reasoning for full transparency into *why* it made its decisions.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (App Router), React, TailwindCSS, Framer Motion, Recharts
- **Agent Backend:** Python, Google Gemini SDK (`gemini-3.5-flash-lite`), APScheduler
- **Database:** Supabase (PostgreSQL)
- **Payments:** Razorpay API (Python SDK + Checkout.js)
- **Voice AI:** Vapi Web SDK (`@vapi-ai/web`)

---

## ⚙️ How to Run Locally

### 1. Start the Frontend
```bash
npm install
npm run dev
```
Runs the Next.js dashboard on `http://localhost:3000`.

### 2. Start the Autonomous Python Agent
```bash
cd python-agent
# Activate your virtual environment
.\venv\Scripts\activate
# Start the background worker
python -m uvicorn main:app --port 8000
```
The Python agent will wake up and begin polling Supabase for failed transactions.

---

*Built with ❤️ for the Hackathon.*
