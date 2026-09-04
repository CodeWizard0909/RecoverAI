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
  TrendingUp,
  BrainCircuit,
  Wallet
} from "lucide-react";

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

  // Stats
  const [totalAtRisk, setTotalAtRisk] = useState(0);
  const [actionsTaken, setActionsTaken] = useState(0);
  const [recoveredAmount, setRecoveredAmount] = useState(0);

  // Chart Data (Mock trend + live data)
  const [chartData, setChartData] = useState<{time: string, risk: number, recovered: number}[]>([]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/demo/fetch-data?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments);
        
        let risk = 0;
        let rec = 0;
        data.payments.forEach((p: PaymentRow) => {
          if (p.status !== 'recovered') risk += p.amount;
          if (p.status === 'recovered') rec += p.amount;
        });
        setTotalAtRisk(risk);
        setRecoveredAmount(rec);
        setActionsTaken(data.actionsCount);

        // Generate synthetic chart data leading up to current totals
        const newChartData = [];
        for (let i = 6; i >= 0; i--) {
          newChartData.push({
            time: `${i}h ago`,
            risk: Math.max(0, risk - (i * 15000)),
            recovered: Math.max(0, rec - (i * 8000)),
          });
        }
        setChartData(newChartData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
          <button 
            onClick={handleInject}
            disabled={injecting}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {injecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-400" />}
            Inject Webhook
          </button>
          <button 
            onClick={handleTrigger}
            disabled={triggering}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-emerald-950 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 disabled:opacity-50"
          >
            {triggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            Run AI Brain
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8">
        
        {/* Top Stats & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          
          {/* Stats Column */}
          <motion.div 
            variants={containerVariants} initial="hidden" animate="show"
            className="col-span-1 flex flex-col gap-6"
          >
            <motion.div variants={itemVariants} className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <AlertCircle className="w-24 h-24 text-rose-500" />
              </div>
              <p className="text-sm font-medium text-white/50 tracking-wider uppercase mb-1">Revenue at Risk</p>
              <h2 className="text-4xl font-light tracking-tight">{formatCurrency(totalAtRisk)}</h2>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-rose-400 bg-rose-500/10 w-fit px-2.5 py-1 rounded-full border border-rose-500/20">
                <TrendingUp className="w-3 h-3" />
                <span>Requires Attention</span>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="glass-panel p-6 rounded-3xl relative overflow-hidden group aurora-gradient">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Wallet className="w-24 h-24 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-emerald-500/80 tracking-wider uppercase mb-1">Recovered by AI</p>
              <h2 className="text-4xl font-light tracking-tight text-glow">{formatCurrency(recoveredAmount)}</h2>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 w-fit px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>{actionsTaken} Autonomous Actions</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Chart Column */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="col-span-1 lg:col-span-2 glass-panel rounded-3xl p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold tracking-tight">Recovery Performance</h3>
              <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div> Risk</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div> Recovered</div>
              </div>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
          {loading && <RefreshCw className="w-5 h-5 animate-spin text-white/30" />}
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden border border-white/10">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-white/[0.02] text-xs font-semibold text-white/40 uppercase tracking-widest">
            <div className="col-span-3">Customer & Amount</div>
            <div className="col-span-3">Failure Reason</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-5">AI Agent Strategy (Gemini)</div>
          </div>
          
          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {payments.length === 0 && !loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center text-white/40">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Inbox zero. All revenue recovered.</p>
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
                    
                    <div className="col-span-1">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border ${
                        isRecovered 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    
                    <div className="col-span-5">
                      {!p.recovery_actions || p.recovery_actions.length === 0 ? (
                        <div className="flex items-center gap-2 text-white/30 text-sm">
                          <div className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
                          Waiting for Brain...
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {p.recovery_actions.map((action: Record<string, string>) => {
                            const reasoning = action.gemini_reasoning || '';
                            const churnRiskMatch = reasoning.match(/\[CHURN_RISK:\s*(\d+)%\]/);
                            const churnRisk = churnRiskMatch ? parseInt(churnRiskMatch[1], 10) : null;
                            const isBargaining = reasoning.includes('[BARGAINING_ACTIVE]');
                            const linkMatch = reasoning.match(/\| LINK: (https:\/\/[^\s|]+)/);
                            const link = linkMatch ? linkMatch[1] : null;
                            const partialLinkMatch = reasoning.match(/\| PARTIAL_LINK: (https:\/\/[^\s|]+)/);
                            const partialLink = partialLinkMatch ? partialLinkMatch[1] : null;
                            
                            const rationale = reasoning
                              .replace(/\[CHURN_RISK: \d+%\]/g, '')
                              .replace(/\[BARGAINING_ACTIVE\]/g, '')
                              .replace(/\| LINK: https:\/\/[^\s|]+/g, '')
                              .replace(/\| PARTIAL_LINK: https:\/\/[^\s|]+/g, '')
                              .trim();

                            return (
                              <div key={action.id} className="p-3 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden">
                                {action.status === 'executed' && (
                                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
                                )}
                                
                                <div className="flex items-center flex-wrap gap-2 mb-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/90 uppercase tracking-wider font-mono">
                                    {action.type}
                                  </span>
                                  {churnRisk !== null && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono border ${
                                      churnRisk > 70 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                      {churnRisk > 70 ? '🚨 High Churn Risk: ' : 'Risk: '} {churnRisk}%
                                    </span>
                                  )}
                                  {isBargaining && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-mono">
                                      🤝 Bargaining Strategy
                                    </span>
                                  )}
                                </div>
                                
                                <p className="text-[13px] text-white/70 leading-relaxed mb-3">
                                  {rationale}
                                </p>
                                
                                <div className="flex flex-wrap gap-2 mt-auto">
                                  {link && (
                                    <a href={link} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5">
                                      Pay Full
                                    </a>
                                  )}
                                  {partialLink && (
                                    <a href={partialLink} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5">
                                      Pay 50% Upfront
                                    </a>
                                  )}
                                  
                                  {/* Feature 3: Voice AI Dispatch Button (Only for High Risk) */}
                                  {churnRisk !== null && churnRisk >= 70 && (
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
