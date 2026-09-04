"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  RefreshCw,
  Zap,
  BrainCircuit,
  Wallet
} from "lucide-react";

// Razorpay browser SDK type
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, any>) => {
      open: () => void;
      on: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

interface PaymentRow {
  id: string;
  razorpay_payment_id: string;
  amount: number;
  currency: string;
  failure_reason: string;
  status: string;
  customer_email: string | null;
  customer_phone: string | null;
  recovery_actions: Record<string, string>[];
}

export default function Dashboard() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [dispatchingVoice, setDispatchingVoice] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Stats
  const [totalAtRisk, setTotalAtRisk] = useState(0);
  const [actionsTaken, setActionsTaken] = useState(0);
  const [recoveredAmount, setRecoveredAmount] = useState(0);

  // Chart Data (Mock trend + live data)
  const [chartData, setChartData] = useState<{time: string, risk: number, recovered: number}[]>([]);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Inject Razorpay SDK script once on mount
  useEffect(() => {
    if (!document.getElementById('razorpay-sdk')) {
      const script = document.createElement('script');
      script.id = 'razorpay-sdk';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);


  const openRazorpayModal = async (payment: PaymentRow, isPartial: boolean) => {
    if (!window.Razorpay) {
      alert('Razorpay SDK failed to load. Are you online?');
      return;
    }

    setPayingId(payment.id);

    try {
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          amount: isPartial ? Math.round(payment.amount / 2) : payment.amount,
          currency: payment.currency || 'INR',
          isPartial
        })
      });

      if (!response.ok) throw new Error('Order creation failed');
      
      const orderData = await response.json();

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "RecoverAI Demo",
        description: isPartial ? "Partial Payment (50% OFF)" : "Full Outstanding Payment",
        order_id: orderData.orderId,
        prefill: {
          email: payment.customer_email || 'demo@example.com',
          contact: payment.customer_phone || '9999999999'
        },
        theme: {
          color: "#10b981" // emerald-500
        },
        handler: function () {
          // On successful payment, the Razorpay webhook handles DB updates.
          // We just re-fetch the data to update the UI instantly.
          fetchData();
        }
      };

      const rzp = new window.Razorpay(options);

      // ADD THIS BLOCK:
      rzp.on('modal.close', function () {
        // This fires whenever the modal is closed (by X, escape, or payment completion/cancellation)
        setPayingId(null);
      });

      rzp.on('payment.failed', function (response: any) {
        console.error("Payment failed", response.error);
        alert(response.error.description);
      });

      rzp.open();
    } catch (e) {
      console.error('Razorpay modal error:', e);
      setPayingId(null);
    }
  };

  const USE_REAL_DATA = true; // Set false to use mock data

  const fetchData = async () => {
    try {
      const endpoint = USE_REAL_DATA ? '/api/payments' : `/api/demo/fetch-data?t=${Date.now()}`;
      const response = await fetch(endpoint);
      
      if (response.ok) {
        const data = await response.json();
        
        // The real endpoint already calculates everything cleanly!
        setPayments(data.payments);
        setTotalAtRisk(data.totalAtRisk);
        setRecoveredAmount(data.recoveredAmount);
        setActionsTaken(data.actionsCount);
        setChartData(data.chartData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleInject = async () => {
    setInjecting(true);
    await fetch('/api/demo/inject', { method: 'POST' });
    await fetchData();
    setInjecting(false);
  };

  const handleTrigger = async () => {
    setTriggering(true);
    await fetch('/api/agent/process-batch', { method: 'POST' });
    setTimeout(async () => {
      await fetch('/api/agent/execute', { method: 'POST' });
      await fetchData();
      setTriggering(false);
    }, 2000);
  };

  const handleResetDemo = async () => {
    try {
      const response = await fetch('/api/demo/reset', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Reset failed');
      }
      await fetchData(); // Refresh UI with clean state
      alert('Demo state has been reset!');
    } catch (e) {
      console.error('Reset error:', e);
      alert('Failed to reset demo state. Check console for details.');
    }
  };

  const handleVoiceDispatch = async (paymentId: string) => {
    setDispatchingVoice(paymentId);
    // In a real app, this would hit /api/voice/dispatch which calls Bland AI.
    // We simulate the latency here for the demo.
    await new Promise(resolve => setTimeout(resolve, 3000));
    setDispatchingVoice(null);
    alert("Voice Agent Dispatched! The customer's phone is ringing.");
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);
  };

  // Animations
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen text-white pb-20 selection:bg-emerald-500/30">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-8 py-4 flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            RecoverAI <span className="font-light text-white/40">| Autonomous Agent</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-white/80 text-xs font-bold border border-white/20 shadow-lg">1</span>
            <button 
              onClick={handleInject}
              disabled={injecting}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {injecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-400" />}
              Simulate Failure
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-xs font-bold border border-emerald-500/30 shadow-lg">2</span>
            <button 
              onClick={handleTrigger}
              disabled={triggering}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-emerald-950 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 disabled:opacity-50"
            >
              {triggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              Analyze & Plan
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-gray-600/20 rounded-full flex items-center justify-center text-gray-400 text-xs font-bold border border-gray-500/30 shadow-lg">3</span>
            <button 
              onClick={handleResetDemo}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gray-500 hover:bg-gray-600 text-gray-100 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reset Demo
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8">
        
        {/* Top Stats & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          
          {/* Stats Column - Bento Grid */}
          <motion.div 
            variants={containerVariants} initial="hidden" animate="show"
            className="col-span-1 flex flex-col gap-4"
          >
            {/* Bento Box 1: Revenue at Risk */}
            <motion.div variants={itemVariants} className="glass-panel p-6 rounded-3xl relative overflow-hidden group flex flex-col justify-between min-h-[180px]">
              <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <AlertCircle className="w-32 h-32 text-rose-500" />
              </div>
              <div className="flex justify-between items-start relative z-10">
                <p className="text-xs font-semibold text-white/50 tracking-widest uppercase">Revenue at Risk</p>
                <div className="text-[10px] font-bold tracking-wider text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md border border-rose-500/20 uppercase">Action Required</div>
              </div>
              <div className="relative z-10 mt-6">
                <h2 className="text-4xl font-light tracking-tight">{formatCurrency(totalAtRisk)}</h2>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-16 w-full opacity-40 z-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <Area type="monotone" dataKey="risk" stroke="#f43f5e" strokeWidth={2} fillOpacity={0.15} fill="#f43f5e" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Bento Box 2: Recovered */}
            <motion.div variants={itemVariants} className="glass-panel p-6 rounded-3xl relative overflow-hidden group aurora-gradient flex flex-col justify-between min-h-[180px]">
              <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Wallet className="w-32 h-32 text-emerald-500" />
              </div>
              <div className="flex justify-between items-start relative z-10">
                <p className="text-xs font-semibold text-emerald-500/80 tracking-widest uppercase">AI Recovered</p>
                <div className="text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 uppercase">{actionsTaken} Actions</div>
              </div>
              <div className="relative z-10 mt-6">
                <h2 className="text-4xl font-light tracking-tight text-glow">{formatCurrency(recoveredAmount)}</h2>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-16 w-full opacity-60 z-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <Area type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={2} fillOpacity={0.15} fill="#10b981" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </motion.div>

          {/* Chart Column */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="col-span-1 lg:col-span-2 glass-panel rounded-3xl p-6 flex flex-col min-h-[180px]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold tracking-tight">Recovery Performance</h3>
              <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div> Risk</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div> Recovered</div>
              </div>
            </div>
            <div className="flex-1 w-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#ffffff20" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff20" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff20', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                    itemStyle={{ fontSize: '13px' }}
                    labelStyle={{ color: '#ffffff60', fontSize: '12px', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="risk" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" />
                  <Area type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Transaction Queue */}
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Active Interventions</h3>
            <p className="text-sm text-white/50 mt-1">Live feed of webhook failures and AI recovery strategies.</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-1 rounded">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {loading && <RefreshCw className="w-5 h-5 animate-spin text-white/30" />}
          </div>
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden border border-white/10">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-widest">
            <div className="col-span-3">Customer & Amount</div>
            <div className="col-span-3">Failure Reason</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-4">AI Agent Strategy (Gemini)</div>
          </div>
          
          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {payments.length === 0 && !loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center text-white/40 space-y-4">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>All revenue recovered.</p>
                  <p className="text-sm">Click "① Simulate Failure" above to generate a test case and watch the AI agent work.</p>
                </motion.div>
              )}
              
              {payments.map((p) => {
                const isRecovered = p.status === 'recovered';
                
                return (
                  <motion.div 
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(16, 185, 129, 0)' }}
                    animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(16, 185, 129, 0)' }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="grid grid-cols-12 gap-4 p-4 items-start hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="col-span-3">
                      <div className="font-medium text-[15px]">{p.customer_email || 'Unknown User'}</div>
                      <div className="text-xl font-light mt-1 tracking-tight">{formatCurrency(p.amount)}</div>
                      <div className="text-[11px] font-mono text-white/30 mt-1">{p.razorpay_payment_id}</div>
                    </div>
                    
                    <div className="col-span-3">
                      <span className="inline-block px-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs font-medium text-white/80">
                        {p.failure_reason}
                      </span>
                    </div>
                    
                    <div className="col-span-2">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border break-words text-center ${
                        isRecovered 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    
                    <div className="col-span-4">
                      {!p.recovery_actions || p.recovery_actions.length === 0 ? (
                        <div className="flex items-center gap-2 text-white/30 text-sm">
                          <div className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
                          Waiting for Brain...
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {/* Only show the latest (most recent) action — no duplicates */}
                          {[p.recovery_actions[p.recovery_actions.length - 1]].map((action: Record<string, string>) => {
                            const reasoning = action.gemini_reasoning || '';
                            const linkMatch = reasoning.match(/\| LINK: (https:\/\/[^\s|]+)/);
                            const link = linkMatch ? linkMatch[1] : null;
                            const partialLinkMatch = reasoning.match(/\| PARTIAL_LINK: (https:\/\/[^\s|]+)/);
                            const partialLink = partialLinkMatch ? partialLinkMatch[1] : null;
                            
                            const rationale = reasoning
                              .replace(/\| LINK: https:\/\/[^\s|]+/g, '')
                              .replace(/\| PARTIAL_LINK: https:\/\/[^\s|]+/g, '')
                              .trim();

                            return (
                              <div key={action.id} className="pl-5 py-3 pr-3 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden">
                                {action.status === 'executed' && (
                                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
                                )}
                                
                                <div className="flex items-center flex-wrap gap-2 mb-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/90 uppercase tracking-wider font-mono">
                                    {action.type}
                                  </span>
                                  {link && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                      🔗 Link Generated
                                    </span>
                                  )}
                                  {partialLink && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      💰 50% Option
                                    </span>
                                  )}
                                  {action.type === 'escalate' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                      ⚠️ Escalated to Slack
                                    </span>
                                  )}
                                </div>
                                
                                <details className="mt-2 group">
                                  <summary className="w-full text-left px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-between cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                                    <span>View Details</span>
                                    <span className="ml-2">
                                      <svg 
                                        className="w-4 h-4 text-white/50 transition-transform duration-200 group-open:rotate-180" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2"
                                      >
                                        <path d="M6 9l6 6 6-6" />
                                      </svg>
                                    </span>
                                  </summary>
                                  
                                  <div className="mt-3 pl-4 border-l-2 border-white/10 space-y-3 pb-1 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    <p className="text-[13px] text-white/70 leading-relaxed italic">
                                      "{rationale}"
                                    </p>
                                    
                                    <div className="flex flex-wrap gap-2">
                                      {!isRecovered && link && (
                                        <button
                                          onClick={() => openRazorpayModal(p, false)}
                                          disabled={payingId === p.id}
                                          className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                          {payingId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                          Pay Full
                                        </button>
                                      )}
                                      {!isRecovered && partialLink && (
                                        <button
                                          onClick={() => openRazorpayModal(p, true)}
                                          disabled={payingId === p.id}
                                          className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                          {payingId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wallet className="w-3 h-3" />}
                                          Pay 50% Upfront
                                        </button>
                                      )}
                                      
                                      {/* Feature 3: Voice AI Dispatch Button (Only for High Risk) */}
                                      {!isRecovered && (partialLink || action.type === 'escalate') && (
                                        <button 
                                          onClick={() => handleVoiceDispatch(p.id)}
                                          disabled={dispatchingVoice === p.id}
                                          className="ml-auto px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                          {dispatchingVoice === p.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                                          Dispatch Voice AI
                                        </button>
                                      )}
                                    </div>
                                    
                                    {/* Full Reasoning (for transparency) */}
                                    <div className="mt-4 pt-3 border-t border-white/5">
                                      <p className="text-[10px] text-white/40 italic mb-1 font-semibold uppercase tracking-wider">Full Agent Trace:</p>
                                      <p className="text-[10px] text-white/50 break-words whitespace-pre-line font-mono">{reasoning}</p>
                                    </div>
                                  </div>
                                </details>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

      </main>
    </div>
  );
}
