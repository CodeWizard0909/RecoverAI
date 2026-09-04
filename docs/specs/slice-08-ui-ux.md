# Slice 08: UI/UX Masterpiece (Design Spec)

## 1. Concept & Inspiration
We are aiming for a "Cinematic Dark Mode FinTech" aesthetic. Standard AI apps look boxy and flat. We want depth, fluid motion, and high data density without clutter.

**Key Visual Elements:**
- **Background:** Deep space/OLED black (`bg-zinc-950` or `#030712`).
- **Cards (Glassmorphism):** Instead of solid gray boxes, we use frosted glass: `bg-white/5 backdrop-blur-md border border-white/10`.
- **Accents:** 
  - Emerald/Neon Green (`#10B981`) for successful recovery / bargaining offers.
  - Rose/Crimson (`#F43F5E`) for high churn risk / failed payments.
  - Indigo/Cyan for the "AI Brain Processing" state.
- **Typography:** Inter or Geist fonts (already in Next.js), using varied weights (ExtraLight for massive numbers, SemiBold for labels) and tracking (`tracking-tight` for headers, `tracking-widest` for uppercase labels).

## 2. Micro-interactions (Framer Motion)
- **Staggered Entrance:** When the dashboard loads, the charts and transaction rows don't just appear—they slide up and fade in sequentially (`staggerChildren`).
- **Live Injection Pulse:** When a new webhook hits, the row highlights with a subtle green pulse before settling into the list.
- **Hover States:** Buttons and cards will slightly elevate (`hover:-translate-y-0.5`) and increase their shadow/border glow on hover.

## 3. Data Visualization (Recharts)
- A hero section at the top of the dashboard containing a glowing **AreaChart**.
- **Metrics:** "Total Revenue at Risk", "Revenue Recovered", and "Recovery Rate (%)".
- The chart will have a gradient fill (opacity fading down) to look incredibly modern.

## 4. Execution Plan (Core Loop)
1. **Dependencies:** `npm install framer-motion recharts lucide-react clsx tailwind-merge`
2. **Global CSS:** Add custom Aurora gradient classes to `globals.css` / `tailwind.config.ts`.
3. **Components:**
   - Enhance the main `page.tsx` with framer-motion layouts.
   - Build a sleek `<DashboardStats />` component using Recharts.
4. **Guardrails:** Run Next.js linting and typechecking.
5. **Commit.**
