import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
  const tone =
    sub.subscription_status === "suspended" || expired ? "bg-destructive/20 border-destructive/40 text-destructive" :
    sub.subscription_status === "trial" || sub.subscription_status === "past_due" ? "bg-amber-500/10 border-amber-500/30 text-amber-200" :
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-200";
  return (
    <div className={`mb-4 rounded-xl border px-3 py-2 text-xs flex justify-between items-center gap-2 flex-wrap ${tone}`}>
      <div>
        <span className="font-bold uppercase mr-2">{sub.plan}</span>
        <span className="uppercase">{sub.subscription_status}</span>
        {end && (
          <span className="ml-2 opacity-80">
            {expired ? `Expired ${new Date(end).toLocaleDateString()}` : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · ${new Date(end).toLocaleDateString()}`}
          </span>
        )}
      </div>
      {(sub.subscription_status !== "active" || expired) && (
        <span className="opacity-80">Contact admin to activate / renew.</span>
      )}
    </div>
  );
}
