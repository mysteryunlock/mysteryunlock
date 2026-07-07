import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyConnectCodeFn } from "@/lib/shop-connections.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { PageSkeleton } from "@/components/customer/PortalSkeleton";

export const Route = createFileRoute("/_customer/portal/qr")({
  head: () => ({ meta: [{ title: "My QR Code — Mystery Unlock" }] }),
  component: MyQrPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null; created_at: string };

function MyQrPage() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfileFn);
  const fetchConnectCode = useServerFn(getMyConnectCodeFn);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeLoading, setCodeLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { customer: c } = await fetchProfile({ data: {} });
      setCustomer(c as Customer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/forbidden/i.test(msg)) { navigate({ to: "/dashboard" }); return; }
    } finally {
      setLoading(false);
    }
    try {
      const res = await fetchConnectCode({ data: {} });
      setConnectCode(res.connectCode);
    } catch {
      // Non-fatal
    } finally {
      setCodeLoading(false);
    }
  }, [fetchProfile, fetchConnectCode, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;
  if (!customer) return null;

  const qrValue = connectCode ?? "";

  return (
    <div className="min-h-screen bg-background">
      <CustomerPortalHeader customer={customer} activeTab="portal" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <section className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My QR Code</h1>
          <p className="text-sm text-muted-foreground mt-1">Show this to a shop owner to become a member</p>
        </section>

        <div className="rounded-2xl bg-card border border-border shadow-sm p-6 flex flex-col items-center gap-5 animate-fade-in">
          {codeLoading ? (
            <div className="w-56 h-56 rounded-xl bg-muted animate-pulse" />
          ) : connectCode ? (
            <>
              <div className="p-4 bg-white rounded-2xl border border-border">
                <QRCodeSVG value={qrValue} size={200} level="M" includeMargin={false} />
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Your Code
                </p>
                <p className="text-3xl font-black text-foreground tracking-widest mt-1">{connectCode}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-destructive">Could not load your code. Please refresh.</p>
          )}
        </div>
      </main>
    </div>
  );
}
