import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Copy, Trophy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyPrizeClaimsFn } from "@/lib/prize-claims.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { PageSkeleton } from "@/components/customer/PortalSkeleton";
import type { PrizeClaim } from "@/lib/prize-claims.functions";

export const Route = createFileRoute("/_customer/portal/prizes/$claimId")({
  head: () => ({ meta: [{ title: "Prize Details — Mystery Unlock" }] }),
  component: PrizeDetailPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null; created_at: string };

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  unclaimed: { label: "Unclaimed",  cls: "bg-[#FF7A00]/15 text-[#FF7A00]" },
  claimed:   { label: "Redeemed",   cls: "bg-emerald-500/15 text-emerald-400" },
  expired:   { label: "Expired",    cls: "bg-white/10 text-muted-foreground" },
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "long", year: "numeric",
  });
}

function PrizeDetailPage() {
  const { claimId } = Route.useParams();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfileFn);
  const fetchClaims  = useServerFn(getMyPrizeClaimsFn);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [claim,    setClaim]    = useState<PrizeClaim | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied,   setCopied]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, claimRes] = await Promise.all([
          fetchProfile({ data: {} }),
          fetchClaims({ data: {} }),
        ]);
        setCustomer(profileRes.customer as Customer);
        const found = claimRes.claims.find((c) => c.id === claimId) ?? null;
        if (!found) { setNotFound(true); return; }
        setClaim(found);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/forbidden/i.test(msg)) { navigate({ to: "/dashboard" }); return; }
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [claimId]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    if (!claim) return;
    try {
      await navigator.clipboard.writeText(claim.claim_code.toUpperCase());
      setCopied(true);
      toast.success("Claim code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  if (loading) return <PageSkeleton />;

  if (!customer) return null;

  if (notFound || !claim) {
    return (
      <div className="min-h-screen bg-[#0F1115]">
        <CustomerPortalHeader customer={customer} activeTab="prizes" />
        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="text-center py-14">
            <p className="text-5xl mb-4">🏆</p>
            <p className="font-bold text-foreground">Prize not found</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              This claim may have expired or been removed.
            </p>
            <Link
              to="/portal/prizes"
              className="mt-5 inline-block px-5 py-2.5 rounded-xl gradient-primary text-[#0F1115] text-sm font-bold"
            >
              Back to My Prizes
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const status = STATUS_LABEL[claim.status] ?? STATUS_LABEL.unclaimed;
  const isRedeemed = claim.status === "claimed";
  const isExpired  = claim.status === "expired";

  const daysUntilExpiry = claim.expires_at
    ? Math.ceil((new Date(claim.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

  return (
    <div className="min-h-screen bg-[#0F1115]">
      <CustomerPortalHeader customer={customer} activeTab="prizes" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Back link */}
        <Link
          to="/portal/prizes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Prizes
        </Link>

        {/* Trophy icon + prize name */}
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-[#0F1115]">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h1 className={`text-2xl font-black leading-tight ${isRedeemed || isExpired ? "text-muted-foreground" : "text-gold"}`}>
              {claim.prize_name}
            </h1>
            {claim.shop_name && (
              <p className="text-sm text-muted-foreground mt-1">{claim.shop_name}</p>
            )}
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${status.cls}`}>
            {status.label}
          </span>
        </div>

        {/* Expiry warning */}
        {isExpiringSoon && !isRedeemed && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 text-center">
            {daysUntilExpiry === 0
              ? "This prize expires today — redeem it now!"
              : `This prize expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}. Redeem it soon.`}
          </div>
        )}

        {/* Detail fields */}
        <div className="rounded-2xl bg-white/3 border border-white/8 divide-y divide-white/8">
          <DetailRow label="Won on"     value={fmt(claim.created_at)} />
          {claim.expires_at && (
            <DetailRow
              label="Expires"
              value={fmt(claim.expires_at)}
              valueClass={isExpiringSoon && !isRedeemed ? "text-amber-400" : undefined}
            />
          )}
          {claim.claimed_at && (
            <DetailRow label="Redeemed on" value={fmt(claim.claimed_at)} />
          )}
          <DetailRow label="Shop"       value={claim.shop_name ?? "—"} />
        </div>

        {/* QR code + claim code (unclaimed only) */}
        {!isRedeemed && !isExpired && (
          <div className="rounded-2xl bg-white/3 border border-white/8 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">
              Show to redeem
            </h2>
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-2xl">
                <QRCodeSVG
                  value={claim.claim_code.toUpperCase()}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#0F1115"
                  level="M"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-center text-sm tracking-[0.3em] text-foreground bg-white/5 border border-white/15 rounded-xl py-2.5 px-3 uppercase">
                {claim.claim_code}
              </div>
              <button
                onClick={copy}
                aria-label="Copy claim code"
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition text-muted-foreground"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Show this QR code to the shop staff to claim your prize.
            </p>
          </div>
        )}

        {/* Redeemed state */}
        {isRedeemed && (
          <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="font-bold text-emerald-400">Prize Redeemed</p>
            {claim.claimed_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Redeemed on {fmt(claim.claimed_at)}
              </p>
            )}
          </div>
        )}

        {/* Expired state */}
        {isExpired && (
          <div className="rounded-2xl bg-white/3 border border-white/8 p-5 text-center">
            <p className="font-bold text-muted-foreground">This prize has expired</p>
            {claim.expires_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Expired on {fmt(claim.expires_at)}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 gap-4">
      <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold shrink-0">
        {label}
      </span>
      <span className={`text-sm font-semibold text-right ${valueClass ?? "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
