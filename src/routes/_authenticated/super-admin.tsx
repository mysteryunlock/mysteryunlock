import { createFileRoute, useRouter, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllShops,
  listAllCustomers,
  setShopActive,
  deleteShop,
  sendOwnerPasswordReset,
  forceSetOwnerPassword,
  signOutOwner,
  getShopDetails,
  updateShopSubscription,
  extendShopPeriod,
  recordShopPayment,
  setShopMinimumProbability,
  getShopAuditLog,
} from "@/lib/shops.functions";
import { listAllPlansAdmin, upsertPlan, deletePlan } from "@/lib/plans.functions";
import { getSiteSettings, updateSiteSetting } from "@/lib/site-settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoleFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Admin — Mystery Unlock" }] }),
  beforeLoad: async () => {
    // Route-level role guard: redirect non-super-admins to the dashboard.
    // Server functions already enforce this at the data layer; this guard
    // prevents the page from rendering at all for regular shop owners.
    const { superAdmin } = await getMyRoleFn();
    if (!superAdmin) throw redirect({ to: "/dashboard" });
  },
  component: SuperAdminPage,
});

type AdminSection = "shops" | "plans" | "site" | "customers";

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

// ──────────────────────────────────────────────
// NAV ITEMS
// ──────────────────────────────────────────────

