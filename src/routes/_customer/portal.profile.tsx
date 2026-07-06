import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { CustomerProfileForm } from "@/components/customer/CustomerProfileForm";

export const Route = createFileRoute("/_customer/portal/profile")({
  head: () => ({ meta: [{ title: "Profile — Mystery Unlock" }] }),
  component: ProfilePage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-[#0F1115]">
      <CustomerPortalHeader customer={customer} activeTab="profile" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-black">Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Update your display name and phone number.
          </p>
        </div>

        <CustomerProfileForm
          customer={customer}
          onSaved={() => {
            setLoading(true);
            load();
          }}
        />

        {/* Account info */}
        <section className="pt-4 border-t border-white/8 space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Account
          </h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Member since</span>
            <span className="text-foreground font-semibold">
              {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sign-in method</span>
            <span className="text-foreground font-semibold">Email OTP</span>
          </div>
        </section>
      </main>
    </div>
  );
}
