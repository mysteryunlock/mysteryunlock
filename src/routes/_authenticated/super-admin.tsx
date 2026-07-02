import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllShops,
  setShopActive,
  deleteShop,
  claimShop,
  sendOwnerPasswordReset,
  forceSetOwnerPassword,
  signOutOwner,
  getShopDetails,
  updateShopSubscription,
  extendShopPeriod,
  recordShopPayment,
} from "@/lib/shops.functions";
import { listAllPlansAdmin, upsertPlan, deletePlan } from "@/lib/plans.functions";


export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Super admin — Mystery Unlock" }] }),
  component: SuperAdminPage,
});

type EnrichedShop = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
  owner_last_sign_in_at: string | null;
  owner_email_confirmed_at: string | null;
  codes_count: number;
  spins_count: number;
  plan: "free" | "pro" | "lifetime";
  subscription_status: "trial" | "active" | "past_due" | "suspended";
  trial_ends_at: string | null;
  current_period_end: string | null;
};


type ShopDetails = Awaited<ReturnType<typeof getShopDetails>>;

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString() : "—";
}

function SuperAdminPage() {
  const fetchAll = useServerFn(listAllShops);
  const doSetActive = useServerFn(setShopActive);
  const doDelete = useServerFn(deleteShop);
  const doClaim = useServerFn(claimShop);
  const doReset = useServerFn(sendOwnerPasswordReset);
  const doForcePw = useServerFn(forceSetOwnerPassword);
  const doSignOut = useServerFn(signOutOwner);
  const fetchDetails = useServerFn(getShopDetails);
  const doUpdateSub = useServerFn(updateShopSubscription);
  const doExtend = useServerFn(extendShopPeriod);
  const doRecordPayment = useServerFn(recordShopPayment);


  const [shops, setShops] = useState<EnrichedShop[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<ShopDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAll();
      setShops(res.shops as EnrichedShop[]);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }, [fetchAll]);
  useEffect(() => { load(); }, [load]);

  const openDetails = async (id: string) => {
    setOpenId(id);
    setDetails(null);
    setDetailsLoading(true);
    try {
      const d = await fetchDetails({ data: { shopId: id } });
      setDetails(d);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load");
    } finally { setDetailsLoading(false); }
  };

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key); setMsg("");
    try { await fn(); setMsg(ok); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (err) return <div className="min-h-screen flex items-center justify-center text-destructive">{err}</div>;

  return (
    <div className="min-h-screen px-4 py-5 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">Super admin</p>
          <h1 className="text-2xl font-black">All shops ({shops.length})</h1>
        </div>
        <Link to="/dashboard" className="text-sm px-3 py-2 rounded-lg bg-white/5">← Back</Link>
      </div>

      {msg && <div className="mb-3 text-xs px-3 py-2 rounded bg-white/5">{msg}</div>}


      <PlansManager onMsg={setMsg} />

      <div className="space-y-2">
        {shops.map((s) => (
          <div key={s.id} className="glass rounded-xl p-4">
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div className="flex gap-3 items-start min-w-0">
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-white/5" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/5 grid place-items-center text-xs text-muted-foreground">no logo</div>
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    {s.name}{" "}
                    <a href={`/s/${s.slug}`} target="_blank" rel="noreferrer" className="text-xs text-primary font-mono">/s/{s.slug} ↗</a>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.owner_email || (s.owner_user_id ? "Owner (no email)" : "Unclaimed")}
                    {s.owner_email_confirmed_at ? <span className="ml-1 text-emerald-400">✓ verified</span> : s.owner_user_id ? <span className="ml-1 text-amber-400">unverified</span> : null}
                  </p>
                  <p className="text-xs mt-1">
                    Last sign-in: {fmt(s.owner_last_sign_in_at)} · created {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs mt-1">
                    {s.codes_count} codes · {s.spins_count} spins ·{" "}
                    {s.is_active ? <span className="text-emerald-400">active</span> : <span className="text-destructive">suspended</span>}
                  </p>
                  <p className="text-xs mt-1">
                    <span className="px-1.5 py-0.5 rounded bg-white/10 uppercase font-bold mr-1">{s.plan}</span>
                    <span className={
                      s.subscription_status === "active" ? "text-emerald-400" :
                      s.subscription_status === "trial" ? "text-amber-300" :
                      s.subscription_status === "past_due" ? "text-orange-400" : "text-destructive"
                    }>{s.subscription_status}</span>
                    {s.current_period_end && <span className="text-muted-foreground"> · renews {new Date(s.current_period_end).toLocaleDateString()}</span>}
                    {!s.current_period_end && s.trial_ends_at && s.subscription_status === "trial" && (
                      <span className="text-muted-foreground"> · trial ends {new Date(s.trial_ends_at).toLocaleDateString()}</span>
                    )}
                  </p>

                </div>
              </div>
              <div className="flex gap-1 flex-wrap text-xs">
                <button onClick={() => openDetails(s.id)} className="px-2 py-1 rounded bg-primary text-white font-bold">View details</button>
                {!s.owner_user_id && <button onClick={async () => { await doClaim({ data: { id: s.id } }); load(); }} className="px-2 py-1 rounded bg-primary text-white font-bold">Claim</button>}
                <button onClick={async () => { await doSetActive({ data: { id: s.id, is_active: !s.is_active } }); load(); }} className="px-2 py-1 rounded bg-white/5">
                  {s.is_active ? "Suspend" : "Reactivate"}
                </button>
                <button onClick={async () => { if (confirm(`Delete shop "${s.name}" and all its data?`)) { await doDelete({ data: { id: s.id } }); load(); } }} className="px-2 py-1 rounded bg-destructive/20 text-destructive">Delete</button>
              </div>
            </div>

            {s.owner_user_id && (
              <div className="mt-3 pt-3 border-t border-[#0c2340]/10 flex gap-1 flex-wrap text-xs">
                <button
                  disabled={busy === `r${s.id}`}
                  onClick={() => run(`r${s.id}`,
                    () => doReset({ data: { shopId: s.id, redirectTo: `${window.location.origin}/auth` } }),
                    `Reset email sent to ${s.owner_email}`)}
                  className="px-2 py-1 rounded bg-white/5"
                >
                  {busy === `r${s.id}` ? "…" : "Send reset email"}
                </button>
                <button
                  disabled={busy === `p${s.id}`}
                  onClick={() => {
                    const pw = prompt(`Set a new password for ${s.owner_email}\n(min 8 chars, will sign them out everywhere)`);
                    if (!pw) return;
                    run(`p${s.id}`, () => doForcePw({ data: { shopId: s.id, password: pw } }), "Password updated. Owner signed out everywhere.");
                  }}
                  className="px-2 py-1 rounded bg-amber-500/20 text-amber-300"
                >
                  {busy === `p${s.id}` ? "…" : "Force-set password"}
                </button>
                <button
                  disabled={busy === `o${s.id}`}
                  onClick={() => {
                    if (!confirm("Sign this owner out of all devices?")) return;
                    run(`o${s.id}`, () => doSignOut({ data: { shopId: s.id } }), "Owner signed out everywhere.");
                  }}
                  className="px-2 py-1 rounded bg-white/5"
                >
                  {busy === `o${s.id}` ? "…" : "Sign out all devices"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {openId && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-3" onClick={() => setOpenId(null)}>
          <div className="bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold">Shop details</h2>
              <button onClick={() => setOpenId(null)} className="text-sm px-2 py-1 rounded bg-white/5">Close</button>
            </div>
            {detailsLoading || !details ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-5 text-sm">
                <section>
                  <div className="flex gap-3 items-center">
                    {details.shop.logo_url ? (
                      <img src={details.shop.logo_url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                    ) : <div className="w-16 h-16 rounded-lg bg-white/5" />}
                    <div>
                      <p className="font-bold text-base">{details.shop.name}</p>
                      <a href={`/s/${details.shop.slug}`} target="_blank" rel="noreferrer" className="text-primary text-xs font-mono">/s/{details.shop.slug} ↗</a>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="font-bold mb-2">Owner</h3>
                  {details.owner ? (
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>Email: <span className="text-foreground">{details.owner.email ?? "—"}</span></li>
                      <li>Email confirmed: <span className="text-foreground">{fmt(details.owner.email_confirmed_at)}</span></li>
                      <li>Last sign-in: <span className="text-foreground">{fmt(details.owner.last_sign_in_at)}</span></li>
                      <li>Account created: <span className="text-foreground">{fmt(details.owner.created_at)}</span></li>
                    </ul>
                  ) : <p className="text-xs text-muted-foreground">Unclaimed shop.</p>}
                  <p className="text-[11px] text-muted-foreground mt-2">Passwords are stored as one-way hashes and cannot be viewed. Use the actions on the row to send a reset email or force-set a new password.</p>
                </section>

                <SubscriptionSection
                  shop={details.shop as any}
                  payments={(details as any).payments ?? []}
                  busy={busy}
                  onUpdate={async (patch) => {
                    await run(`sub${details.shop.id}`, () => doUpdateSub({ data: { shopId: details.shop.id, ...patch } }), "Subscription updated");
                    const d = await fetchDetails({ data: { shopId: details.shop.id } });
                    setDetails(d); load();
                  }}
                  onExtend={async (months) => {
                    await run(`ext${details.shop.id}`, () => doExtend({ data: { shopId: details.shop.id, months } }), `Extended by ${months} month(s)`);
                    const d = await fetchDetails({ data: { shopId: details.shop.id } });
                    setDetails(d); load();
                  }}
                  onRecordPayment={async (p) => {
                    await run(`pay${details.shop.id}`, () => doRecordPayment({ data: { shopId: details.shop.id, ...p } }), "Payment recorded");
                    const d = await fetchDetails({ data: { shopId: details.shop.id } });
                    setDetails(d); load();
                  }}
                />



                <section>
                  <h3 className="font-bold mb-2">Prizes ({details.prizes.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {details.prizes.map((p) => (
                      <div key={p.id} className="rounded-lg bg-white/5 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          {p.image_url ? <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-white/10" />}
                          <div className="min-w-0">
                            <p className="font-bold truncate">{p.name}</p>
                            <p className="text-muted-foreground">{p.is_win ? "win" : "lose"} · p={p.probability}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-bold mb-2">Recent spins ({details.spins.length})</h3>
                  <div className="max-h-56 overflow-auto rounded-lg border border-[#0c2340]/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/5 text-left">
                        <tr><th className="p-2">When</th><th className="p-2">Customer</th><th className="p-2">Contact</th><th className="p-2">Email</th><th className="p-2">Code</th><th className="p-2">Prize</th></tr>
                      </thead>
                      <tbody>
                        {details.spins.map((s) => (
                          <tr key={s.code} className="border-t border-white/5">
                            <td className="p-2 whitespace-nowrap">{fmt(s.spun_at)}</td>
                            <td className="p-2">{s.customer_name ?? "—"}</td>
                            <td className="p-2">{s.customer_contact ?? "—"}</td>
                            <td className="p-2">{s.customer_email ?? "—"}</td>
                            <td className="p-2 font-mono">{s.code}</td>
                            <td className="p-2">{s.prize_won ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h3 className="font-bold mb-2">Access codes ({details.codes.length})</h3>
                  <div className="max-h-56 overflow-auto rounded-lg border border-[#0c2340]/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/5 text-left">
                        <tr><th className="p-2">Code</th><th className="p-2">Used</th><th className="p-2">Customer</th><th className="p-2">Contact</th><th className="p-2">Email</th><th className="p-2">Prize</th><th className="p-2">Created</th></tr>
                      </thead>
                      <tbody>
                        {details.codes.map((c) => (
                          <tr key={c.code} className="border-t border-white/5">
                            <td className="p-2 font-mono">{c.code}</td>
                            <td className="p-2">{c.is_used ? <span className="text-emerald-400">yes</span> : <span className="text-muted-foreground">no</span>}</td>
                            <td className="p-2">{c.customer_name ?? "—"}</td>
                            <td className="p-2">{c.customer_contact ?? "—"}</td>
                            <td className="p-2">{c.customer_email ?? "—"}</td>
                            <td className="p-2">{c.prize_won ?? "—"}</td>
                            <td className="p-2 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type SubShop = {
  id: string;
  plan: "free" | "pro" | "lifetime";
  subscription_status: "trial" | "active" | "past_due" | "suspended";
  trial_ends_at: string | null;
  current_period_end: string | null;
  billing_notes: string | null;
};

type SubPayment = {
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_at: string;
};

type SubPatch = {
  plan?: "free" | "pro" | "lifetime";
  subscription_status?: "trial" | "active" | "past_due" | "suspended";
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  billing_notes?: string | null;
};

type PayInput = {
  amount: number;
  currency: string;
  method?: string;
  reference?: string;
  months?: number;
  notes?: string;
};

function SubscriptionSection({
  shop, payments, busy, onUpdate, onExtend, onRecordPayment,
}: {
  shop: SubShop;
  payments: SubPayment[];
  busy: string | null;
  onUpdate: (patch: SubPatch) => Promise<void>;
  onExtend: (months: number) => Promise<void>;
  onRecordPayment: (p: PayInput) => Promise<void>;
}) {
  const [plan, setPlan] = useState<SubShop["plan"]>(shop.plan);
  const [status, setStatus] = useState<SubShop["subscription_status"]>(shop.subscription_status);
  const [notes, setNotes] = useState(shop.billing_notes ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [method, setMethod] = useState("eSewa");
  const [reference, setReference] = useState("");
  const [months, setMonths] = useState("1");
  const [payNotes, setPayNotes] = useState("");

  return (
    <section>
      <h3 className="font-bold mb-2">Subscription & billing</h3>
      <div className="rounded-lg bg-white/5 p-3 space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-muted-foreground">Plan</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value as SubShop["plan"])} className="w-full bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1">
              <option value="free">free</option><option value="pro">pro</option><option value="lifetime">lifetime</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as SubShop["subscription_status"])} className="w-full bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1">
              <option value="trial">trial</option><option value="active">active</option><option value="past_due">past_due</option><option value="suspended">suspended</option>
            </select>
          </label>
        </div>
        <div className="text-muted-foreground">
          {shop.current_period_end ? <>Period ends: <span className="text-foreground">{new Date(shop.current_period_end).toLocaleString()}</span></> :
           shop.trial_ends_at ? <>Trial ends: <span className="text-foreground">{new Date(shop.trial_ends_at).toLocaleString()}</span></> : "No end date set"}
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal billing notes" className="w-full bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1 min-h-[60px]" />
        <div className="flex gap-2 flex-wrap">
          <button disabled={busy === `sub${shop.id}`} onClick={() => onUpdate({ plan, subscription_status: status, billing_notes: notes })} className="px-3 py-1.5 rounded bg-primary text-white font-bold">Save</button>
          <button disabled={busy === `ext${shop.id}`} onClick={() => onExtend(1)} className="px-3 py-1.5 rounded bg-white/10">+1 month</button>
          <button disabled={busy === `ext${shop.id}`} onClick={() => onExtend(3)} className="px-3 py-1.5 rounded bg-white/10">+3 months</button>
          <button disabled={busy === `ext${shop.id}`} onClick={() => onExtend(12)} className="px-3 py-1.5 rounded bg-white/10">+12 months</button>
        </div>

        <div className="pt-3 border-t border-[#0c2340]/10">
          <p className="font-bold mb-2">Record a payment</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" inputMode="decimal" className="bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1" />
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="NPR" className="bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1" />
            <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="eSewa / Khalti / Bank" className="bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1" />
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference / txn id" className="bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1" />
            <input value={months} onChange={(e) => setMonths(e.target.value)} placeholder="Months to extend" inputMode="numeric" className="bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1" />
            <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Notes" className="bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded px-2 py-1" />
          </div>
          <button
            disabled={busy === `pay${shop.id}` || !amount}
            onClick={() => onRecordPayment({
              amount: Number(amount),
              currency: currency || "NPR",
              method: method || undefined,
              reference: reference || undefined,
              months: months ? Number(months) : 0,
              notes: payNotes || undefined,
            })}
            className="mt-2 px-3 py-1.5 rounded bg-primary text-white font-bold disabled:opacity-50"
          >Record payment</button>
        </div>

        {payments.length > 0 && (
          <div className="pt-3 border-t border-[#0c2340]/10">
            <p className="font-bold mb-2">Recent payments</p>
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1">Date</th><th>Amount</th><th>Method</th><th>Ref</th><th>Covers</th></tr></thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-1">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>{p.currency} {Number(p.amount).toLocaleString()}</td>
                    <td>{p.method ?? "—"}</td>
                    <td className="font-mono truncate max-w-[100px]">{p.reference ?? "—"}</td>
                    <td>{p.period_end ? new Date(p.period_end).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}


// ============= Subscription Plans Manager =============

type AdminPlan = {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  price_amount: number;
  currency: string;
  period: string;
  features: string[];
  is_highlighted: boolean;
  is_active: boolean;
  sort_order: number;
  cta_label: string | null;
  contact_url: string | null;
};

function emptyPlan(): AdminPlan {
  return {
    id: "",
    code: "",
    name: "",
    tagline: "",
    price_amount: 0,
    currency: "NPR",
    period: "month",
    features: [],
    is_highlighted: false,
    is_active: true,
    sort_order: 0,
    cta_label: "",
    contact_url: "",
  };
}

function PlansManager({ onMsg }: { onMsg: (m: string) => void }) {
  const fetchPlans = useServerFn(listAllPlansAdmin);
  const doUpsert = useServerFn(upsertPlan);
  const doDelete = useServerFn(deletePlan);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchPlans();
      setPlans(r.plans as AdminPlan[]);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Failed to load plans");
    } finally { setLoading(false); }
  }, [fetchPlans, onMsg]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        ...(editing.id ? { id: editing.id } : {}),
        code: editing.code.trim(),
        name: editing.name.trim(),
        tagline: editing.tagline?.trim() || null,
        price_amount: Number(editing.price_amount) || 0,
        currency: editing.currency.trim() || "NPR",
        period: editing.period.trim() || "month",
        features: (editing.features || []).map((f) => f.trim()).filter(Boolean),
        is_highlighted: !!editing.is_highlighted,
        is_active: !!editing.is_active,
        sort_order: Number(editing.sort_order) || 0,
        cta_label: editing.cta_label?.trim() || null,
        contact_url: editing.contact_url?.trim() || null,
      };
      await doUpsert({ data: payload });
      onMsg("Plan saved.");
      setEditing(null);
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  const remove = async (p: AdminPlan) => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    try {
      await doDelete({ data: { id: p.id } });
      onMsg("Plan deleted.");
      load();
    } catch (e) { onMsg(e instanceof Error ? e.message : "Delete failed"); }
  };

  return (
    <section className="mb-4 rounded-2xl bg-white shadow-sm">
      <header className="px-4 py-3 border-b border-black/5 flex items-center justify-between gap-2">
        <button onClick={() => setOpen(!open)} className="text-left min-w-0">
          <p className="font-bold text-[#0c2340]">Subscription plans</p>
          <p className="text-xs text-slate-500">{plans.length} plan(s) · shown to shop owners on /billing</p>
        </button>
        <div className="flex gap-2">
          <button onClick={() => setOpen(true)} className="text-xs px-2 py-1 rounded bg-white/5 hidden sm:inline">Toggle</button>
          <button
            onClick={() => { setEditing(emptyPlan()); setOpen(true); }}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-[#FF6B00] text-white font-bold"
          >+ Add plan</button>
        </div>
      </header>

      {open && (
        <div className="p-4">
          {loading ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : plans.length === 0 ? (
            <p className="text-xs text-slate-500">No plans yet.</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3">
              {plans.map((p) => (
                <div key={p.id} className={`rounded-xl border p-3 ${p.is_highlighted ? "border-[#FF6B00]/40 bg-[#FF6B00]/5" : "border-black/10 bg-[#F5F7FA]"}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#0c2340] truncate">{p.name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">{p.code}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{p.is_active ? "active" : "hidden"}</span>
                  </div>
                  <p className="mt-1 text-lg font-black text-[#0c2340]">
                    {p.price_amount === 0 ? "Free" : `${p.currency} ${p.price_amount.toLocaleString()}`}
                    {p.price_amount > 0 && <span className="text-xs text-slate-500 font-medium"> / {p.period}</span>}
                  </p>
                  {p.tagline && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{p.tagline}</p>}
                  <p className="text-[11px] text-slate-500 mt-1">{p.features.length} feature(s) · order {p.sort_order}</p>
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => { setEditing(p); }} className="text-xs px-2 py-1 rounded bg-[#0c2340] text-white font-bold">Edit</button>
                    <button onClick={() => remove(p)} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-3" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white text-[#0c2340] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">{editing.id ? "Edit plan" : "New plan"}</h3>
              <button onClick={() => setEditing(null)} className="text-sm px-2 py-1 rounded bg-[#F5F7FA]">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Code" hint="e.g. pro">
                <input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="planinput" />
              </Field>
              <Field label="Name">
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="planinput" />
              </Field>
              <Field label="Price" hint="0 = Free">
                <input type="number" min={0} value={editing.price_amount} onChange={(e) => setEditing({ ...editing, price_amount: Number(e.target.value) })} className="planinput" />
              </Field>
              <Field label="Currency">
                <input value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className="planinput" />
              </Field>
              <Field label="Period">
                <select value={editing.period} onChange={(e) => setEditing({ ...editing, period: e.target.value })} className="planinput">
                  <option value="month">month</option>
                  <option value="year">year</option>
                  <option value="lifetime">lifetime</option>
                </select>
              </Field>
              <Field label="Sort order">
                <input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="planinput" />
              </Field>
              <Field label="Tagline" full>
                <input value={editing.tagline ?? ""} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} className="planinput" />
              </Field>
              <Field label="CTA label" hint="e.g. Upgrade, Contact us">
                <input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} className="planinput" />
              </Field>
              <Field label="Contact URL" hint="Optional — overrides WhatsApp">
                <input value={editing.contact_url ?? ""} onChange={(e) => setEditing({ ...editing, contact_url: e.target.value })} className="planinput" />
              </Field>
              <Field label="Features" hint="One per line" full>
                <textarea
                  rows={5}
                  value={(editing.features ?? []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value.split("\n") })}
                  className="planinput resize-none"
                />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={editing.is_highlighted} onChange={(e) => setEditing({ ...editing, is_highlighted: e.target.checked })} />
                Mark as most popular
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Active (visible to owners)
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg bg-[#F5F7FA] text-sm font-semibold">Cancel</button>
              <button disabled={saving} onClick={save} className="px-4 py-2 rounded-lg bg-[#FF6B00] text-white text-sm font-bold disabled:opacity-50">
                {saving ? "Saving…" : "Save plan"}
              </button>
            </div>
            <style>{`.planinput{width:100%;padding:8px 10px;border:1px solid rgba(12,35,64,0.15);border-radius:8px;background:#F5F7FA;color:#0c2340;outline:none;font-size:13px}`}</style>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

