import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { CustomerProfileForm } from "@/components/customer/CustomerProfileForm";
import { PageSkeleton } from "@/components/customer/PortalSkeleton";

export const Route = createFileRoute("/_customer/portal/profile")({
  head: () => ({ meta: [{ title: "Profile — Mystery Unlock" }] }),
  component: ProfilePage,
});

type Customer = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  created_at: string;
};

function ProfilePage() {
  const navigate     = useNavigate();
  const fetchProfile = useServerFn(getMyProfileFn);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    try {
      const { customer: c } = await fetchProfile({ data: {} });
      setCustomer(c as Customer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/forbidden/i.test(msg)) { navigate({ to: "/dashboard" }); return; }
    } finally { setLoading(false); }
  }, [fetchProfile, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;
  if (!customer) return null;

  const displayName = customer.name || customer.email.split("@")[0];
  const initial = displayName.charAt(0).toUpperCase();

  const memberSince = customer.created_at
    ? new Date(customer.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="min-h-screen bg-background">
      <CustomerPortalHeader customer={customer} activeTab="profile" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Avatar + display name */}
        <div className="flex flex-col items-center gap-3 py-4 animate-fade-in">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-white font-black text-3xl shrink-0 shadow-sm">
            {initial}
          </div>
          <div className="text-center">
            <p className="font-bold text-lg text-foreground leading-snug">{displayName}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{customer.email}</p>
          </div>
        </div>

        {/* Profile form */}
        <CustomerProfileForm
          customer={customer}
          onSaved={() => {
            setLoading(true);
            load();
          }}
        />

        {/* Account info */}
        <section className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Account
          </h2>
          <AccountRow label="Member since" value={memberSince} />
          <AccountRow label="Sign-in method" value="Email OTP" />
        </section>
      </main>
    </div>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-semibold">{value}</span>
    </div>
  );
}
