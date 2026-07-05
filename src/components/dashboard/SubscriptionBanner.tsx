import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { getMySubscription } from "@/lib/shops.functions";

export function SubscriptionBanner() {
  const fetchSub = useServerFn(getMySubscription);
  const [sub, setSub] = useState<{ plan: string; subscription_status: string; trial_ends_at: string | null; current_period_end: string | null } | null>(null);
  useEffect(() => {
    fetchSub().then((r) => { if (r.shop) setSub(r.shop as any); }).catch(() => {});
  }, [fetchSub]);
  if (!sub) return null;

  const end = sub.current_period_end ?? sub.trial_ends_at;
  const expired = end ? new Date(end).getTime() < Date.now() : false;
  const daysLeft = end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86400000) : null;

  const isSuspended = sub.subscription_status === "suspended" || expired;
  const isTrial = sub.subscription_status === "trial" || sub.subscription_status === "past_due";
  const isActive = sub.subscription_status === "active" && !expired;

  const styles = isSuspended
    ? { wrap: "bg-red-50 border-red-200 text-red-800", icon: <XCircle className="w-4 h-4 shrink-0 text-red-500" /> }
    : isTrial
    ? { wrap: "bg-amber-50 border-amber-200 text-amber-800", icon: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" /> }
    : { wrap: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" /> };

  return (
    <div className={`mb-4 rounded-xl border px-3 py-2.5 text-xs flex items-center gap-2 ${styles.wrap}`}>
      {styles.icon}
      <div className="flex-1 min-w-0">
        <span className="font-bold uppercase mr-1.5">{sub.plan}</span>
        <span className="uppercase font-medium">{sub.subscription_status}</span>
        {end && (
          <span className="ml-1.5">
            {expired
              ? `· Expired ${new Date(end).toLocaleDateString()}`
              : `· ${daysLeft} day${daysLeft === 1 ? "" : "s"} left · ${new Date(end).toLocaleDateString()}`}
          </span>
        )}
        {!isActive && (
          <span className="ml-1.5 opacity-80">— Contact admin to activate / renew.</span>
        )}
      </div>
      {!isActive && (
        <Link to="/billing" className="shrink-0 flex items-center gap-0.5 font-semibold hover:underline">
          Billing <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