const NAV: { id: AdminSection; label: string; icon: ReactNode }[] = [
  {
    id: "shops",
    label: "Shops & Users",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "plans",
    label: "Subscription Plans",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: "customers",
    label: "Customers",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "site",
    label: "Landing Page",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
];

// ──────────────────────────────────────────────
// ROOT PAGE
// ──────────────────────────────────────────────

function SuperAdminPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("shops");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F0F2F5" }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-64 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: "#0c2340" }}
      >
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Mystery Unlock</p>
          <p className="text-white font-black text-lg leading-tight">Admin Panel</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => { setSection(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left ${section === item.id ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/8"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-4 px-5 py-4 bg-white border-b border-black/8 flex-shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-[#F0F2F5]"
            onClick={() => setSidebarOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {NAV.find((n) => n.id === section)?.label}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 lg:p-7">
          {section === "shops" && <ShopsSection />}
          {section === "plans" && <PlansSection />}
          {section === "customers" && <CustomersSection />}
          {section === "site" && <SiteSection />}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// SHOPS SECTION
// ──────────────────────────────────────────────

function ShopsSection() {
  const fetchAll = useServerFn(listAllShops);
  const doSetActive = useServerFn(setShopActive);
  const doDelete = useServerFn(deleteShop);
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
  const [search, setSearch] = useState("");

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

  const filtered = shops.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.owner_email ?? "").toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q)
    );
  });

  const total = shops.length;
  const active = shops.filter((s) => s.is_active && s.subscription_status === "active").length;
  const trial = shops.filter((s) => s.subscription_status === "trial").length;
  const suspended = shops.filter((s) => !s.is_active || s.subscription_status === "suspended").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total shops", value: total, color: "#0c2340" },
          { label: "Active", value: active, color: "#16a34a" },
          { label: "Trial", value: trial, color: "#d97706" },
          { label: "Suspended", value: suspended, color: "#dc2626" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-black/5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5">
          <h2 className="font-bold text-[#0c2340]">All shops</h2>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, slug…"
              className="text-sm px-3 py-1.5 rounded-lg border border-black/10 bg-[#F0F2F5] outline-none focus:border-[#0c2340]/30 w-52"
            />
            <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-[#0c2340] text-white font-bold">Refresh</button>
          </div>
        </div>

        {msg && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-[#F0F2F5] text-sm text-[#0c2340]">{msg}</div>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : err ? (
          <div className="p-8 text-center text-red-500 text-sm">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No shops found.</div>
        ) : (
          <div className="divide-y divide-black/5">
            {filtered.map((s) => (
              <div key={s.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-black/5" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#F0F2F5] flex-shrink-0 grid place-items-center text-[10px] text-slate-400 font-bold">
                        {s.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#0c2340] truncate">{s.name}</p>
                        <a
                          href={`/s/${s.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-slate-400 hover:text-[#0c2340] truncate"
                        >
                          /s/{s.slug} ↗
                        </a>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {s.owner_email || (s.owner_user_id ? "Owner (no email)" : "Unclaimed")}
                        {s.owner_email_confirmed_at
                          ? <span className="ml-1.5 inline-flex items-center text-emerald-600 font-medium"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg></span>
                          : s.owner_user_id
                          ? <span className="ml-1.5 text-amber-500 font-medium">unverified</span>
                          : null}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <StatusBadge active={s.is_active} status={s.subscription_status} />
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#0c2340]/8 text-[#0c2340] uppercase">{s.plan}</span>
                        <span className="text-[11px] text-slate-400">{s.spins_count} spins · {s.codes_count} codes</span>
                        <span className="text-[11px] text-slate-400">joined {new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-wrap text-xs flex-shrink-0">
                    <button
                      onClick={() => openDetails(s.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0c2340] text-white font-bold"
                    >
                      Details
                    </button>
                    <button
                      onClick={async () => { await doSetActive({ data: { id: s.id, is_active: !s.is_active } }); load(); }}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold ${s.is_active ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                    >
                      {s.is_active ? "Suspend" : "Reactivate"}
                    </button>
                    {s.owner_user_id && (
                      <>
                        <button
                          disabled={busy === `r${s.id}`}
                          onClick={() => run(`r${s.id}`, () => doReset({ data: { shopId: s.id, redirectTo: `${window.location.origin}/auth` } }), `Reset email sent to ${s.owner_email}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold disabled:opacity-50"
                        >
                          {busy === `r${s.id}` ? "…" : "Send reset"}
                        </button>
                        <button
                          disabled={busy === `p${s.id}`}
                          onClick={() => {
                            const pw = prompt(`Force-set password for ${s.owner_email}\n(min 8 chars — owner will be signed out everywhere)`);
                            if (!pw) return;
                            run(`p${s.id}`, () => doForcePw({ data: { shopId: s.id, password: pw } }), "Password updated.");
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-semibold disabled:opacity-50"
                        >
                          {busy === `p${s.id}` ? "…" : "Force pw"}
                        </button>
                        <button
                          disabled={busy === `o${s.id}`}
                          onClick={() => { if (!confirm("Sign this owner out of all devices?")) return; run(`o${s.id}`, () => doSignOut({ data: { shopId: s.id } }), "Owner signed out."); }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold disabled:opacity-50"
                        >
                          {busy === `o${s.id}` ? "…" : "Sign out all"}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { if (confirm(`Delete shop "${s.name}" and ALL its data?`)) { doDelete({ data: { id: s.id } }).then(load); } }}
                      className="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openId && (
        <div
          className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/8 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-[#0c2340] text-lg">Shop details</h2>
              <button onClick={() => setOpenId(null)} className="text-sm px-3 py-1.5 rounded-lg bg-[#F0F2F5] font-semibold">Close</button>
            </div>

            {detailsLoading || !details ? (
              <div className="p-8 text-center text-slate-400">Loading…</div>
            ) : (
              <div className="p-6 space-y-6 text-sm">
                <div className="flex gap-4 items-center">
                  {details.shop.logo_url ? (
                    <img src={details.shop.logo_url} className="w-16 h-16 rounded-xl object-cover border border-black/8" alt="" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#F0F2F5] grid place-items-center text-lg font-black text-slate-400">
                      {details.shop.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-base text-[#0c2340]">{details.shop.name}</p>
                    <a href={`/s/${details.shop.slug}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-slate-400 hover:text-[#0c2340]">/s/{details.shop.slug} ↗</a>
                  </div>
                </div>

                <section>
                  <SectionTitle>Owner account</SectionTitle>
                  {details.owner ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mt-2">
                      <Kv k="Email" v={details.owner.email ?? "—"} />
                      <Kv k="Email confirmed" v={fmt(details.owner.email_confirmed_at)} />
                      <Kv k="Last sign-in" v={fmt(details.owner.last_sign_in_at)} />
                      <Kv k="Account created" v={fmt(details.owner.created_at)} />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">Unclaimed shop.</p>
                  )}
                </section>

                <SubscriptionSection
                  shop={details.shop as SubShop}
                  payments={(details as unknown as { payments: SubPayment[] }).payments ?? []}
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

                <MinProbSection
                  shopId={details.shop.id}
                  currentMin={(details.shop as any).minimum_probability ?? 5}
                  onUpdated={async () => {
                    const d = await fetchDetails({ data: { shopId: details.shop.id } });
                    setDetails(d);
                  }}
                />

                <AuditLogSection shopId={details.shop.id} />

                <section>
                  <SectionTitle>Prizes ({details.prizes.length})</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {details.prizes.length === 0 && <p className="text-xs text-slate-400 col-span-3">No prizes.</p>}
                    {details.prizes.map((p) => (
                      <div key={p.id} className="rounded-xl bg-[#F0F2F5] p-2.5 text-xs flex items-center gap-2">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-slate-200" />}
                        <div className="min-w-0">
                          <p className="font-bold truncate text-[#0c2340]">{p.name}</p>
                          <p className="text-slate-500">{p.is_win ? "win" : "lose"} · p={p.probability}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionTitle>Recent spins ({details.spins.length})</SectionTitle>
                  <div className="mt-2 rounded-xl overflow-hidden border border-black/8">
                    <table className="w-full text-xs">
                      <thead className="bg-[#F0F2F5] text-left">
                        <tr>
                          {["When", "Customer", "Contact", "Email", "Code", "Prize"].map((h) => (
                            <th key={h} className="px-3 py-2 font-bold text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {details.spins.length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No spins yet.</td></tr>
                        )}
                        {details.spins.map((s) => (
                          <tr key={s.code} className="hover:bg-[#F0F2F5]/50">
                            <td className="px-3 py-2 whitespace-nowrap text-slate-500">{fmt(s.spun_at)}</td>
                            <td className="px-3 py-2">{s.customer_name ?? "—"}</td>
                            <td className="px-3 py-2">{s.customer_contact ?? "—"}</td>
                            <td className="px-3 py-2">{s.customer_email ?? "—"}</td>
                            <td className="px-3 py-2 font-mono">{s.code}</td>
                            <td className="px-3 py-2 font-medium text-[#0c2340]">{s.prize_won ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <SectionTitle>Access codes ({details.codes.length})</SectionTitle>
                  <div className="mt-2 rounded-xl overflow-hidden border border-black/8">
                    <table className="w-full text-xs">
                      <thead className="bg-[#F0F2F5] text-left">
                        <tr>
                          {["Code", "Used", "Customer", "Contact", "Prize", "Created"].map((h) => (
                            <th key={h} className="px-3 py-2 font-bold text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {details.codes.length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No codes.</td></tr>
                        )}
                        {details.codes.map((c) => (
                          <tr key={c.code} className="hover:bg-[#F0F2F5]/50">
                            <td className="px-3 py-2 font-mono">{c.code}</td>
                            <td className="px-3 py-2">{c.is_used ? <span className="text-emerald-600 font-bold">yes</span> : <span className="text-slate-400">no</span>}</td>
                            <td className="px-3 py-2">{c.customer_name ?? "—"}</td>
                            <td className="px-3 py-2">{c.customer_contact ?? "—"}</td>
                            <td className="px-3 py-2 font-medium text-[#0c2340]">{c.prize_won ?? "—"}</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
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

// ──────────────────────────────────────────────
// CUSTOMERS SECTION
// ──────────────────────────────────────────────

type AdminCustomer = {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
  connected_shops: number;
};

function CustomersSection() {
  const fetchAll = useServerFn(listAllCustomers);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetchAll();
      setCustomers(res.customers as AdminCustomer[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q)
    );
  });

  const withShops = customers.filter((c) => c.connected_shops > 0).length;
  const withPhone = customers.filter((c) => !!c.phone).length;
  const today = customers.filter((c) => {
    return Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000) === 0;
  }).length;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total customers", value: loading ? "…" : customers.length, color: "#0c2340" },
          { label: "Connected to shops", value: loading ? "…" : withShops, color: "#16a34a" },
          { label: "With phone", value: loading ? "…" : withPhone, color: "#2563eb" },
          { label: "Joined today", value: loading ? "…" : today, color: "#d97706" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-black/5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5">
          <h2 className="font-bold text-[#0c2340]">All customers</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email or phone…"
                className="text-sm pl-8 pr-3 py-1.5 rounded-lg border border-black/10 bg-[#F0F2F5] outline-none focus:border-[#0c2340]/30 w-52"
              />
            </div>
            <button
              onClick={load}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#0c2340] text-white font-bold"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : err ? (
          <div className="p-8 text-center text-red-500 text-sm">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {search ? "No customers match your search." : "No customers yet."}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F0F2F5]">
                  <tr>
                    {["Name", "Email", "Phone", "Shops", "Status", "Joined"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#0c2340]">
                        {c.name || <span className="text-slate-400 font-normal italic">Anonymous</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.email}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="hover:text-[#0c2340] hover:underline">{c.phone}</a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                          c.connected_shops > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {c.connected_shops} shop{c.connected_shops !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                          c.auth_user_id
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {c.auth_user_id ? "Active" : "Guest"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="lg:hidden divide-y divide-black/5">
              {filtered.map((c) => (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="w-full px-4 py-4 text-left flex items-start justify-between gap-3 hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#0c2340] truncate">
                        {c.name || <span className="italic text-slate-400 font-normal">Anonymous</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">{c.email}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          c.connected_shops > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {c.connected_shops} shop{c.connected_shops !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${expanded === c.id ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {expanded === c.id && (
                    <div className="px-4 pb-4 grid grid-cols-2 gap-2 text-xs bg-[#F9FAFB]">
                      <div>
                        <p className="text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Phone</p>
                        <p className="text-[#0c2340]">{c.phone || "—"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Status</p>
                        <p className={c.auth_user_id ? "text-emerald-700 font-bold" : "text-slate-500"}>{c.auth_user_id ? "Active" : "Guest"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Joined</p>
                        <p className="text-[#0c2340]">{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Connected shops</p>
                        <p className="text-[#0c2340] font-bold">{c.connected_shops}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-black/5 text-xs text-slate-400">
              Showing {filtered.length}{filtered.length !== customers.length ? ` of ${customers.length}` : ""} customer{customers.length !== 1 ? "s" : ""}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// PLANS SECTION
// ──────────────────────────────────────────────

function PlansSection() {
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-[#0c2340] text-lg">Subscription Plans</h2>
        <p className="text-sm text-slate-400 mt-0.5">Plans are shown to shop owners on the /billing page.</p>
      </div>
      {msg && <div className="px-4 py-2.5 rounded-xl bg-white border border-black/8 text-sm text-[#0c2340]">{msg}</div>}
      <PlansManager onMsg={setMsg} />
    </div>
  );
}

// ──────────────────────────────────────────────
// SITE / LANDING PAGE SECTION
// ──────────────────────────────────────────────

type HeroSettings = {
  badge: string;
  title_main: string;
  title_highlight: string;
  subtitle: string;
  cta_primary: string;
  cta_secondary: string;
};

type AnnouncementSettings = {
  enabled: boolean;
  text: string;
  link: string;
};

type ContactSettings = {
  whatsapp: string;
  email: string;
};

type StatItem = { value: string; label: string };
type FeatureItem = { t: string; desc: string };
type TestimonialItem = { n: string; r: string; q: string };
type FaqItem = { q: string; a: string };
type FinalCtaSettings = { heading: string; subtitle: string; cta_primary: string; cta_secondary: string };
type WhyChooseUsItem = { title: string; desc: string };
type WhyChooseUsSettings = { heading: string; items: WhyChooseUsItem[] };
type SectionHeadingSettings = { heading: string; subtitle: string };
type HowItWorksStepItem = { title: string; description: string };
type HowItWorksSettingsData = { heading: string; subtitle: string; steps: HowItWorksStepItem[] };
type FeatureCardItem = { title: string; description: string };
type FeaturesSectionSettings = { heading: string; subtitle: string; business_label: string; customer_label: string; business: FeatureCardItem[]; customer: FeatureCardItem[] };
type HowToLaunchStepItem = { title: string; subtitle: string };
type HowToLaunchSettingsData = { heading: string; subtitle: string; steps: HowToLaunchStepItem[] };
type FooterSettingsData = { business_name: string; tagline: string; email: string; whatsapp: string; address: string; facebook: string; instagram: string; twitter: string };
type ThemeSettingsData = { accent: string; primary: string };
type SeoSettingsData = { title: string; description: string; og_title: string; og_description: string };
type CmsToastItem = { id: number; msg: string; type: "ok" | "err" };
type CmsPanel =
  | "announcement" | "hero" | "stats" | "trusted_by" | "contact"
  | "whyChooseUs" | "howItWorks" | "features" | "dashboardPreview"
  | "customerExperience" | "realResults" | "industryShowcase"
  | "whoItsFor" | "howToLaunch" | "pricing"
  | "testimonials" | "faqs" | "finalCta" | "footer"
  | "media" | "theme" | "seo";

const DEFAULT_HERO: HeroSettings = {
  badge: "New · Premium spin SaaS",
  title_main: "Turn every visit into a",
  title_highlight: "memorable spin.",
  subtitle: "Mystery Unlock is the elegant, modern way to run spin-to-win campaigns. Brand your wheel, share a QR, and track every winner from one beautiful dashboard.",
  cta_primary: "Start Free",
  cta_secondary: "Watch Demo",
};

const DEFAULT_ANNOUNCEMENT: AnnouncementSettings = { enabled: false, text: "", link: "" };
const DEFAULT_CONTACT: ContactSettings = { whatsapp: "9779769402069", email: "" };
const DEFAULT_STATS: StatItem[] = [
  { value: "10k+", label: "Spins delivered" },
  { value: "98%", label: "Customer delight" },
  { value: "<1m", label: "Setup time" },
];
const DEFAULT_TRUSTED_BY = ["MAS ZONE", "Glow Studio", "Kathmandu Cafe", "Aura Salon", "Velvet Boutique", "North Co."];
const DEFAULT_FEATURES: FeatureItem[] = [
  { t: "Spin Wheel", desc: "Beautifully smooth, fully branded wheels customers love to spin." },
  { t: "Smart Rewards", desc: "Tune win probabilities per prize and cap inventory in real time." },
  { t: "Instant QR Code", desc: "One-tap QR for posters, receipts, and storefronts — no app install." },
  { t: "Live Analytics", desc: "Track spins, wins, conversion, and ROI from a single dashboard." },
  { t: "Your Branding", desc: "Custom logo, colors, and slug — your shop, your identity." },
  { t: "Bank-grade Security", desc: "Row-level isolation, signed access codes, and audited backups." },
];
const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  { n: "Anisha Rai", r: "Boutique Owner", q: "Foot traffic jumped 38% the week we launched. Customers love it." },
  { n: "Bikash Shrestha", r: "Cafe Manager", q: "Setup took five minutes. The dashboard is genuinely beautiful." },
  { n: "Priya Karki", r: "Salon Founder", q: "Our regulars come back just to spin again. Best retention tool we've used." },
];
const DEFAULT_FAQS: FaqItem[] = [
  { q: "How quickly can I launch a campaign?", a: "Under 2 minutes — create an account, name your shop, upload prizes, and share the QR code. No app install required for your customers." },
  { q: "Do my customers need an app?", a: "No. They scan your QR code with any phone camera and spin in the browser. The page is a fast, installable PWA if they want to save it." },
  { q: "Can I control prize odds?", a: "Yes — set weighted probabilities per prize and adjust them anytime. The atomic spin engine guarantees fair, tamper-proof outcomes." },
  { q: "What about my brand?", a: "Upload your logo and pick your slug. The spin page, QR, and result screens all reflect your brand identity end-to-end." },
  { q: "Is my customer data safe?", a: "Yes. Every shop runs in an isolated row-level secure environment, with signed access codes and encrypted storage." },
  { q: "Can I cancel anytime?", a: "Absolutely. Plans are month-to-month, no contracts. Your data stays exportable as CSV at all times." },
];
const DEFAULT_FINAL_CTA: FinalCtaSettings = {
  heading: "Ready to spin up something delightful?",
  subtitle: "Join shops creating moments customers come back for. Free to start, simple to scale.",
  cta_primary: "Start Free",
  cta_secondary: "Talk to Sales",
};
const DEFAULT_WHY_CHOOSE_US: WhyChooseUsSettings = {
  heading: "Why Businesses Choose Mystery Unlock",
  items: [
    { title: "Increase Repeat Customers", desc: "Turn one-time buyers into loyal customers with engaging reward campaigns." },
    { title: "Reward Every Purchase", desc: "Launch customizable spin campaigns with digital prizes and instant rewards." },
    { title: "Real-Time Analytics", desc: "Track campaign performance, customer engagement, and reward distribution." },
    { title: "Customer Engagement", desc: "Reconnect with customers using promotions, announcements, and loyalty campaigns." },
  ],
};

const DEFAULT_HOW_IT_WORKS: HowItWorksSettingsData = {
  heading: "How Mystery Unlock Works",
  subtitle: "Launch a campaign in minutes and turn every scan into an engaging customer experience.",
  steps: [
    { title: "Create Campaign", description: "Set up your campaign, choose dates, customize branding, and define campaign rules." },
    { title: "Add Rewards", description: "Add discounts, free products, vouchers, loyalty points, or mystery prizes." },
    { title: "Share QR Code", description: "Print your QR code or display it digitally so customers can participate instantly." },
    { title: "Customers Unlock Rewards", description: "Customers scan the QR code, enjoy the interactive unlock experience, and instantly reveal their reward." },
    { title: "Track Results", description: "Monitor scans, conversions, reward claims, and campaign performance from your dashboard." },
  ],
};

const DEFAULT_FEATURES_SECTION: FeaturesSectionSettings = {
  heading: "Everything You Need to Grow Your Business",
  subtitle: "Mystery Unlock gives both businesses and customers a complete loyalty ecosystem.",
  business_label: "For Businesses",
  customer_label: "For Customers",
  business: [
    { title: "Campaign Management", description: "Plan, launch, and manage every spin-to-win campaign from one place." },
    { title: "Customer CRM", description: "Keep a complete profile of every customer who engages with your shop." },
    { title: "Analytics Dashboard", description: "See spins, conversions, and revenue impact in real time." },
    { title: "QR Campaigns", description: "Generate branded QR codes customers can scan anywhere, instantly." },
    { title: "Broadcast Messaging", description: "Send promotions and announcements straight to engaged customers." },
    { title: "Loyalty & Membership", description: "Reward repeat customers with tiers, points, and membership perks." },
  ],
  customer: [
    { title: "Rewards Wallet", description: "Every prize and voucher saved in one place, ready to redeem." },
    { title: "Purchase History", description: "A clear, running record of every visit and reward earned." },
    { title: "Membership Levels", description: "Unlock better rewards and perks the more customers engage." },
    { title: "Achievement Badges", description: "Fun milestones that celebrate loyalty and repeat visits." },
    { title: "Personalized Offers", description: "Relevant promotions and rewards tailored to each customer." },
    { title: "Mobile Friendly Experience", description: "A fast, app-like experience that works on any phone, no install needed." },
  ],
};

const DEFAULT_DASHBOARD_PREVIEW: SectionHeadingSettings = {
  heading: "Manage Everything From One Beautiful Dashboard",
  subtitle: "Track campaigns, customers, rewards, and business growth from a single, intuitive dashboard.",
};

const DEFAULT_CUSTOMER_EXPERIENCE: SectionHeadingSettings = {
  heading: "A Customer Experience They'll Love",
  subtitle: "Every purchase becomes more rewarding with a modern digital loyalty experience that keeps customers coming back.",
};

const DEFAULT_REAL_RESULTS: SectionHeadingSettings = {
  heading: "Numbers shops don't stop talking about",
  subtitle: "From boutiques to cafés to salons — Mystery Unlock delivers measurable growth from the very first campaign.",
};

const DEFAULT_INDUSTRY_SHOWCASE: SectionHeadingSettings = {
  heading: "Whatever you sell, Mystery Unlock fits",
  subtitle: "From the morning coffee rush to the weekend boutique drop — every business type has a campaign waiting to launch.",
};

const DEFAULT_WHO_ITS_FOR: SectionHeadingSettings = {
  heading: "Works for every kind of shop",
  subtitle: "Mystery Unlock isn't a one-size-fits-all loyalty tool — it's shaped around how each business type actually works.",
};

const DEFAULT_HOW_TO_LAUNCH: HowToLaunchSettingsData = {
  heading: "Up and running in under 2 minutes.",
  subtitle: "No developer. No agency. No waiting. Five steps and your first campaign is live.",
  steps: [
    { title: "Create your account", subtitle: "No credit card, no setup fee" },
    { title: "Build your campaign", subtitle: "Name it, set prizes, adjust the odds" },
    { title: "Add your branding", subtitle: "Upload logo, pick colors, set your slug" },
    { title: "Share your QR code", subtitle: "Print, display, or share on WhatsApp" },
    { title: "Watch results roll in", subtitle: "Real-time dashboard, every spin tracked" },
  ],
};

const DEFAULT_PRICING_SECTION: SectionHeadingSettings = {
  heading: "Simple, transparent pricing.",
  subtitle: "One plan for every stage of your business. No hidden fees, no lock-in.",
};

const DEFAULT_FOOTER: FooterSettingsData = {
  business_name: "Mystery Unlock",
  tagline: "Premium spin-to-win SaaS for boutique shops, salons, and cafes.",
  email: "support@mysteryunlock.com",
  whatsapp: "9769402069",
  address: "",
  facebook: "",
  instagram: "",
  twitter: "",
};

const DEFAULT_THEME: ThemeSettingsData = {
  accent: "#FF6B1A",
  primary: "#2A3E4B",
};

const DEFAULT_SEO: SeoSettingsData = {
  title: "Mystery Unlock — Premium spin-to-win campaigns for modern shops",
  description: "Run elegant spin-to-win campaigns. Brand your wheel, share a QR, and watch every win in a beautiful dashboard.",
  og_title: "Mystery Unlock — Spin · Win · Enjoy",
  og_description: "Premium spin-to-win SaaS for boutique shops. Brand, share, and track campaigns customers remember.",
};

// Landing-page anchor for each panel's "Preview" link
const PANEL_ANCHOR: Partial<Record<CmsPanel, string>> = {
  hero: "/", announcement: "/", stats: "/", trusted_by: "/", contact: "/",
  whyChooseUs: "/#why-choose-us", howItWorks: "/#how-it-works", features: "/#features",
  dashboardPreview: "/#dashboard-preview", customerExperience: "/#customer-experience",
  realResults: "/#real-results", industryShowcase: "/#industry-showcase",
  whoItsFor: "/#who-its-for", howToLaunch: "/#how-to-launch", pricing: "/#pricing",
  testimonials: "/#testimonials", faqs: "/#faq", finalCta: "/#final-cta",
  footer: "/#footer", theme: "/", seo: "/",
};

const NAV_LABEL: Partial<Record<CmsPanel, string>> = {
  hero: "Hero", announcement: "Announcement", stats: "Hero Stats", trusted_by: "Trusted By",
  contact: "Contact Info", whyChooseUs: "Why Choose Us", howItWorks: "How It Works",
  features: "Features", dashboardPreview: "Dashboard Preview", customerExperience: "Customer Experience",
  realResults: "Real Results", industryShowcase: "Industry Showcase", whoItsFor: "Who It's For",
  howToLaunch: "How To Launch", pricing: "Pricing", testimonials: "Testimonials", faqs: "FAQ",
  finalCta: "Final CTA", footer: "Footer", theme: "Theme", seo: "SEO",
};

function SiteSection() {
  const router = useRouter();
  const fetchSettings = useServerFn(getSiteSettings);
  const doUpdate = useServerFn(updateSiteSetting);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePanelState, setActivePanelRaw] = useState<CmsPanel>("hero");

  // ── Panel states ─────────────────────────────────────────────────────────────
  const [hero, setHero] = useState<HeroSettings>(DEFAULT_HERO);
  const [announcement, setAnnouncement] = useState<AnnouncementSettings>(DEFAULT_ANNOUNCEMENT);
  const [contact, setContact] = useState<ContactSettings>(DEFAULT_CONTACT);
  const [stats, setStats] = useState<StatItem[]>(DEFAULT_STATS);
  const [trustedBy, setTrustedBy] = useState<string>(DEFAULT_TRUSTED_BY.join(", "));
  const [whyChooseUs, setWhyChooseUs] = useState<WhyChooseUsSettings>(DEFAULT_WHY_CHOOSE_US);
  const [features, setFeatures] = useState<FeatureItem[]>(DEFAULT_FEATURES);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>(DEFAULT_TESTIMONIALS);
  const [faqs, setFaqs] = useState<FaqItem[]>(DEFAULT_FAQS);
  const [finalCta, setFinalCta] = useState<FinalCtaSettings>(DEFAULT_FINAL_CTA);
  const [howItWorks, setHowItWorks] = useState<HowItWorksSettingsData>(DEFAULT_HOW_IT_WORKS);
  const [featuresSection, setFeaturesSection] = useState<FeaturesSectionSettings>(DEFAULT_FEATURES_SECTION);
  const [dashboardPreview, setDashboardPreview] = useState<SectionHeadingSettings>(DEFAULT_DASHBOARD_PREVIEW);
  const [customerExperience, setCustomerExperience] = useState<SectionHeadingSettings>(DEFAULT_CUSTOMER_EXPERIENCE);
  const [realResults, setRealResults] = useState<SectionHeadingSettings>(DEFAULT_REAL_RESULTS);
  const [industryShowcase, setIndustryShowcase] = useState<SectionHeadingSettings>(DEFAULT_INDUSTRY_SHOWCASE);
  const [whoItsFor, setWhoItsFor] = useState<SectionHeadingSettings>(DEFAULT_WHO_ITS_FOR);
  const [howToLaunch, setHowToLaunch] = useState<HowToLaunchSettingsData>(DEFAULT_HOW_TO_LAUNCH);
  const [pricingSection, setPricingSection] = useState<SectionHeadingSettings>(DEFAULT_PRICING_SECTION);
  const [footerSettings, setFooterSettings] = useState<FooterSettingsData>(DEFAULT_FOOTER);
  const [themeSettings, setThemeSettings] = useState<ThemeSettingsData>(DEFAULT_THEME);
  const [seoSettings, setSeoSettings] = useState<SeoSettingsData>(DEFAULT_SEO);

  // ── Dirty tracking ────────────────────────────────────────────────────────────
  const dirtyRef = useRef<Set<CmsPanel>>(new Set());
  const [dirtyIndicator, setDirtyIndicator] = useState<CmsPanel[]>([]);
  const markDirty = useCallback((panel: CmsPanel) => {
    if (!dirtyRef.current.has(panel)) {
      dirtyRef.current.add(panel);
      setDirtyIndicator((prev) => [...prev, panel]);
    }
  }, []);
  const markClean = useCallback((panel: CmsPanel) => {
    if (dirtyRef.current.has(panel)) {
      dirtyRef.current.delete(panel);
      setDirtyIndicator((prev) => prev.filter((p) => p !== panel));
    }
  }, []);
  const clearAllDirty = useCallback(() => {
    dirtyRef.current.clear();
    setDirtyIndicator([]);
  }, []);

  // ── Toast system ──────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<CmsToastItem[]>([]);
  const toastCounter = useRef(0);
  const showToast = useCallback((msg: string, type: "ok" | "err") => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  // ── Validation error ──────────────────────────────────────────────────────────
  const [valErr, setValErr] = useState("");

  // ── Drag-and-drop state ───────────────────────────────────────────────────────
  const dragIdxRef = useRef<number | null>(null);
  const dragListRef = useRef<"testimonials" | "faqs" | null>(null);
  const [dragOver, setDragOver] = useState<{ list: string; idx: number } | null>(null);

  // ── Panel switch with dirty warning ──────────────────────────────────────────
  const setActivePanel = useCallback((next: CmsPanel) => {
    if (activePanelState !== next && dirtyRef.current.has(activePanelState)) {
      const label = NAV_LABEL[activePanelState] ?? activePanelState;
      if (!window.confirm(`"${label}" has unsaved changes. Leave without saving?`)) return;
    }
    setValErr("");
    setActivePanelRaw(next);
  }, [activePanelState]);

  const activePanel = activePanelState;

  // ── Warn on page leave ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── Dirty setters (mark panel dirty on every field change) ────────────────────
  const dHero = (v: HeroSettings) => { setHero(v); markDirty("hero"); };
  const dAnn = (v: AnnouncementSettings) => { setAnnouncement(v); markDirty("announcement"); };
  const dContact = (v: ContactSettings) => { setContact(v); markDirty("contact"); };
  const dStats = (v: StatItem[]) => { setStats(v); markDirty("stats"); };
  const dTrustedBy = (v: string) => { setTrustedBy(v); markDirty("trusted_by"); };
  const dWhyChooseUs = (v: WhyChooseUsSettings) => { setWhyChooseUs(v); markDirty("whyChooseUs"); };
  const dFeatures = (v: FeatureItem[]) => { setFeatures(v); markDirty("features"); };
  const dTestimonials = (v: TestimonialItem[]) => { setTestimonials(v); markDirty("testimonials"); };
  const dFaqs = (v: FaqItem[]) => { setFaqs(v); markDirty("faqs"); };
  const dFinalCta = (v: FinalCtaSettings) => { setFinalCta(v); markDirty("finalCta"); };
  const dHowItWorks = (v: HowItWorksSettingsData) => { setHowItWorks(v); markDirty("howItWorks"); };
  const dFeaturesSection = (v: FeaturesSectionSettings) => { setFeaturesSection(v); markDirty("features"); };
  const dDashboardPreview = (v: SectionHeadingSettings) => { setDashboardPreview(v); markDirty("dashboardPreview"); };
  const dCustomerExperience = (v: SectionHeadingSettings) => { setCustomerExperience(v); markDirty("customerExperience"); };
  const dRealResults = (v: SectionHeadingSettings) => { setRealResults(v); markDirty("realResults"); };
  const dIndustryShowcase = (v: SectionHeadingSettings) => { setIndustryShowcase(v); markDirty("industryShowcase"); };
  const dWhoItsFor = (v: SectionHeadingSettings) => { setWhoItsFor(v); markDirty("whoItsFor"); };
  const dHowToLaunch = (v: HowToLaunchSettingsData) => { setHowToLaunch(v); markDirty("howToLaunch"); };
  const dPricingSection = (v: SectionHeadingSettings) => { setPricingSection(v); markDirty("pricing"); };
  const dFooterSettings = (v: FooterSettingsData) => { setFooterSettings(v); markDirty("footer"); };
  const dThemeSettings = (v: ThemeSettingsData) => { setThemeSettings(v); markDirty("theme"); };
  const dSeoSettings = (v: SeoSettingsData) => { setSeoSettings(v); markDirty("seo"); };

  // suppress unused warning for legacy features setter
  void dFeatures;

  // ── Load ──────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { settings } = await fetchSettings();
      if (settings.hero) setHero({ ...DEFAULT_HERO, ...(settings.hero as HeroSettings) });
      if (settings.announcement) setAnnouncement({ ...DEFAULT_ANNOUNCEMENT, ...(settings.announcement as AnnouncementSettings) });
      if (settings.contact) setContact({ ...DEFAULT_CONTACT, ...(settings.contact as ContactSettings) });
      if (settings.stats) setStats(settings.stats as StatItem[]);
      if (settings.trusted_by) setTrustedBy((settings.trusted_by as string[]).join(", "));
      if (settings.whyChooseUs) setWhyChooseUs({ ...DEFAULT_WHY_CHOOSE_US, ...(settings.whyChooseUs as WhyChooseUsSettings) });
      if (settings.features) setFeatures(settings.features as FeatureItem[]);
      if (settings.testimonials) setTestimonials(settings.testimonials as TestimonialItem[]);
      if (settings.faqs) setFaqs(settings.faqs as FaqItem[]);
      if (settings.finalCta) setFinalCta({ ...DEFAULT_FINAL_CTA, ...(settings.finalCta as FinalCtaSettings) });
      if (settings.howItWorks) setHowItWorks({ ...DEFAULT_HOW_IT_WORKS, ...(settings.howItWorks as HowItWorksSettingsData) });
      if (settings.featuresSection) setFeaturesSection({ ...DEFAULT_FEATURES_SECTION, ...(settings.featuresSection as FeaturesSectionSettings) });
      if (settings.dashboardPreview) setDashboardPreview({ ...DEFAULT_DASHBOARD_PREVIEW, ...(settings.dashboardPreview as SectionHeadingSettings) });
      if (settings.customerExperience) setCustomerExperience({ ...DEFAULT_CUSTOMER_EXPERIENCE, ...(settings.customerExperience as SectionHeadingSettings) });
      if (settings.realResults) setRealResults({ ...DEFAULT_REAL_RESULTS, ...(settings.realResults as SectionHeadingSettings) });
      if (settings.industryShowcase) setIndustryShowcase({ ...DEFAULT_INDUSTRY_SHOWCASE, ...(settings.industryShowcase as SectionHeadingSettings) });
      if (settings.whoItsFor) setWhoItsFor({ ...DEFAULT_WHO_ITS_FOR, ...(settings.whoItsFor as SectionHeadingSettings) });
      if (settings.howToLaunch) setHowToLaunch({ ...DEFAULT_HOW_TO_LAUNCH, ...(settings.howToLaunch as HowToLaunchSettingsData) });
      if (settings.pricingSection) setPricingSection({ ...DEFAULT_PRICING_SECTION, ...(settings.pricingSection as SectionHeadingSettings) });
      if (settings.footer) setFooterSettings({ ...DEFAULT_FOOTER, ...(settings.footer as FooterSettingsData) });
      if (settings.theme) setThemeSettings({ ...DEFAULT_THEME, ...(settings.theme as ThemeSettingsData) });
      if (settings.seo) setSeoSettings({ ...DEFAULT_SEO, ...(settings.seo as SeoSettingsData) });
      clearAllDirty();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load settings", "err");
    } finally { setLoading(false); }
  }, [fetchSettings, clearAllDirty, showToast]);

  useEffect(() => { load(); }, [load]);

  // ── Validation ────────────────────────────────────────────────────────────────
  const validatePanel = (panel: CmsPanel): string => {
    switch (panel) {
      case "hero": return !hero.title_main.trim() ? "Heading — first line is required." : "";
      case "announcement": return (announcement.enabled && !announcement.text.trim()) ? "Banner text is required when the banner is enabled." : "";
      case "finalCta": return !finalCta.heading.trim() ? "Heading is required." : "";
      case "seo": return !seoSettings.title.trim() ? "Page title is required." : "";
      case "testimonials": return testimonials.some((t) => !t.n.trim() || !t.q.trim()) ? "All testimonials need a name and a quote." : "";
      case "faqs": return faqs.some((f) => !f.q.trim()) ? "All FAQ items need a question." : "";
      case "whyChooseUs": return !whyChooseUs.heading.trim() ? "Heading is required." : "";
      case "howItWorks": return !howItWorks.heading.trim() ? "Heading is required." : "";
      case "features": return !featuresSection.heading.trim() ? "Heading is required." : "";
      case "howToLaunch": return !howToLaunch.heading.trim() ? "Heading is required." : "";
      case "footer": return !footerSettings.business_name.trim() ? "Business name is required." : "";
      case "pricing": return !pricingSection.heading.trim() ? "Heading is required." : "";
      default: return "";
    }
  };

  // ── Restore defaults ──────────────────────────────────────────────────────────
  const restoreDefaults = (panel: CmsPanel) => {
    const label = NAV_LABEL[panel] ?? panel;
    if (!window.confirm(`Reset "${label}" to its default values? You'll still need to save.`)) return;
    switch (panel) {
      case "hero": setHero(DEFAULT_HERO); break;
      case "announcement": setAnnouncement(DEFAULT_ANNOUNCEMENT); break;
      case "stats": setStats(DEFAULT_STATS); break;
      case "trusted_by": setTrustedBy(DEFAULT_TRUSTED_BY.join(", ")); break;
      case "contact": setContact(DEFAULT_CONTACT); break;
      case "whyChooseUs": setWhyChooseUs(DEFAULT_WHY_CHOOSE_US); break;
      case "testimonials": setTestimonials(DEFAULT_TESTIMONIALS); break;
      case "faqs": setFaqs(DEFAULT_FAQS); break;
      case "finalCta": setFinalCta(DEFAULT_FINAL_CTA); break;
      case "howItWorks": setHowItWorks(DEFAULT_HOW_IT_WORKS); break;
      case "features": setFeaturesSection(DEFAULT_FEATURES_SECTION); break;
      case "dashboardPreview": setDashboardPreview(DEFAULT_DASHBOARD_PREVIEW); break;
      case "customerExperience": setCustomerExperience(DEFAULT_CUSTOMER_EXPERIENCE); break;
      case "realResults": setRealResults(DEFAULT_REAL_RESULTS); break;
      case "industryShowcase": setIndustryShowcase(DEFAULT_INDUSTRY_SHOWCASE); break;
      case "whoItsFor": setWhoItsFor(DEFAULT_WHO_ITS_FOR); break;
      case "howToLaunch": setHowToLaunch(DEFAULT_HOW_TO_LAUNCH); break;
      case "pricing": setPricingSection(DEFAULT_PRICING_SECTION); break;
      case "footer": setFooterSettings(DEFAULT_FOOTER); break;
      case "theme": setThemeSettings(DEFAULT_THEME); break;
      case "seo": setSeoSettings(DEFAULT_SEO); break;
    }
    markDirty(panel);
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const save = async (key: string, value: unknown) => {
    const errMsg = validatePanel(activePanel);
    if (errMsg) { setValErr(errMsg); return; }
    setValErr("");
    setSaving(key);
    try {
      await doUpdate({ data: { key, value } });
      await router.invalidate();
      try { new BroadcastChannel("mu_settings_updated").postMessage("updated"); } catch {}
      markClean(activePanel);
      showToast("Saved! Changes are live on the landing page.", "ok");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Save failed";
      showToast(
        m.includes("Unauthorized")
          ? "Your session has expired. Please refresh and sign in again."
          : m,
        "err"
      );
    } finally { setSaving(null); }
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Loading settings…</div>;

  const NAV_GROUPS: { label: string; items: { id: CmsPanel; label: string; ready: boolean }[] }[] = [
    {
      label: "Above Fold",
      items: [
        { id: "hero", label: "Hero", ready: true },
        { id: "announcement", label: "Announcement", ready: true },
        { id: "stats", label: "Hero Stats", ready: true },
        { id: "trusted_by", label: "Trusted By", ready: true },
        { id: "contact", label: "Contact Info", ready: true },
      ],
    },
    {
      label: "Content",
      items: [
        { id: "whyChooseUs", label: "Why Choose Us", ready: true },
        { id: "howItWorks", label: "How It Works", ready: true },
        { id: "features", label: "Features", ready: true },
        { id: "dashboardPreview", label: "Dashboard Preview", ready: true },
        { id: "customerExperience", label: "Customer Experience", ready: true },
        { id: "realResults", label: "Real Results", ready: true },
        { id: "industryShowcase", label: "Industry Showcase", ready: true },
        { id: "whoItsFor", label: "Who It's For", ready: true },
        { id: "howToLaunch", label: "How To Launch", ready: true },
        { id: "pricing", label: "Pricing", ready: true },
        { id: "testimonials", label: "Testimonials", ready: true },
        { id: "faqs", label: "FAQ", ready: true },
        { id: "finalCta", label: "Final CTA", ready: true },
        { id: "footer", label: "Footer", ready: true },
      ],
    },
    {
      label: "Site",
      items: [
        { id: "media", label: "Media Library", ready: false },
        { id: "theme", label: "Theme", ready: true },
        { id: "seo", label: "SEO", ready: true },
      ],
    },
  ];

  const READY_PANELS: CmsPanel[] = [
    "hero", "announcement", "stats", "trusted_by", "contact",
    "whyChooseUs", "features", "testimonials", "faqs", "finalCta",
    "howItWorks", "dashboardPreview", "customerExperience",
    "realResults", "industryShowcase", "whoItsFor", "howToLaunch",
    "pricing", "footer", "theme", "seo",
  ];

  // ── Drag helpers ──────────────────────────────────────────────────────────────
  const onDragStart = (list: "testimonials" | "faqs", idx: number) => {
    dragIdxRef.current = idx;
    dragListRef.current = list;
  };
  const onDragOver = (list: string, idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver({ list, idx });
  };
  const onDragLeave = () => setDragOver(null);
  const onDropTestimonials = (dropIdx: number) => {
    if (dragListRef.current !== "testimonials") { dragIdxRef.current = null; dragListRef.current = null; return; }
    const from = dragIdxRef.current;
    if (from !== null && from !== dropIdx) {
      const arr = [...testimonials];
      const [item] = arr.splice(from, 1);
      arr.splice(dropIdx, 0, item);
      dTestimonials(arr);
    }
    dragIdxRef.current = null; dragListRef.current = null; setDragOver(null);
  };
  const onDropFaqs = (dropIdx: number) => {
    if (dragListRef.current !== "faqs") { dragIdxRef.current = null; dragListRef.current = null; return; }
    const from = dragIdxRef.current;
    if (from !== null && from !== dropIdx) {
      const arr = [...faqs];
      const [item] = arr.splice(from, 1);
      arr.splice(dropIdx, 0, item);
      dFaqs(arr);
    }
    dragIdxRef.current = null; dragListRef.current = null; setDragOver(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-[#0c2340] text-lg">Landing Page Editor</h2>
          <p className="text-sm text-slate-400 mt-0.5">Changes apply live at /</p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 text-xs font-semibold text-[#0c2340]/70 hover:text-[#0c2340] hover:border-[#0c2340]/30 hover:bg-[#0c2340]/5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
          View live
        </a>
      </div>

      {/* ── Toast notifications ─────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[200] space-y-2 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-sm ${
              t.type === "ok"
                ? "bg-white border-emerald-200 text-emerald-700"
                : "bg-white border-red-200 text-red-700"
            }`}
          >
            {t.type === "ok" ? (
              <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* ── Left nav ─────────────────────────────────────────────────────── */}
        <nav className="w-44 shrink-0 bg-white rounded-2xl border border-black/5 overflow-hidden">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="h-px bg-black/5" />}
              <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                {group.label}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  className={`w-full text-left px-3 py-2 text-[12px] font-semibold transition-colors flex items-center justify-between gap-1 ${
                    activePanel === item.id
                      ? "bg-[#0c2340] text-white"
                      : "text-[#0c2340]/70 hover:bg-[#F0F2F5] hover:text-[#0c2340]"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {dirtyIndicator.includes(item.id) && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${activePanel === item.id ? "bg-amber-300" : "bg-amber-400"}`}
                        title="Unsaved changes"
                      />
                    )}
                    {!item.ready && (
                      <span className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded ${
                        activePanel === item.id ? "bg-white/20 text-white/70" : "bg-slate-100 text-slate-400"
                      }`}>
                        Soon
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Right panel ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Validation error banner */}
          {valErr && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {valErr}
            </div>
          )}

          {activePanel === "announcement" && (
            <SettingsCard
              title="Announcement Banner"
              subtitle="Optional top-of-page notice"
              onRestore={() => restoreDefaults("announcement")}
              previewHref={PANEL_ANCHOR.announcement}
            >
              <label className="flex items-center gap-2.5 text-sm font-medium text-[#0c2340]">
                <input
                  type="checkbox"
                  checked={announcement.enabled}
                  onChange={(e) => dAnn({ ...announcement, enabled: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                Show banner on homepage
              </label>
              <SiteInput label="Banner text" value={announcement.text} onChange={(v) => dAnn({ ...announcement, text: v })} placeholder="e.g. 🎉 Limited offer — 30% off Pro plan this week!" />
              <SiteInput label="Banner link (optional)" value={announcement.link} onChange={(v) => dAnn({ ...announcement, link: v })} placeholder="https://…" />
              <SaveButton loading={saving === "announcement"} onClick={() => save("announcement", announcement)} />
            </SettingsCard>
          )}

          {activePanel === "hero" && (
            <SettingsCard
              title="Hero Section"
              subtitle="The main section visitors see first"
              onRestore={() => restoreDefaults("hero")}
              previewHref={PANEL_ANCHOR.hero}
            >
              <SiteInput label="Badge text (small label above heading)" value={hero.badge} onChange={(v) => dHero({ ...hero, badge: v })} />
              <SiteInput label="Heading — first line" value={hero.title_main} onChange={(v) => dHero({ ...hero, title_main: v })} />
              <SiteInput label="Heading — highlighted line" value={hero.title_highlight} onChange={(v) => dHero({ ...hero, title_highlight: v })} />
              <SiteTextarea label="Subtitle paragraph" value={hero.subtitle} onChange={(v) => dHero({ ...hero, subtitle: v })} rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <SiteInput label="Primary CTA button" value={hero.cta_primary} onChange={(v) => dHero({ ...hero, cta_primary: v })} />
                <SiteInput label="Secondary CTA button" value={hero.cta_secondary} onChange={(v) => dHero({ ...hero, cta_secondary: v })} />
              </div>
              <SaveButton loading={saving === "hero"} onClick={() => save("hero", hero)} />
            </SettingsCard>
          )}

          {activePanel === "stats" && (
            <SettingsCard
              title="Hero Stats"
              subtitle="The 3 numbers shown below the hero headline"
              onRestore={() => restoreDefaults("stats")}
              previewHref={PANEL_ANCHOR.stats}
            >
              {stats.map((s, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <SiteInput label={`Stat ${i + 1} — Value`} value={s.value} onChange={(v) => dStats(stats.map((x, j) => j === i ? { ...x, value: v } : x))} placeholder="10k+" />
                  <SiteInput label={`Stat ${i + 1} — Label`} value={s.label} onChange={(v) => dStats(stats.map((x, j) => j === i ? { ...x, label: v } : x))} placeholder="Spins delivered" />
                </div>
              ))}
              <SaveButton loading={saving === "stats"} onClick={() => save("stats", stats)} />
            </SettingsCard>
          )}

          {activePanel === "trusted_by" && (
            <SettingsCard
              title="Trusted By Strip"
              subtitle="Business names in the scrolling strip below the hero"
              onRestore={() => restoreDefaults("trusted_by")}
              previewHref={PANEL_ANCHOR.trusted_by}
            >
              <SiteTextarea
                label="Business names (comma-separated)"
                value={trustedBy}
                onChange={dTrustedBy}
                rows={3}
                placeholder="Glow Studio, Kathmandu Cafe, Aura Salon"
              />
              <p className="text-[11px] text-slate-400 -mt-1">Separate names with commas.</p>
              <SaveButton loading={saving === "trusted_by"} onClick={() => save("trusted_by", trustedBy.split(",").map((s) => s.trim()).filter(Boolean))} />
            </SettingsCard>
          )}

          {activePanel === "contact" && (
            <SettingsCard
              title="Contact Info"
              subtitle="Used in pricing CTAs and support links"
              onRestore={() => restoreDefaults("contact")}
              previewHref={PANEL_ANCHOR.contact}
            >
              <SiteInput label="WhatsApp number (digits only)" value={contact.whatsapp} onChange={(v) => dContact({ ...contact, whatsapp: v })} placeholder="9779769402069" />
              <SiteInput label="Email (optional)" value={contact.email} onChange={(v) => dContact({ ...contact, email: v })} placeholder="hello@example.com" />
              <SaveButton loading={saving === "contact"} onClick={() => save("contact", contact)} />
            </SettingsCard>
          )}

          {activePanel === "whyChooseUs" && (
            <SettingsCard
              title="Why Choose Us"
              subtitle="Section heading and the four feature cards below the hero"
              onRestore={() => restoreDefaults("whyChooseUs")}
              previewHref={PANEL_ANCHOR.whyChooseUs}
            >
              <SiteInput
                label="Section heading"
                value={whyChooseUs.heading}
                onChange={(v) => dWhyChooseUs({ ...whyChooseUs, heading: v })}
                placeholder="Why Businesses Choose Mystery Unlock"
              />
              <div className="space-y-3 pt-1">
                {whyChooseUs.items.map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#F0F2F5] space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Card {i + 1}</p>
                    <SiteInput
                      label="Title"
                      value={item.title}
                      onChange={(v) => dWhyChooseUs({ ...whyChooseUs, items: whyChooseUs.items.map((x, j) => j === i ? { ...x, title: v } : x) })}
                    />
                    <SiteTextarea
                      label="Description"
                      value={item.desc}
                      onChange={(v) => dWhyChooseUs({ ...whyChooseUs, items: whyChooseUs.items.map((x, j) => j === i ? { ...x, desc: v } : x) })}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
              <SaveButton loading={saving === "whyChooseUs"} onClick={() => save("whyChooseUs", whyChooseUs)} />
            </SettingsCard>
          )}

          {activePanel === "testimonials" && (
            <SettingsCard
              title="Testimonials"
              subtitle="Up to 6 review cards — drag to reorder"
              onRestore={() => restoreDefaults("testimonials")}
              previewHref={PANEL_ANCHOR.testimonials}
            >
              <p className="text-[11px] text-slate-400 -mt-1">Drag the ⠿ handle to reorder cards.</p>
              <div className="space-y-4">
                {testimonials.map((t, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => onDragStart("testimonials", i)}
                    onDragOver={onDragOver("testimonials", i)}
                    onDragLeave={onDragLeave}
                    onDrop={() => onDropTestimonials(i)}
                    onDragEnd={() => { dragIdxRef.current = null; dragListRef.current = null; setDragOver(null); }}
                    className={`relative space-y-2 p-4 pl-8 rounded-xl bg-[#F0F2F5] transition-shadow ${
                      dragOver?.list === "testimonials" && dragOver.idx === i
                        ? "ring-2 ring-[#0c2340]/30 shadow-lg"
                        : ""
                    }`}
                  >
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 cursor-grab hover:text-slate-500 select-none" aria-hidden>
                      <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor">
                        <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
                        <circle cx="2.5" cy="9" r="1.5"/><circle cx="7.5" cy="9" r="1.5"/>
                        <circle cx="2.5" cy="15.5" r="1.5"/><circle cx="7.5" cy="15.5" r="1.5"/>
                      </svg>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Review {i + 1}</p>
                      {testimonials.length > 1 && (
                        <button type="button" onClick={() => dTestimonials(testimonials.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700 font-semibold">
                          Remove
                        </button>
                      )}
                    </div>
                    <SiteTextarea label="Quote" value={t.q} onChange={(v) => dTestimonials(testimonials.map((x, j) => j === i ? { ...x, q: v } : x))} rows={2} />
                    <div className="grid grid-cols-2 gap-3">
                      <SiteInput label="Name" value={t.n} onChange={(v) => dTestimonials(testimonials.map((x, j) => j === i ? { ...x, n: v } : x))} placeholder="Anisha Rai" />
                      <SiteInput label="Role / Shop" value={t.r} onChange={(v) => dTestimonials(testimonials.map((x, j) => j === i ? { ...x, r: v } : x))} placeholder="Boutique Owner" />
                    </div>
                  </div>
                ))}
                {testimonials.length < 6 && (
                  <button type="button" onClick={() => dTestimonials([...testimonials, { n: "", r: "", q: "" }])} className="w-full py-2 rounded-xl border-2 border-dashed border-black/10 text-xs font-bold text-slate-400 hover:border-[#0c2340]/30 hover:text-[#0c2340] transition-colors">
                    + Add testimonial
                  </button>
                )}
              </div>
              <SaveButton loading={saving === "testimonials"} onClick={() => save("testimonials", testimonials)} />
            </SettingsCard>
          )}

          {activePanel === "faqs" && (
            <SettingsCard
              title="FAQ"
              subtitle="Questions and answers shown on the landing page — drag to reorder"
              onRestore={() => restoreDefaults("faqs")}
              previewHref={PANEL_ANCHOR.faqs}
            >
              <p className="text-[11px] text-slate-400 -mt-1">Drag the ⠿ handle to reorder questions.</p>
              <div className="space-y-4">
                {faqs.map((f, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => onDragStart("faqs", i)}
                    onDragOver={onDragOver("faqs", i)}
                    onDragLeave={onDragLeave}
                    onDrop={() => onDropFaqs(i)}
                    onDragEnd={() => { dragIdxRef.current = null; dragListRef.current = null; setDragOver(null); }}
                    className={`relative space-y-2 p-4 pl-8 rounded-xl bg-[#F0F2F5] transition-shadow ${
                      dragOver?.list === "faqs" && dragOver.idx === i
                        ? "ring-2 ring-[#0c2340]/30 shadow-lg"
                        : ""
                    }`}
                  >
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 cursor-grab hover:text-slate-500 select-none" aria-hidden>
                      <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor">
                        <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
                        <circle cx="2.5" cy="9" r="1.5"/><circle cx="7.5" cy="9" r="1.5"/>
                        <circle cx="2.5" cy="15.5" r="1.5"/><circle cx="7.5" cy="15.5" r="1.5"/>
                      </svg>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Q&amp;A {i + 1}</p>
                      {faqs.length > 1 && (
                        <button type="button" onClick={() => dFaqs(faqs.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700 font-semibold">
                          Remove
                        </button>
                      )}
                    </div>
                    <SiteInput label="Question" value={f.q} onChange={(v) => dFaqs(faqs.map((x, j) => j === i ? { ...x, q: v } : x))} placeholder="How quickly can I launch?" />
                    <SiteTextarea label="Answer" value={f.a} onChange={(v) => dFaqs(faqs.map((x, j) => j === i ? { ...x, a: v } : x))} rows={2} />
                  </div>
                ))}
                <button type="button" onClick={() => dFaqs([...faqs, { q: "", a: "" }])} className="w-full py-2 rounded-xl border-2 border-dashed border-black/10 text-xs font-bold text-slate-400 hover:border-[#0c2340]/30 hover:text-[#0c2340] transition-colors">
                  + Add question
                </button>
              </div>
              <SaveButton loading={saving === "faqs"} onClick={() => save("faqs", faqs)} />
            </SettingsCard>
          )}

          {activePanel === "finalCta" && (
            <SettingsCard
              title="Final CTA Banner"
              subtitle="The large call-to-action at the bottom of the page"
              onRestore={() => restoreDefaults("finalCta")}
              previewHref={PANEL_ANCHOR.finalCta}
            >
              <SiteInput label="Heading" value={finalCta.heading} onChange={(v) => dFinalCta({ ...finalCta, heading: v })} />
              <SiteTextarea label="Subtitle" value={finalCta.subtitle} onChange={(v) => dFinalCta({ ...finalCta, subtitle: v })} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <SiteInput label="Primary button" value={finalCta.cta_primary} onChange={(v) => dFinalCta({ ...finalCta, cta_primary: v })} placeholder="Start Free" />
                <SiteInput label="Secondary button" value={finalCta.cta_secondary} onChange={(v) => dFinalCta({ ...finalCta, cta_secondary: v })} placeholder="Talk to Sales" />
              </div>
              <SaveButton loading={saving === "finalCta"} onClick={() => save("finalCta", finalCta)} />
            </SettingsCard>
          )}

          {activePanel === "howItWorks" && (
            <SettingsCard
              title="How It Works"
              subtitle="Section heading, subtitle, and the 5 step cards (icons are fixed)"
              onRestore={() => restoreDefaults("howItWorks")}
              previewHref={PANEL_ANCHOR.howItWorks}
            >
              <SiteInput label="Heading" value={howItWorks.heading} onChange={(v) => dHowItWorks({ ...howItWorks, heading: v })} />
              <SiteTextarea label="Subtitle" value={howItWorks.subtitle} onChange={(v) => dHowItWorks({ ...howItWorks, subtitle: v })} rows={2} />
              <SectionTitle>Steps (5)</SectionTitle>
              {howItWorks.steps.map((step, i) => (
                <div key={i} className="rounded-xl border border-black/8 bg-[#F8F9FB] p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step {i + 1}</p>
                  <SiteInput label="Title" value={step.title} onChange={(v) => {
                    const steps = howItWorks.steps.map((s, j) => j === i ? { ...s, title: v } : s);
                    dHowItWorks({ ...howItWorks, steps });
                  }} />
                  <SiteTextarea label="Description" value={step.description} rows={2} onChange={(v) => {
                    const steps = howItWorks.steps.map((s, j) => j === i ? { ...s, description: v } : s);
                    dHowItWorks({ ...howItWorks, steps });
                  }} />
                </div>
              ))}
              <SaveButton loading={saving === "howItWorks"} onClick={() => save("howItWorks", howItWorks)} />
            </SettingsCard>
          )}

          {activePanel === "features" && (
            <SettingsCard
              title="Features"
              subtitle="Section heading, group labels, and the 12 feature cards (icons are fixed)"
              onRestore={() => restoreDefaults("features")}
              previewHref={PANEL_ANCHOR.features}
            >
              <SiteInput label="Heading" value={featuresSection.heading} onChange={(v) => dFeaturesSection({ ...featuresSection, heading: v })} />
              <SiteTextarea label="Subtitle" value={featuresSection.subtitle} onChange={(v) => dFeaturesSection({ ...featuresSection, subtitle: v })} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <SiteInput label="Business group label" value={featuresSection.business_label} onChange={(v) => dFeaturesSection({ ...featuresSection, business_label: v })} />
                <SiteInput label="Customer group label" value={featuresSection.customer_label} onChange={(v) => dFeaturesSection({ ...featuresSection, customer_label: v })} />
              </div>
              <SectionTitle>Business Feature Cards (6)</SectionTitle>
              {featuresSection.business.map((f, i) => (
                <div key={i} className="rounded-xl border border-black/8 bg-[#F8F9FB] p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card {i + 1}</p>
                  <SiteInput label="Title" value={f.title} onChange={(v) => {
                    const business = featuresSection.business.map((c, j) => j === i ? { ...c, title: v } : c);
                    dFeaturesSection({ ...featuresSection, business });
                  }} />
                  <SiteTextarea label="Description" value={f.description} rows={2} onChange={(v) => {
                    const business = featuresSection.business.map((c, j) => j === i ? { ...c, description: v } : c);
                    dFeaturesSection({ ...featuresSection, business });
                  }} />
                </div>
              ))}
              <SectionTitle>Customer Feature Cards (6)</SectionTitle>
              {featuresSection.customer.map((f, i) => (
                <div key={i} className="rounded-xl border border-black/8 bg-[#F8F9FB] p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card {i + 1}</p>
                  <SiteInput label="Title" value={f.title} onChange={(v) => {
                    const customer = featuresSection.customer.map((c, j) => j === i ? { ...c, title: v } : c);
                    dFeaturesSection({ ...featuresSection, customer });
                  }} />
                  <SiteTextarea label="Description" value={f.description} rows={2} onChange={(v) => {
                    const customer = featuresSection.customer.map((c, j) => j === i ? { ...c, description: v } : c);
                    dFeaturesSection({ ...featuresSection, customer });
                  }} />
                </div>
              ))}
              <SaveButton loading={saving === "featuresSection"} onClick={() => save("featuresSection", featuresSection)} />
            </SettingsCard>
          )}

          {activePanel === "dashboardPreview" && (
            <SettingsCard
              title="Dashboard Preview"
              subtitle="Section heading and subtitle (the mockup UI is fixed)"
              onRestore={() => restoreDefaults("dashboardPreview")}
              previewHref={PANEL_ANCHOR.dashboardPreview}
            >
              <SiteInput label="Heading" value={dashboardPreview.heading} onChange={(v) => dDashboardPreview({ ...dashboardPreview, heading: v })} />
              <SiteTextarea label="Subtitle" value={dashboardPreview.subtitle} onChange={(v) => dDashboardPreview({ ...dashboardPreview, subtitle: v })} rows={2} />
              <SaveButton loading={saving === "dashboardPreview"} onClick={() => save("dashboardPreview", dashboardPreview)} />
            </SettingsCard>
          )}

          {activePanel === "customerExperience" && (
            <SettingsCard
              title="Customer Experience"
              subtitle="Section heading and subtitle (the phone mockup is fixed)"
              onRestore={() => restoreDefaults("customerExperience")}
              previewHref={PANEL_ANCHOR.customerExperience}
            >
              <SiteInput label="Heading" value={customerExperience.heading} onChange={(v) => dCustomerExperience({ ...customerExperience, heading: v })} />
              <SiteTextarea label="Subtitle" value={customerExperience.subtitle} onChange={(v) => dCustomerExperience({ ...customerExperience, subtitle: v })} rows={2} />
              <SaveButton loading={saving === "customerExperience"} onClick={() => save("customerExperience", customerExperience)} />
            </SettingsCard>
          )}

          {activePanel === "realResults" && (
            <SettingsCard
              title="Real Results"
              subtitle="Section heading and subtitle (the metrics are fixed)"
              onRestore={() => restoreDefaults("realResults")}
              previewHref={PANEL_ANCHOR.realResults}
            >
              <SiteInput label="Heading" value={realResults.heading} onChange={(v) => dRealResults({ ...realResults, heading: v })} />
              <SiteTextarea label="Subtitle" value={realResults.subtitle} onChange={(v) => dRealResults({ ...realResults, subtitle: v })} rows={2} />
              <SaveButton loading={saving === "realResults"} onClick={() => save("realResults", realResults)} />
            </SettingsCard>
          )}

          {activePanel === "industryShowcase" && (
            <SettingsCard
              title="Industry Showcase"
              subtitle="Section heading and subtitle (industry cards are fixed)"
              onRestore={() => restoreDefaults("industryShowcase")}
              previewHref={PANEL_ANCHOR.industryShowcase}
            >
              <SiteInput label="Heading" value={industryShowcase.heading} onChange={(v) => dIndustryShowcase({ ...industryShowcase, heading: v })} />
              <SiteTextarea label="Subtitle" value={industryShowcase.subtitle} onChange={(v) => dIndustryShowcase({ ...industryShowcase, subtitle: v })} rows={2} />
              <SaveButton loading={saving === "industryShowcase"} onClick={() => save("industryShowcase", industryShowcase)} />
            </SettingsCard>
          )}

          {activePanel === "whoItsFor" && (
            <SettingsCard
              title="Who It's Built For"
              subtitle="Section heading and subtitle (industry grid is fixed)"
              onRestore={() => restoreDefaults("whoItsFor")}
              previewHref={PANEL_ANCHOR.whoItsFor}
            >
              <SiteInput label="Heading" value={whoItsFor.heading} onChange={(v) => dWhoItsFor({ ...whoItsFor, heading: v })} />
              <SiteTextarea label="Subtitle" value={whoItsFor.subtitle} onChange={(v) => dWhoItsFor({ ...whoItsFor, subtitle: v })} rows={2} />
              <SaveButton loading={saving === "whoItsFor"} onClick={() => save("whoItsFor", whoItsFor)} />
            </SettingsCard>
          )}

          {activePanel === "howToLaunch" && (
            <SettingsCard
              title="How To Launch"
              subtitle="Section heading, subtitle, and the 5 setup step labels"
              onRestore={() => restoreDefaults("howToLaunch")}
              previewHref={PANEL_ANCHOR.howToLaunch}
            >
              <SiteInput label="Heading" value={howToLaunch.heading} onChange={(v) => dHowToLaunch({ ...howToLaunch, heading: v })} />
              <SiteTextarea label="Subtitle" value={howToLaunch.subtitle} onChange={(v) => dHowToLaunch({ ...howToLaunch, subtitle: v })} rows={2} />
              <SectionTitle>Steps (5)</SectionTitle>
              {howToLaunch.steps.map((step, i) => (
                <div key={i} className="rounded-xl border border-black/8 bg-[#F8F9FB] p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step {i + 1}</p>
                  <SiteInput label="Title" value={step.title} onChange={(v) => {
                    const steps = howToLaunch.steps.map((s, j) => j === i ? { ...s, title: v } : s);
                    dHowToLaunch({ ...howToLaunch, steps });
                  }} />
                  <SiteInput label="Subtitle" value={step.subtitle} onChange={(v) => {
                    const steps = howToLaunch.steps.map((s, j) => j === i ? { ...s, subtitle: v } : s);
                    dHowToLaunch({ ...howToLaunch, steps });
                  }} />
                </div>
              ))}
              <SaveButton loading={saving === "howToLaunch"} onClick={() => save("howToLaunch", howToLaunch)} />
            </SettingsCard>
          )}

          {activePanel === "pricing" && (
            <SettingsCard
              title="Pricing"
              subtitle="Section heading and subtitle (plans managed in Plans Manager)"
              onRestore={() => restoreDefaults("pricing")}
              previewHref={PANEL_ANCHOR.pricing}
            >
              <SiteInput label="Heading" value={pricingSection.heading} onChange={(v) => dPricingSection({ ...pricingSection, heading: v })} />
              <SiteTextarea label="Subtitle" value={pricingSection.subtitle} onChange={(v) => dPricingSection({ ...pricingSection, subtitle: v })} rows={2} />
              <p className="text-xs text-slate-400 mt-1">Plan details (names, prices, features) are managed in the Plans Manager tab.</p>
              <SaveButton loading={saving === "pricingSection"} onClick={() => save("pricingSection", pricingSection)} />
            </SettingsCard>
          )}

          {activePanel === "footer" && (
            <SettingsCard
              title="Footer"
              subtitle="Brand name, tagline, contact details, and social links"
              onRestore={() => restoreDefaults("footer")}
              previewHref={PANEL_ANCHOR.footer}
            >
              <SiteInput label="Business name" value={footerSettings.business_name} onChange={(v) => dFooterSettings({ ...footerSettings, business_name: v })} />
              <SiteTextarea label="Tagline" value={footerSettings.tagline} onChange={(v) => dFooterSettings({ ...footerSettings, tagline: v })} rows={2} />
              <SectionTitle>Contact</SectionTitle>
              <SiteInput label="Email address" value={footerSettings.email} onChange={(v) => dFooterSettings({ ...footerSettings, email: v })} placeholder="support@yoursite.com" />
              <SiteInput label="WhatsApp number" value={footerSettings.whatsapp} onChange={(v) => dFooterSettings({ ...footerSettings, whatsapp: v })} placeholder="9779769XXXXXXX" />
              <SiteInput label="Address (optional)" value={footerSettings.address} onChange={(v) => dFooterSettings({ ...footerSettings, address: v })} placeholder="Kathmandu, Nepal" />
              <SectionTitle>Social Links (optional)</SectionTitle>
              <SiteInput label="Facebook URL" value={footerSettings.facebook} onChange={(v) => dFooterSettings({ ...footerSettings, facebook: v })} placeholder="https://facebook.com/yourpage" />
              <SiteInput label="Instagram URL" value={footerSettings.instagram} onChange={(v) => dFooterSettings({ ...footerSettings, instagram: v })} placeholder="https://instagram.com/yourhandle" />
              <SiteInput label="X / Twitter URL" value={footerSettings.twitter} onChange={(v) => dFooterSettings({ ...footerSettings, twitter: v })} placeholder="https://x.com/yourhandle" />
              <SaveButton loading={saving === "footer"} onClick={() => save("footer", footerSettings)} />
            </SettingsCard>
          )}

          {activePanel === "theme" && (
            <SettingsCard
              title="Theme Colors"
              subtitle="Override the site accent and primary colors via CSS variables"
              onRestore={() => restoreDefaults("theme")}
              previewHref={PANEL_ANCHOR.theme}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Accent color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={themeSettings.accent} onChange={(e) => dThemeSettings({ ...themeSettings, accent: e.target.value })} className="w-10 h-10 rounded-lg border border-black/10 cursor-pointer p-1 bg-[#F0F2F5]" />
                    <input value={themeSettings.accent} onChange={(e) => dThemeSettings({ ...themeSettings, accent: e.target.value })} className="flex-1 px-3 py-2 rounded-xl border border-black/10 bg-[#F0F2F5] text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30 font-mono" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Primary color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={themeSettings.primary} onChange={(e) => dThemeSettings({ ...themeSettings, primary: e.target.value })} className="w-10 h-10 rounded-lg border border-black/10 cursor-pointer p-1 bg-[#F0F2F5]" />
                    <input value={themeSettings.primary} onChange={(e) => dThemeSettings({ ...themeSettings, primary: e.target.value })} className="flex-1 px-3 py-2 rounded-xl border border-black/10 bg-[#F0F2F5] text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30 font-mono" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                These values are injected as CSS custom properties (<code className="bg-black/5 px-1 rounded">--mu-accent</code>, <code className="bg-black/5 px-1 rounded">--mu-primary</code>) on the landing page.
              </p>
              <SaveButton loading={saving === "theme"} onClick={() => save("theme", themeSettings)} />
            </SettingsCard>
          )}

          {activePanel === "seo" && (
            <SettingsCard
              title="SEO Settings"
              subtitle="Page title, meta description, and Open Graph tags"
              onRestore={() => restoreDefaults("seo")}
              previewHref={PANEL_ANCHOR.seo}
            >
              <SiteInput label="Page title" value={seoSettings.title} onChange={(v) => dSeoSettings({ ...seoSettings, title: v })} placeholder="Your Site — tagline" />
              <SiteTextarea label="Meta description" value={seoSettings.description} onChange={(v) => dSeoSettings({ ...seoSettings, description: v })} rows={3} placeholder="150–160 characters recommended" />
              <SectionTitle>Open Graph</SectionTitle>
              <SiteInput label="OG title" value={seoSettings.og_title} onChange={(v) => dSeoSettings({ ...seoSettings, og_title: v })} />
              <SiteTextarea label="OG description" value={seoSettings.og_description} onChange={(v) => dSeoSettings({ ...seoSettings, og_description: v })} rows={3} />
              <p className="text-xs text-slate-400 mt-1">OG tags control how your page looks when shared on social media and messaging apps.</p>
              <SaveButton loading={saving === "seo"} onClick={() => save("seo", seoSettings)} />
            </SettingsCard>
          )}

          {!READY_PANELS.includes(activePanel) && (
            <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
              <div className="text-3xl mb-3">🚧</div>
              <p className="font-bold text-[#0c2340] text-sm">Coming soon</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                This section editor is not yet available.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// SHARED UI HELPERS
// ──────────────────────────────────────────────

function StatusBadge({ active, status }: { active: boolean; status: string }) {
  if (!active || status === "suspended") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">suspended</span>;
  if (status === "active") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">active</span>;
  if (status === "trial") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">trial</span>;
  if (status === "past_due") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">past_due</span>;
  return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{status}</span>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="font-bold text-[#0c2340] text-sm border-b border-black/8 pb-1.5 mb-2">{children}</p>;
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-slate-400">{k}: </span>
      <span className="text-[#0c2340] font-medium">{v}</span>
    </div>
  );
}

function SettingsCard({
  title,
  subtitle,
  children,
  onRestore,
  previewHref,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onRestore?: () => void;
  previewHref?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-black/5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#0c2340]">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {previewHref !== undefined && (
            <a
              href={previewHref || "/"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#0c2340]/50 hover:text-[#0c2340] hover:bg-[#F0F2F5] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
              Preview
            </a>
          )}
          {onRestore && (
            <button
              type="button"
              onClick={onRestore}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-[#0c2340] hover:bg-[#F0F2F5] transition-colors"
            >
              Reset defaults
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function SiteInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-black/10 bg-[#F0F2F5] text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30"
      />
    </div>
  );
}

function SiteTextarea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-black/10 bg-[#F0F2F5] text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30 resize-none"
      />
    </div>
  );
}

function SaveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="pt-1">
      <button
        disabled={loading}
        onClick={onClick}
        className="px-5 py-2 rounded-xl bg-[#0c2340] text-white text-sm font-bold disabled:opacity-50 hover:bg-[#0c2340]/90 transition-colors"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// SUBSCRIPTION SECTION (from shop details)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// MIN PROBABILITY SECTION (per-shop admin control)
// ──────────────────────────────────────────────

function MinProbSection({
  shopId,
  currentMin,
  onUpdated,
}: {
  shopId: string;
  currentMin: number;
  onUpdated: () => Promise<void>;
}) {
  const doSetMin = useServerFn(setShopMinimumProbability);
  const [value, setValue] = useState(String(currentMin));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const inp = "w-28 px-2.5 py-1.5 rounded-lg border border-black/10 bg-white text-[#0c2340] text-xs outline-none";

  const save = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) {
      setMsg({ text: "Enter a value between 0 and 100", ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await doSetMin({ data: { shopId, minimum_probability: num } });
      setMsg({ text: "Saved", ok: true });
      await onUpdated();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to save", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <SectionTitle>Prize Settings</SectionTitle>
      <div className="rounded-xl bg-[#F0F2F5] p-4 space-y-3 text-xs">
        <div className="space-y-1">
          <p className="font-medium text-[#0c2340]">Shop Minimum Probability (%)</p>
          <p className="text-slate-500">
            Merchants cannot set any prize probability below this value. Set to 0 to remove the minimum — merchants will then be able to freely choose any probability from 0% (never awarded) to 100% (guaranteed).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inp}
          />
          <span className="text-slate-400">% (0 – 100)</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-[#0c2340] text-white font-bold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {msg && (
            <span className={msg.ok ? "text-emerald-600 font-medium" : "text-red-500"}>
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function AuditLogSection({ shopId }: { shopId: string }) {
  const fetchAudit = useServerFn(getShopAuditLog);
  const [rows, setRows] = useState<{ id: string; admin_user_id: string; action: string; old_value: unknown; new_value: unknown; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchAudit({ data: { shopId, limit: 20 } })
      .then((res) => { setRows(res.rows); setErr(""); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [shopId]);

  return (
    <section>
      <SectionTitle>Audit Log</SectionTitle>
      {loading ? (
        <p className="text-xs text-slate-400 mt-2">Loading…</p>
      ) : err ? (
        <p className="text-xs text-red-500 mt-2">{err}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-400 mt-2">No audit records for this shop.</p>
      ) : (
        <div className="mt-2 rounded-xl overflow-hidden border border-black/8">
          <table className="w-full text-xs">
            <thead className="bg-[#F0F2F5] text-left">
              <tr>
                {["When", "Action", "Old value", "New value", "Admin user ID"].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#F0F2F5]/60 transition-colors">
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-[#0c2340]">{r.action}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{r.old_value != null ? JSON.stringify(r.old_value) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{r.new_value != null ? JSON.stringify(r.new_value) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-slate-400 truncate max-w-[140px]" title={r.admin_user_id}>{r.admin_user_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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

function SubscriptionSection({ shop, payments, busy, onUpdate, onExtend, onRecordPayment }: {
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

  const inp = "w-full px-2.5 py-1.5 rounded-lg border border-black/10 bg-[#F0F2F5] text-[#0c2340] text-xs outline-none";

  return (
    <section>
      <SectionTitle>Subscription & billing</SectionTitle>
      <div className="rounded-xl bg-[#F0F2F5] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-slate-500 font-medium">Plan</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value as SubShop["plan"])} className={inp}>
              <option value="free">free</option>
              <option value="pro">pro</option>
              <option value="lifetime">lifetime</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-slate-500 font-medium">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as SubShop["subscription_status"])} className={inp}>
              <option value="trial">trial</option>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="suspended">suspended</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          {shop.current_period_end ? <>Period ends: <strong className="text-[#0c2340]">{new Date(shop.current_period_end).toLocaleString()}</strong></> :
           shop.trial_ends_at ? <>Trial ends: <strong className="text-[#0c2340]">{new Date(shop.trial_ends_at).toLocaleString()}</strong></> : "No end date set"}
        </p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal billing notes" className={`${inp} min-h-[52px] resize-none`} />
        <div className="flex gap-2 flex-wrap">
          <button disabled={busy === `sub${shop.id}`} onClick={() => onUpdate({ plan, subscription_status: status, billing_notes: notes })} className="px-3 py-1.5 rounded-lg bg-[#0c2340] text-white text-xs font-bold disabled:opacity-50">Save</button>
          {[1, 3, 12].map((m) => (
            <button key={m} disabled={busy === `ext${shop.id}`} onClick={() => onExtend(m)} className="px-3 py-1.5 rounded-lg bg-white border border-black/10 text-xs font-semibold text-[#0c2340] disabled:opacity-50">+{m}mo</button>
          ))}
        </div>

        <div className="pt-3 border-t border-black/8">
          <p className="text-xs font-bold text-[#0c2340] mb-2">Record a payment</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" inputMode="decimal" className={inp} />
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="NPR" className={inp} />
            <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="eSewa / Khalti / Bank" className={inp} />
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference / txn id" className={inp} />
            <input value={months} onChange={(e) => setMonths(e.target.value)} placeholder="Months to extend" inputMode="numeric" className={inp} />
            <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Notes" className={inp} />
          </div>
          <button
            disabled={busy === `pay${shop.id}` || !amount}
            onClick={() => onRecordPayment({ amount: Number(amount), currency: currency || "NPR", method: method || undefined, reference: reference || undefined, months: months ? Number(months) : 0, notes: payNotes || undefined })}
            className="mt-2 px-3 py-1.5 rounded-lg bg-[#0c2340] text-white text-xs font-bold disabled:opacity-50"
          >Record payment</button>
        </div>

        {payments.length > 0 && (
          <div className="pt-3 border-t border-black/8">
            <p className="text-xs font-bold text-[#0c2340] mb-2">Payment history</p>
            <table className="w-full text-xs">
              <thead className="text-left text-slate-400">
                <tr><th className="pb-1">Date</th><th>Amount</th><th>Method</th><th>Ref</th><th>Covers until</th></tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td className="py-1 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="font-medium text-[#0c2340]">{p.currency} {Number(p.amount).toLocaleString()}</td>
                    <td>{p.method ?? "—"}</td>
                    <td className="font-mono truncate max-w-[80px]">{p.reference ?? "—"}</td>
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

// ──────────────────────────────────────────────
// PLANS MANAGER
// ──────────────────────────────────────────────

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
  return { id: "", code: "", name: "", tagline: "", price_amount: 0, currency: "NPR", period: "month", features: [], is_highlighted: false, is_active: true, sort_order: 0, cta_label: "", contact_url: "" };
}

function PlansManager({ onMsg }: { onMsg: (m: string) => void }) {
  const fetchPlans = useServerFn(listAllPlansAdmin);
  const doUpsert = useServerFn(upsertPlan);
  const doDelete = useServerFn(deletePlan);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [saving, setSaving] = useState(false);

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
        code: editing.code.trim(), name: editing.name.trim(),
        tagline: editing.tagline?.trim() || null,
        price_amount: Number(editing.price_amount) || 0,
        currency: editing.currency.trim() || "NPR",
        period: editing.period.trim() || "month",
        features: (editing.features || []).map((f) => f.trim()).filter(Boolean),
        is_highlighted: !!editing.is_highlighted, is_active: !!editing.is_active,
        sort_order: Number(editing.sort_order) || 0,
        cta_label: editing.cta_label?.trim() || null,
        contact_url: editing.contact_url?.trim() || null,
      };
      await doUpsert({ data: payload });
      onMsg("Plan saved.");
      setEditing(null); load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  const remove = async (p: AdminPlan) => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    try { await doDelete({ data: { id: p.id } }); onMsg("Plan deleted."); load(); }
    catch (e) { onMsg(e instanceof Error ? e.message : "Delete failed"); }
  };

  const inp = "planadminput";

  return (
    <>
      <style>{`.planadminput{width:100%;padding:8px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;background:#F0F2F5;color:#0c2340;font-size:13px;outline:none}`}</style>
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <div>
            <p className="font-bold text-[#0c2340]">Plans ({plans.length})</p>
            <p className="text-xs text-slate-400 mt-0.5">Visible to owners on /billing</p>
          </div>
          <button onClick={() => setEditing(emptyPlan())} className="px-3 py-1.5 rounded-xl bg-[#0c2340] text-white text-sm font-bold">+ Add plan</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No plans yet. Add one above.</div>
        ) : (
          <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map((p) => (
              <div key={p.id} className={`rounded-xl border p-4 ${p.is_highlighted ? "border-[#FF6B1A]/30 bg-[#FF6B1A]/4" : "border-black/8 bg-[#F0F2F5]"}`}>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-bold text-[#0c2340] truncate">{p.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">{p.code}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                    {p.is_active ? "live" : "hidden"}
                  </span>
                </div>
                <p className="text-xl font-black text-[#0c2340]">
                  {p.price_amount === 0 ? "Free" : `${p.currency} ${p.price_amount.toLocaleString()}`}
                  {p.price_amount > 0 && <span className="text-xs text-slate-400 font-normal"> / {p.period}</span>}
                </p>
                {p.tagline && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.tagline}</p>}
                <p className="text-[11px] text-slate-400 mt-1">{p.features.length} features · order {p.sort_order}</p>
                <div className="flex gap-1.5 mt-3">
                  <button onClick={() => setEditing(p)} className="px-2.5 py-1 rounded-lg bg-[#0c2340] text-white text-xs font-bold">Edit</button>
                  <button onClick={() => remove(p)} className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/8 sticky top-0 bg-white">
              <h3 className="font-bold text-lg text-[#0c2340]">{editing.id ? "Edit plan" : "New plan"}</h3>
              <button onClick={() => setEditing(null)} className="text-sm px-3 py-1.5 rounded-lg bg-[#F0F2F5] font-semibold">Cancel</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3 text-sm">
              <PlanField label="Code" hint="e.g. pro"><input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className={inp} /></PlanField>
              <PlanField label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} /></PlanField>
              <PlanField label="Price" hint="0 = Free"><input type="number" min={0} value={editing.price_amount} onChange={(e) => setEditing({ ...editing, price_amount: Number(e.target.value) })} className={inp} /></PlanField>
              <PlanField label="Currency"><input value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className={inp} /></PlanField>
              <PlanField label="Period">
                <select value={editing.period} onChange={(e) => setEditing({ ...editing, period: e.target.value })} className={inp}>
                  <option value="month">month</option><option value="year">year</option><option value="lifetime">lifetime</option>
                </select>
              </PlanField>
              <PlanField label="Sort order"><input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={inp} /></PlanField>
              <PlanField label="Tagline" full><input value={editing.tagline ?? ""} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} className={inp} /></PlanField>
              <PlanField label="CTA label" hint="e.g. Upgrade, Contact us"><input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} className={inp} /></PlanField>
              <PlanField label="Contact URL" hint="Optional — overrides WhatsApp"><input value={editing.contact_url ?? ""} onChange={(e) => setEditing({ ...editing, contact_url: e.target.value })} className={inp} /></PlanField>
              <PlanField label="Features" hint="One per line" full>
                <textarea rows={5} value={(editing.features ?? []).join("\n")} onChange={(e) => setEditing({ ...editing, features: e.target.value.split("\n") })} className={`${inp} resize-none`} />
              </PlanField>
              <label className="flex items-center gap-2 text-xs text-[#0c2340]">
                <input type="checkbox" checked={editing.is_highlighted} onChange={(e) => setEditing({ ...editing, is_highlighted: e.target.checked })} />
                Mark as most popular
              </label>
              <label className="flex items-center gap-2 text-xs text-[#0c2340]">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Active (visible to owners)
              </label>
            </div>
            <div className="px-5 py-4 border-t border-black/8 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-[#F0F2F5] text-sm font-semibold text-[#0c2340]">Cancel</button>
              <button disabled={saving} onClick={save} className="px-5 py-2 rounded-xl bg-[#0c2340] text-white text-sm font-bold disabled:opacity-50">
                {saving ? "Saving…" : "Save plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlanField({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}
