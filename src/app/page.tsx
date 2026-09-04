"use client";

import { useEffect, useState } from "react";

interface PaymentRow {
  id: string;
  razorpay_payment_id: string;
  amount: number;
  currency: string;
  failure_reason: string;
  status: string;
  customer_email: string | null;
  recovery_actions: Record<string, string>[];
}

export default function Dashboard() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  // Stats
  const [totalAtRisk, setTotalAtRisk] = useState(0);
  const [actionsTaken, setActionsTaken] = useState(0);
  const [, setRecoveredAmount] = useState(0);

  const fetchData = async () => {
    // In a real app we'd use SWR or React Query. Here we just fetch on mount and after actions.
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
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds for live updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
  };

  const handleMockInject = async () => {
    showToast("Injecting mock failure...");
    await fetch("/api/demo/inject", { method: "POST" });
    fetchData();
  };

  const handleRunBrain = async () => {
    showToast("Neural routing in progress...");
    await fetch("/api/agent/process-batch", { method: "POST" });
    fetchData();
  };

  const handleExecuteRecovery = async () => {
    showToast("Triggering high-priority PSP routing...");
    await fetch("/api/agent/execute", { method: "POST" });
    fetchData();
  };

  const toggleDetails = (id: string) => {
    const el = document.getElementById(id + "-details");
    if (el) {
      el.classList.toggle("hidden");
    }
  };

  return (
    <div className="bg-surface text-on-surface antialiased selection:bg-secondary-fixed min-h-screen flex flex-col font-body-default">
      {/* HEADER */}
      <header className="fixed top-0 w-full z-50 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="h-16 px-space-md flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline-sm text-headline-sm font-semibold tracking-tight text-on-surface">
                Recover<span className="text-secondary">AI</span>
              </span>
              <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container">
              <div className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse"></div>
              <span className="font-label-code text-label-code text-on-tertiary-container uppercase tracking-wider">
                SYNC ACTIVE
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-space-md">
        <div className="flex flex-col w-full pb-10 space-y-5">
          {/* Top Editorial Header */}
          <div className="flex flex-col space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                <span className="font-label-code text-label-code text-secondary tracking-widest uppercase">
                  Sentinel Core v4.2
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-semibold tracking-tight">
                Autonomous Recovery
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Continuous risk mitigation and autonomous payment arbitration ledger.
              </p>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex flex-col space-y-3">
            <div className="relative overflow-hidden bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                    Gross Capital At Risk
                  </span>
                  <span className="font-body-sm text-body-sm text-outline mt-0.5">
                    Pool: {payments.length} failed
                  </span>
                </div>
              </div>
              <div className="flex items-baseline justify-between mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="font-data-tabular-lg text-data-tabular-lg font-bold text-on-surface tracking-tight">
                    ₹{(totalAtRisk / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-surface-container flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">AI Operations</span>
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                </div>
                <div className="my-2">
                  <div className="font-data-tabular-lg text-[26px] leading-7 font-bold text-on-surface">
                    {actionsTaken} <span className="font-body-sm text-body-sm text-outline font-normal">exec</span>
                  </div>
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-surface-container flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Recovery Ratio</span>
                </div>
                <div className="my-2">
                  <div className="font-data-tabular-lg text-[26px] leading-7 font-bold text-on-tertiary-container">
                    {payments.length > 0 ? Math.round((payments.filter(p => p.status === 'recovered').length / payments.length) * 100) : 0}
                    <span className="text-on-surface-variant text-headline-sm font-normal">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Strip */}
          <div className="bg-surface-container-low rounded-xl p-2.5 shadow-sm border border-surface-variant">
            <div className="flex items-center justify-between gap-2">
              <button
                className="flex-1 h-10 px-2.5 rounded bg-surface-container-highest hover:bg-surface-dim text-on-surface font-body-sm text-body-sm font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                onClick={handleMockInject}
              >
                Inject Fail
              </button>
              <button
                className="flex-1 h-10 px-2.5 rounded bg-on-surface hover:bg-on-surface-variant text-surface font-body-sm text-body-sm font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                onClick={handleRunBrain}
              >
                Run Brain
              </button>
              <button
                className="flex-1 h-10 px-2.5 rounded bg-secondary hover:bg-secondary-container text-on-secondary font-body-sm text-body-sm font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                onClick={handleExecuteRecovery}
              >
                Recover
              </button>
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 flex items-center justify-between px-1 text-on-surface-variant font-label-code text-label-code ${
                toastVisible ? "h-6 opacity-100 mt-2" : "h-0 opacity-0"
              }`}
            >
              <span>{toastMsg}</span>
            </div>
          </div>

          {/* Ledger Stream */}
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Audit Ledger</span>
              </div>
            </div>

            <div className="flex flex-col space-y-2.5">
              {loading && <p className="text-sm text-outline">Loading ledger...</p>}
              {!loading && payments.length === 0 && (
                <p className="text-sm text-outline p-4 text-center border border-dashed border-outline-variant rounded-xl">No payments found. Click &quot;Inject Fail&quot; to start.</p>
              )}
              
              {payments.map((p) => {
                // Determine styling based on status
                let statusBg = "bg-surface-container";
                let statusText = "text-on-surface-variant";
                const displayStatus = p.status.replace(/_/g, " ").toUpperCase();
                let dotColor = "bg-outline";

                if (p.status === 'recovered') {
                  statusBg = "bg-surface-container";
                  statusText = "text-on-tertiary-container";
                  dotColor = "bg-on-tertiary-container";
                } else if (p.status === 'recovery_in_progress') {
                  statusBg = "bg-secondary-fixed";
                  statusText = "text-on-secondary-fixed-variant";
                  dotColor = "bg-secondary";
                } else if (p.status === 'max_retries_reached') {
                  statusBg = "bg-error-container";
                  statusText = "text-error";
                  dotColor = "bg-error";
                }

                return (
                  <div
                    key={p.id}
                    className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm transition-all hover:bg-surface-container-low cursor-pointer border border-surface-container"
                    onClick={() => toggleDetails(`row-${p.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-label-code text-label-code text-outline font-semibold tracking-tight">
                            #{p.razorpay_payment_id?.slice(-8) || p.id.slice(0,8)}
                          </span>
                        </div>
                        <span className="font-body-strong text-body-strong text-on-surface truncate mt-0.5">
                          {p.customer_email || "anonymous"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="font-data-tabular-md text-data-tabular-md font-semibold text-on-surface">
                          ₹{(p.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${statusBg} ${statusText} font-label-code text-[10px] mt-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                          {displayStatus}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 pt-2.5 bg-surface-container-low rounded-lg px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-label-code text-[11px] text-error font-medium truncate">
                          {p.failure_reason}
                        </span>
                      </div>
                    </div>

                    {/* Hidden Details */}
                    {p.recovery_actions && p.recovery_actions.length > 0 && (
                      <div className="mt-2.5 pt-2 flex flex-col space-y-1.5 hidden" id={`row-${p.id}-details`}>
                        {p.recovery_actions.map((action: Record<string, string>) => {
                          const reasoning = action.gemini_reasoning || '';
                          
                          // Parse Churn Risk
                          const churnRiskMatch = reasoning.match(/\[CHURN_RISK:\s*(\d+)%\]/);
                          const churnRisk = churnRiskMatch ? parseInt(churnRiskMatch[1], 10) : null;
                          
                          // Parse Bargaining
                          const isBargaining = reasoning.includes('[BARGAINING_ACTIVE]');
                          
                          // Extract Links
                          const linkMatch = reasoning.match(/\| LINK: (https:\/\/[^\s|]+)/);
                          const link = linkMatch ? linkMatch[1] : null;
                          
                          const partialLinkMatch = reasoning.match(/\| PARTIAL_LINK: (https:\/\/[^\s|]+)/);
                          const partialLink = partialLinkMatch ? partialLinkMatch[1] : null;
                          
                          // Clean the rationale text for display
                          let rationale = reasoning
                            .replace(/\[CHURN_RISK: \d+%\]/g, '')
                            .replace(/\[BARGAINING_ACTIVE\]/g, '')
                            .replace(/\| LINK: https:\/\/[^\s|]+/g, '')
                            .replace(/\| PARTIAL_LINK: https:\/\/[^\s|]+/g, '')
                            .trim();

                          return (
                          <div key={action.id} className="pb-2 border-b border-surface-container last:border-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-medium tracking-wide uppercase text-on-surface-variant/80">AI Strategy:</span>
                              <span className="px-2 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-semibold tracking-wider font-mono">
                                {action.type}
                              </span>
                              {churnRisk !== null && (
                                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold tracking-wider font-mono ${churnRisk > 70 ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'}`}>
                                  {churnRisk > 70 ? '🚨 HIGH CHURN RISK: ' : 'CHURN RISK: '} {churnRisk}%
                                </span>
                              )}
                              {isBargaining && (
                                <span className="px-2 py-0.5 rounded-sm bg-green-500/20 text-green-500 text-[10px] font-semibold tracking-wider font-mono">
                                  🤝 BARGAINING OFFERED
                                </span>
                              )}
                            </div>
                            <div className="text-[13px] text-on-surface-variant/90 leading-relaxed pl-2 border-l-2 border-primary/20">
                              {rationale}
                            </div>
                            <div className="flex gap-2 mt-2">
                              {link && (
                                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4B8EF5] hover:bg-[#3b7be0] text-white text-[12px] font-medium rounded transition-colors shadow-sm w-fit">
                                  <span>Pay Full Amount</span>
                                  <svg className="w-3.5 h-3.5 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </a>
                              )}
                              {partialLink && (
                                <a href={partialLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-[12px] font-medium rounded transition-colors shadow-sm w-fit">
                                  <span>Pay 50% Upfront</span>
                                  <svg className="w-3.5 h-3.5 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </a>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
