import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllShops,
  setShopActive,
  deleteShop,
  sendOwnerPasswordReset,
  forceSetOwnerPassword,
  signOutOwner,
  getShopDetails,
  updateShopSubscription,
  extendShopPeriod,
  recordShopPayment,
} from "@/lib/shops.functions";
import { listAllPlansAdmin, upsertPlan, deletePlan } from "@/lib/plans.functions";
import { getSiteSettings, updateSiteSetting } from "@/lib/site-settings.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Admin — Mystery Unlock" }] }),
  component: SuperAdminPage,
});

type AdminSection = "shops" | "plans" | "site";

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
  const [section, setSection] = useState<AdminSection>("shops");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F0F2F5" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-64 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: "#0c2340" }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Mystery Unlock</p>
          <p className="text-white font-black text-lg leading-tight">Admin Panel</p>
        </div>

        {/* Nav */}
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

        {/* Sign out */}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
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

        {/* Section content */}
        <div className="flex-1 overflow-y-auto p-5 lg:p-7">
          {section === "shops" && <ShopsSection />}
          {section === "plans" && <PlansSection />}
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

  // Stats
  const total = shops.length;
  const active = shops.filter((s) => s.is_active && s.subscription_status === "active").length;
  const trial = shops.filter((s) => s.subscription_status === "trial").length;
  const suspended = shops.filter((s) => !s.is_active || s.subscription_status === "suspended").length;

  return (
    <div className="space-y-5">
      {/* Stats row */}
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

      {/* List */}
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
                  {/* Info */}
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
                          ? <span className="ml-1.5 text-emerald-600 font-medium">✓</span>
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

                  {/* Actions */}
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

      {/* Shop details modal */}
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
                {/* Shop info */}
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

                {/* Owner */}
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

                {/* Subscription */}
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

                {/* Prizes */}
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

                {/* Spins */}
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

                {/* Access codes */}
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

function SiteSection() {
  const router = useRouter();
  const fetchSettings = useServerFn(getSiteSettings);
  const doUpdate = useServerFn(updateSiteSetting);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [hero, setHero] = useState<HeroSettings>(DEFAULT_HERO);
  const [announcement, setAnnouncement] = useState<AnnouncementSettings>(DEFAULT_ANNOUNCEMENT);
  const [contact, setContact] = useState<ContactSettings>(DEFAULT_CONTACT);
  const [stats, setStats] = useState<StatItem[]>(DEFAULT_STATS);
  const [trustedBy, setTrustedBy] = useState<string>(DEFAULT_TRUSTED_BY.join(", "));
  const [features, setFeatures] = useState<FeatureItem[]>(DEFAULT_FEATURES);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>(DEFAULT_TESTIMONIALS);
  const [faqs, setFaqs] = useState<FaqItem[]>(DEFAULT_FAQS);
  const [finalCta, setFinalCta] = useState<FinalCtaSettings>(DEFAULT_FINAL_CTA);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { settings } = await fetchSettings();
      if (settings.hero) setHero({ ...DEFAULT_HERO, ...(settings.hero as HeroSettings) });
      if (settings.announcement) setAnnouncement({ ...DEFAULT_ANNOUNCEMENT, ...(settings.announcement as AnnouncementSettings) });
      if (settings.contact) setContact({ ...DEFAULT_CONTACT, ...(settings.contact as ContactSettings) });
      if (settings.stats) setStats(settings.stats as StatItem[]);
      if (settings.trusted_by) setTrustedBy((settings.trusted_by as string[]).join(", "));
      if (settings.features) setFeatures(settings.features as FeatureItem[]);
      if (settings.testimonials) setTestimonials(settings.testimonials as TestimonialItem[]);
      if (settings.faqs) setFaqs(settings.faqs as FaqItem[]);
      if (settings.finalCta) setFinalCta({ ...DEFAULT_FINAL_CTA, ...(settings.finalCta as FinalCtaSettings) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load settings");
    } finally { setLoading(false); }
  }, [fetchSettings]);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string, value: unknown) => {
    setSaving(key); setMsg(""); setErr("");
    try {
      await doUpdate({ data: { key, value } });
      // Flush the router cache so the landing page loader re-runs on next visit
      await router.invalidate();
      setMsg("Saved! Changes will appear on the landing page.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Save failed";
      setErr(m.includes("Unauthorized")
        ? "Your session has expired. Please refresh this page and sign in again, then retry."
        : m);
    } finally { setSaving(null); }
  };

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Loading settings…</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="font-bold text-[#0c2340] text-lg">Landing Page Editor</h2>
        <p className="text-sm text-slate-400 mt-0.5">Changes apply to the public homepage at /</p>
      </div>

      {msg && <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">{msg}</div>}
      {err && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}

      {/* Announcement banner */}
      <SettingsCard title="Announcement Banner" subtitle="Optional top-of-page notice">
        <label className="flex items-center gap-2.5 text-sm font-medium text-[#0c2340]">
          <input
            type="checkbox"
            checked={announcement.enabled}
            onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          Show banner on homepage
        </label>
        <SiteInput
          label="Banner text"
          value={announcement.text}
          onChange={(v) => setAnnouncement({ ...announcement, text: v })}
          placeholder="e.g. 🎉 Limited offer — 30% off Pro plan this week!"
        />
        <SiteInput
          label="Banner link (optional)"
          value={announcement.link}
          onChange={(v) => setAnnouncement({ ...announcement, link: v })}
          placeholder="https://…"
        />
        <SaveButton loading={saving === "announcement"} onClick={() => save("announcement", announcement)} />
      </SettingsCard>

      {/* Hero */}
      <SettingsCard title="Hero Section" subtitle="The main section visitors see first">
        <SiteInput label="Badge text (small label above heading)" value={hero.badge} onChange={(v) => setHero({ ...hero, badge: v })} />
        <SiteInput label="Heading — first line" value={hero.title_main} onChange={(v) => setHero({ ...hero, title_main: v })} />
        <SiteInput label="Heading — highlighted line" value={hero.title_highlight} onChange={(v) => setHero({ ...hero, title_highlight: v })} />
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Subtitle paragraph</label>
          <textarea
            rows={3}
            value={hero.subtitle}
            onChange={(e) => setHero({ ...hero, subtitle: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-black/10 bg-[#F0F2F5] text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SiteInput label="Primary CTA button" value={hero.cta_primary} onChange={(v) => setHero({ ...hero, cta_primary: v })} />
          <SiteInput label="Secondary CTA button" value={hero.cta_secondary} onChange={(v) => setHero({ ...hero, cta_secondary: v })} />
        </div>
        <SaveButton loading={saving === "hero"} onClick={() => save("hero", hero)} />
      </SettingsCard>

      {/* Contact */}
      <SettingsCard title="Contact Info" subtitle="Used in pricing CTAs and support links">
        <SiteInput label="WhatsApp number (digits only)" value={contact.whatsapp} onChange={(v) => setContact({ ...contact, whatsapp: v })} placeholder="9779769402069" />
        <SiteInput label="Email (optional)" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} placeholder="hello@example.com" />
        <SaveButton loading={saving === "contact"} onClick={() => save("contact", contact)} />
      </SettingsCard>

      {/* Stats */}
      <SettingsCard title="Hero Stats" subtitle="The 3 numbers shown below the hero headline">
        {stats.map((s, i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            <SiteInput label={`Stat ${i + 1} — Value`} value={s.value} onChange={(v) => setStats(stats.map((x, j) => j === i ? { ...x, value: v } : x))} placeholder="10k+" />
            <SiteInput label={`Stat ${i + 1} — Label`} value={s.label} onChange={(v) => setStats(stats.map((x, j) => j === i ? { ...x, label: v } : x))} placeholder="Spins delivered" />
          </div>
        ))}
        <SaveButton loading={saving === "stats"} onClick={() => save("stats", stats)} />
      </SettingsCard>

      {/* Trusted By */}
      <SettingsCard title="Trusted By Strip" subtitle="Comma-separated list of business names shown below the hero">
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Business names (comma-separated)</label>
          <textarea
            rows={3}
            value={trustedBy}
            onChange={(e) => setTrustedBy(e.target.value)}
            placeholder="Glow Studio, Kathmandu Cafe, Aura Salon"
            className="w-full px-3 py-2 rounded-xl border border-black/10 bg-[#F0F2F5] text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30 resize-none"
          />
          <p className="text-[11px] text-slate-400">Separate each name with a comma. They'll appear left to right in the strip.</p>
        </div>
        <SaveButton loading={saving === "trusted_by"} onClick={() => save("trusted_by", trustedBy.split(",").map(s => s.trim()).filter(Boolean))} />
      </SettingsCard>

      {/* Features */}
      <SettingsCard title="Feature Cards" subtitle="The 6 cards in the Features section (icons are fixed)">
        {features.map((f, i) => (
          <div key={i} className="space-y-2 pb-3 border-b border-black/5 last:border-0 last:pb-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card {i + 1}</p>
            <div className="grid grid-cols-2 gap-3">
              <SiteInput label="Title" value={f.t} onChange={(v) => setFeatures(features.map((x, j) => j === i ? { ...x, t: v } : x))} />
              <SiteInput label="Description" value={f.desc} onChange={(v) => setFeatures(features.map((x, j) => j === i ? { ...x, desc: v } : x))} />
            </div>
          </div>
        ))}
        <SaveButton loading={saving === "features"} onClick={() => save("features", features)} />
      </SettingsCard>

      {/* Testimonials */}
      <SettingsCard title="Testimonials" subtitle="Up to 6 review cards — add or remove freely">
        <div className="space-y-4">
          {testimonials.map((t, i) => (
            <div key={i} className="relative space-y-2 p-4 rounded-xl bg-[#F0F2F5]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Review {i + 1}</p>
                {testimonials.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Quote</label>
                <textarea
                  rows={2}
                  value={t.q}
                  onChange={(e) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, q: e.target.value } : x))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-white text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SiteInput label="Name" value={t.n} onChange={(v) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, n: v } : x))} placeholder="Anisha Rai" />
                <SiteInput label="Role / Shop" value={t.r} onChange={(v) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, r: v } : x))} placeholder="Boutique Owner" />
              </div>
            </div>
          ))}
          {testimonials.length < 6 && (
            <button
              type="button"
              onClick={() => setTestimonials([...testimonials, { n: "", r: "", q: "" }])}
              className="w-full py-2 rounded-xl border-2 border-dashed border-black/10 text-xs font-bold text-slate-400 hover:border-[#0c2340]/30 hover:text-[#0c2340] transition-colors"
            >
              + Add testimonial
            </button>
          )}
        </div>
        <SaveButton loading={saving === "testimonials"} onClick={() => save("testimonials", testimonials)} />
      </SettingsCard>

      {/* FAQ */}
      <SettingsCard title="FAQ" subtitle="Questions and answers shown on the landing page">
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div key={i} className="relative space-y-2 p-4 rounded-xl bg-[#F0F2F5]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Q&amp;A {i + 1}</p>
                {faqs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold"
                  >
                    Remove
                  </button>
                )}
              </div>
              <SiteInput label="Question" value={f.q} onChange={(v) => setFaqs(faqs.map((x, j) => j === i ? { ...x, q: v } : x))} placeholder="How quickly can I launch?" />
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Answer</label>
                <textarea
                  rows={2}
                  value={f.a}
                  onChange={(e) => setFaqs(faqs.map((x, j) => j === i ? { ...x, a: e.target.value } : x))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 bg-white text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30 resize-none"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFaqs([...faqs, { q: "", a: "" }])}
            className="w-full py-2 rounded-xl border-2 border-dashed border-black/10 text-xs font-bold text-slate-400 hover:border-[#0c2340]/30 hover:text-[#0c2340] transition-colors"
          >
            + Add question
          </button>
        </div>
        <SaveButton loading={saving === "faqs"} onClick={() => save("faqs", faqs)} />
      </SettingsCard>

      {/* Final CTA */}
      <SettingsCard title="Bottom CTA Banner" subtitle="The large call-to-action section at the bottom of the page">
        <SiteInput label="Heading" value={finalCta.heading} onChange={(v) => setFinalCta({ ...finalCta, heading: v })} />
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Subtitle</label>
          <textarea
            rows={2}
            value={finalCta.subtitle}
            onChange={(e) => setFinalCta({ ...finalCta, subtitle: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-black/10 bg-[#F0F2F5] text-[#0c2340] text-sm outline-none focus:border-[#0c2340]/30 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SiteInput label="Primary button" value={finalCta.cta_primary} onChange={(v) => setFinalCta({ ...finalCta, cta_primary: v })} placeholder="Start Free" />
          <SiteInput label="Secondary button" value={finalCta.cta_secondary} onChange={(v) => setFinalCta({ ...finalCta, cta_secondary: v })} placeholder="Talk to Sales" />
        </div>
        <SaveButton loading={saving === "finalCta"} onClick={() => save("finalCta", finalCta)} />
      </SettingsCard>
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

function SettingsCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-black/5">
        <p className="font-bold text-[#0c2340]">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
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
              <div key={p.id} className={`rounded-xl border p-4 ${p.is_highlighted ? "border-[#FF6B00]/30 bg-[#FF6B00]/4" : "border-black/8 bg-[#F0F2F5]"}`}>
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
