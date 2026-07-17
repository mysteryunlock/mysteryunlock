import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Check, ChevronRight, Copy, Download, Users } from "lucide-react";
import { Btn } from "@/components/ds";
import { getMyShopConnectInfoFn, getShopCustomersFn } from "@/lib/shop-connections.functions";
import { DashCard, EmptyState, SectionHead, SkeletonBlock, SkeletonRow } from "./ui";
import type { Shop, TabKey } from "./types";

type Member = {
  customerId: string;
  name: string | null;
  phone: string | null;
  email: string;
  status: string;
  lastVisit: string | null;
  connectedAt: string;
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function initials(name: string | null, fallback: string): string {
  const s = (name || "").trim();
  if (!s) return fallback.slice(0, 1).toUpperCase();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || s[0].toUpperCase();
}

export function CustomerHubTab({
  shop,
  onNavigate,
}: {
  shop: Shop;
  onNavigate?: (t: TabKey) => void;
}) {
  const fetchConnectInfo = useServerFn(getMyShopConnectInfoFn);
  const fetchMembers = useServerFn(getShopCustomersFn);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const connectUrl = connectCode ? `${origin}/connect/${connectCode}` : "";

  useEffect(() => {
    fetchConnectInfo({ data: { shopId: shop.id } })
      .then((r) => setConnectCode(r.connectCode))
      .catch(() => {})
      .finally(() => setConnectLoading(false));
  }, [fetchConnectInfo, shop.id]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await fetchMembers({ data: { shopId: shop.id } });
      setMembers(res.members as Member[]);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [fetchMembers, shop.id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const copyCode = async () => {
    if (!connectCode) return;
    try {
      await navigator.clipboard.writeText(connectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(connectCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard blocked */ }
    }
  };

  const downloadQr = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${shop.slug}-connect-qr.png`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);
  };

  const recentMembers = members.slice(0, 5);

  return (
    <div className="space-y-5">

      {/* ── Shop QR + connect code ───────────────────────────────────────── */}
      <DashCard className="p-5">
        <SectionHead title="Shop QR & Connection Code" />
        <p className="text-sm text-[#4a5b78] mt-1.5">
          Share this single QR — customers can join your shop, spin, and access future rewards.
          No second QR needed.
        </p>

        {connectLoading ? (
          <SkeletonBlock className="h-52 mt-4" />
        ) : connectCode ? (
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-5">
            {/* Visible SVG QR */}
            <div className="p-4 bg-white rounded-xl border border-[#0c2340]/8 shrink-0 shadow-sm">
              <QRCodeSVG value={connectUrl} size={180} level="M" includeMargin={false} />
            </div>

            {/* Hidden canvas QR (used for download only) */}
            <div ref={canvasRef} className="hidden">
              <QRCodeCanvas value={connectUrl} size={512} level="H" includeMargin />
            </div>

            <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left w-full">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-semibold">
                  Connection Code
                </p>
                <p className="text-3xl font-black text-[#0c2340] tracking-widest mt-0.5">
                  {connectCode}
                </p>
              </div>

              <p className="text-xs text-[#4a5b78] break-all">{connectUrl}</p>

              <div className="flex flex-wrap gap-2">
                <Btn
                  variant="primary"
                  size="xs"
                  className="rounded-xl"
                  onClick={copyCode}
                  leftIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? "Copied!" : "Copy Link"}
                </Btn>
                <button
                  onClick={downloadQr}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#0c2340]/12 text-[#0c2340] text-xs font-bold hover:bg-[#F5F7FA] transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download QR
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-600 mt-4">
            Could not load your connect code. Please refresh.
          </p>
        )}
      </DashCard>

      {/* ── Connected Members summary ────────────────────────────────────── */}
      <DashCard className="p-5">
        <SectionHead
          title="Connected Members"
          right={
            !membersLoading && members.length > 0 && onNavigate ? (
              <button
                onClick={() => onNavigate("customers")}
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#FF6B1A] hover:opacity-75 transition-opacity"
              >
                View all <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            ) : (
              <span className="text-xs font-semibold text-[#4a5b78]">{members.length}</span>
            )
          }
        />

        {/* Member count card */}
        {!membersLoading && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-[#FF6B1A]/6 border border-[#FF6B1A]/15">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B1A]/15 grid place-items-center text-[#FF6B1A] shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-[#0c2340] leading-none">{members.length}</p>
              <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-semibold mt-0.5">
                Total Members
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 divide-y divide-[#0c2340]/6">
          {membersLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : recentMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No connected members yet"
              description="Share your QR code so customers can join as members."
            />
          ) : (
            recentMembers.map((m) => (
              <div key={m.customerId} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-[#FF6B1A]/10 text-[#FF6B1A] font-bold text-xs grid place-items-center shrink-0">
                  {initials(m.name, m.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0c2340] truncate">
                    {m.name || m.email}
                  </p>
                  <p className="text-xs text-[#4a5b78] truncate">{m.phone || m.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.status}
                  </span>
                  <p className="text-[11px] text-[#4a5b78] mt-1">{fmtRelative(m.lastVisit)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {!membersLoading && members.length > 5 && onNavigate && (
          <button
            onClick={() => onNavigate("customers")}
            className="mt-3 w-full py-2.5 rounded-xl border border-[#0c2340]/10 text-[#0c2340] text-xs font-bold hover:bg-[#F5F7FA] transition"
          >
            <span className="inline-flex items-center gap-1">View all {members.length} members <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} /></span>
          </button>
        )}
      </DashCard>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <DashCard className="p-5">
        <SectionHead title="How It Works" />
        <div className="mt-3 space-y-3">
          {[
            { step: "1", text: "Customer scans your QR or types the code" },
            { step: "2", text: "They sign in (or create a free account)" },
            { step: "3", text: "They tap Join This Shop — you're connected" },
            { step: "4", text: "They can spin, redeem prizes, and come back" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#FF6B1A] text-white text-xs font-black grid place-items-center shrink-0 mt-0.5">
                {step}
              </div>
              <p className="text-sm text-[#4a5b78]">{text}</p>
            </div>
          ))}
        </div>
      </DashCard>

    </div>
  );
}
