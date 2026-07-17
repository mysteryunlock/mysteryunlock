import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { listActivePlans, type PublicPlan } from "@/lib/plans.functions";
import { Btn } from "@/components/ds";
import { getMySubscription } from "@/lib/shops.functions";
import {
  ArrowLeft, Check, Crown, Sparkles, Building2, Calendar, CreditCard,
  AlertCircle, MessageCircle, Mail, Receipt, ShieldCheck, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-[#0c2340]">Could not load billing: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

type Sub = {
  shop: {
    id: string;
    plan: string | null;
    subscription_status: "trial" | "active" | "past_due" | "suspended" | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    billing_notes: string | null;
  } | null;
  payments: Array<{
    amount: number;
    currency: string;
    method: string | null;
    reference: string | null;
    period_start: string | null;
    period_end: string | null;
    notes: string | null;
    created_at: string;
  }>;
};

const WHATSAPP = "9779769402069";
const EMAIL = "support@mysteryunlock.com";

function fmtMoney(amount: number, currency: string) {
  if (amount === 0) return "Free";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  catch { return "—"; }
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function statusMeta(status: string | null | undefined) {
  switch (status) {
    case "active": return { label: "Active", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "trial": return { label: "Free trial", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
    case "past_due": return { label: "Past due", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" };
    case "suspended": return { label: "Suspended", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" };
    default: return { label: "—", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
  }
}

function BillingPage() {
  const router = useRouter();
  const fetchPlans = useServerFn(listActivePlans);
  const fetchSub = useServerFn(getMySubscription);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    Promise.all([fetchPlans(), fetchSub()])
      .then(([p, s]) => { if (!on) return; setPlans(p.plans); setSub(s as Sub); })
      .catch(() => {})
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [fetchPlans, fetchSub]);

  const currentCode = (sub?.shop?.plan ?? "free").toLowerCase();
  const status = sub?.shop?.subscription_status ?? null;
  const meta = statusMeta(status);
  const renewIso = sub?.shop?.current_period_end ?? sub?.shop?.trial_ends_at ?? null;
  const renewDays = daysUntil(renewIso);

  const currentPlan = useMemo(
    () => plans.find((p) => p.code.toLowerCase() === currentCode) ?? null,
    [plans, currentCode],
  );

  function contactFor(action: "Upgrade" | "Downgrade" | "Manage" | "Renew", plan?: PublicPlan) {
    const planText = plan ? ` to ${plan.name}` : "";
    const msg = `Hi, I want to ${action.toLowerCase()} my Mystery Unlock subscription${planText}.`;
    if (plan?.contact_url) { window.open(plan.contact_url, "_blank"); return; }
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] text-[#0c2340] pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-black/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.history.back()}
            className="grid place-items-center h-10 w-10 rounded-xl bg-[#F5F7FA] hover:bg-[#E9EEF3] transition"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight truncate">Billing & Plans</h1>
            <p className="text-xs text-slate-500">Manage your subscription</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Current plan banner */}
        <section className="rounded-3xl overflow-hidden shadow-sm bg-gradient-to-br from-[#0c2340] to-[#143961] text-white relative">
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ background: "radial-gradient(circle at 20% 0%, #FF6B1A 0%, transparent 55%)" }} />
          <div className="relative p-6 sm:p-7">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <ShieldCheck className="h-4 w-4" /> Current plan
            </div>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                    {loading ? "…" : (currentPlan?.name ?? (currentCode === "free" ? "Free" : currentCode))}
                  </h2>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                </div>
                {currentPlan?.tagline && (
                  <p className="text-white/70 text-sm mt-1 truncate">{currentPlan.tagline}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-black">
                  {currentPlan ? fmtMoney(currentPlan.price_amount, currentPlan.currency) : "—"}
                </div>
                {currentPlan && currentPlan.price_amount > 0 && (
                  <div className="text-white/60 text-xs">/ {currentPlan.period}</div>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Calendar className="h-3.5 w-3.5" /> Renews on
                </div>
                <div className="font-bold mt-1 text-sm">{fmtDate(renewIso)}</div>
                {renewDays !== null && (
                  <div className={`text-[11px] mt-0.5 ${renewDays < 7 ? "text-orange-300" : "text-white/60"}`}>
                    {renewDays >= 0 ? `${renewDays} days remaining` : `Expired ${Math.abs(renewDays)}d ago`}
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Building2 className="h-3.5 w-3.5" /> Plan code
                </div>
                <div className="font-bold mt-1 text-sm uppercase">{currentCode}</div>
              </div>
            </div>

            {status === "past_due" && (
              <div className="mt-4 rounded-2xl bg-orange-500/15 border border-orange-300/30 p-3 flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-orange-300 shrink-0 mt-0.5" />
                <div>Your subscription is past due. Renew now to keep your campaign live for customers.</div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Btn
                variant="primary"
                size="sm"
                className="rounded-xl active:scale-[0.98]"
                onClick={() => contactFor("Renew")}
                leftIcon={<Sparkles className="h-4 w-4" />}
              >
                Renew / Extend
              </Btn>
              <button
                onClick={() => contactFor("Manage")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition font-semibold text-sm"
              >
                Manage subscription
              </button>
            </div>
          </div>
        </section>

        {/* Plan cards */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h3 className="text-lg font-black">Choose your plan</h3>
              <p className="text-xs text-slate-500">Tap a card to upgrade or downgrade</p>
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-72 rounded-3xl bg-white animate-pulse" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center text-slate-500 shadow-sm">
              No plans available yet. Check back soon.
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.code.toLowerCase() === currentCode;
                const currentOrder = currentPlan?.sort_order ?? 0;
                const isUpgrade = plan.sort_order > currentOrder;
                const action: "Upgrade" | "Downgrade" | "Manage" = isCurrent ? "Manage" : isUpgrade ? "Upgrade" : "Downgrade";

                return (
                  <article
                    key={plan.id}
                    className={`relative rounded-3xl bg-white p-5 flex flex-col shadow-sm transition border ${
                      plan.is_highlighted ? "border-[#FF6B1A]/40 ring-2 ring-[#FF6B1A]/15" : "border-black/5"
                    } ${isCurrent ? "outline outline-2 outline-[#0c2340]/15" : ""}`}
                  >
                    {plan.is_highlighted && !isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FF6B1A] text-white text-[10px] font-black uppercase tracking-wider">
                        <Crown className="h-3 w-3" /> Most popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0c2340] text-white text-[10px] font-black uppercase tracking-wider">
                        <Check className="h-3 w-3" /> Current plan
                      </span>
                    )}

                    <div>
                      <h4 className="text-xl font-black">{plan.name}</h4>
                      {plan.tagline && <p className="text-xs text-slate-500 mt-0.5">{plan.tagline}</p>}
                    </div>

                    <div className="mt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black">{fmtMoney(plan.price_amount, plan.currency)}</span>
                        {plan.price_amount > 0 && <span className="text-slate-500 text-sm">/ {plan.period}</span>}
                      </div>
                    </div>

                    <ul className="mt-4 space-y-2 flex-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="grid place-items-center h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                          <span className="text-[#0c2340]/85">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => contactFor(action, plan)}
                      disabled={isCurrent}
                      className={`mt-5 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                        isCurrent
                          ? "bg-[#F5F7FA] text-slate-500 cursor-default"
                          : plan.is_highlighted
                            ? "gradient-primary text-white shadow-md shadow-orange-500/20 hover:opacity-95"
                            : "bg-[#0c2340] hover:bg-[#143961] text-white"
                      }`}
                    >
                      {isCurrent ? "You're on this plan" : plan.cta_label ?? action} {!isCurrent && <ChevronRight className="h-4 w-4" />}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Billing history */}
        <section className="rounded-3xl bg-white shadow-sm overflow-hidden">
          <header className="px-5 py-4 border-b border-black/5 flex items-center gap-2">
            <div className="grid place-items-center h-9 w-9 rounded-xl bg-[#FF6B1A]/10 text-[#FF6B1A]">
              <Receipt className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black">Billing history</h3>
              <p className="text-xs text-slate-500">Recent invoices and payments</p>
            </div>
          </header>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : !sub?.payments || sub.payments.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 grid place-items-center rounded-2xl bg-[#F5F7FA] text-slate-400">
                <CreditCard className="h-6 w-6" />
              </div>
              <p className="mt-3 font-semibold">No payments yet</p>
              <p className="text-xs text-slate-500 mt-1">Once a payment is recorded it will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {sub.payments.map((p, i) => (
                <li key={i} className="px-5 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      {fmtMoney(Number(p.amount), p.currency || "NPR")}
                      {p.method && <span className="ml-2 text-xs font-medium text-slate-500">· {p.method}</span>}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {fmtDate(p.created_at)}
                      {p.period_start && p.period_end && <> · {fmtDate(p.period_start)} → {fmtDate(p.period_end)}</>}
                      {p.reference && <> · ref {p.reference}</>}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    <Check className="h-3 w-3" /> Paid
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Help */}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="font-black mb-1">Need help?</h3>
          <p className="text-xs text-slate-500 mb-4">Get in touch and we'll handle your subscription manually within 24h.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 transition">
              <div className="grid place-items-center h-10 w-10 rounded-xl bg-emerald-500 text-white"><MessageCircle className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="font-bold text-sm">WhatsApp</div>
                <div className="text-xs text-emerald-700/70 truncate">+977 9769402069</div>
              </div>
            </a>
            <a href={`mailto:${EMAIL}`}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#FF6B1A]/10 hover:bg-[#FF6B1A]/15 transition">
              <div className="grid place-items-center h-10 w-10 rounded-xl bg-[#FF6B1A] text-white"><Mail className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="font-bold text-sm">Email us</div>
                <div className="text-xs text-[#FF6B1A]/80 truncate">{EMAIL}</div>
              </div>
            </a>
          </div>
        </section>

        <p className="text-center text-[11px] text-slate-400 pt-2">
          Prices are managed by the Mystery Unlock team. <Link to="/dashboard" className="underline">Back to dashboard</Link>
        </p>
      </main>
    </div>
  );
}
