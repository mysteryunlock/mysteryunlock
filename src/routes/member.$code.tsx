import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Clock, Mail, Phone, Store, User } from "lucide-react";
import { Btn } from "@/components/ds";
import { getMemberByCodeFn } from "@/lib/shop-connections.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/member/$code")({
  head: () => ({ meta: [{ title: "Member Profile — Mystery Unlock" }] }),
  component: MemberProfilePage,
});

type MemberProfile = {
  customer: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  membership: {
    shopId: string;
    shopName: string;
    status: string;
    lastVisit: string | null;
    joinedAt: string;
  };
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never visited";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Visited today";
  if (days === 1) return "Visited yesterday";
  if (days < 7) return `Visited ${days}d ago`;
  return fmtDate(iso);
}

function initials(name: string | null, email: string): string {
  const s = (name || email || "").trim();
  if (!s) return "?";
  const parts = s.split(/[\s@]/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || s[0].toUpperCase();
}

function MemberProfilePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const fetchMember = useServerFn(getMemberByCodeFn);

  const [profile, setProfile] = useState<MemberProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const res = await fetchMember({ data: { customerCode: code } });
        setProfile(res as unknown as MemberProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Member not found.");
        setProfile(null);
      }
    })();
  }, [fetchMember, code, navigate]);

  if (profile === undefined) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-full max-w-sm mx-4 rounded-2xl bg-white border border-[#0c2340]/8 p-8 animate-pulse h-64" />
      </div>
    );
  }

  if (!profile || error) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white border border-[#0c2340]/8 p-8 text-center space-y-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-[#4a5b78]"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <p className="font-bold text-[#0c2340]">Member not found</p>
          <p className="text-sm text-[#4a5b78]">
            {error || "This QR code is invalid or the customer is not connected to your shop."}
          </p>
          <Btn variant="primary" size="sm" className="mt-3 rounded-xl" onClick={() => navigate({ to: "/dashboard" })}>
            Back to Dashboard
          </Btn>
        </div>
      </div>
    );
  }

  const { customer, membership } = profile;
  const init = initials(customer.name, customer.email);
  const isActive = membership.status === "active";

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] flex items-start justify-center pt-12 px-4 pb-12">
      <div className="w-full max-w-sm space-y-4">

        {/* Header card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0c2340] to-[#1a3a5f] text-white p-6 text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-[#FF6B1A] grid place-items-center text-2xl font-black mx-auto mb-3">
            {init}
          </div>
          <h1 className="text-xl font-bold">{customer.name || "Anonymous"}</h1>
          <div className="flex items-center justify-center gap-1.5 mt-1 text-white/70 text-sm">
            <Store className="w-3.5 h-3.5" />
            <span>{membership.shopName}</span>
          </div>
          <div className="mt-3">
            <span
              className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                isActive ? "bg-emerald-400/20 text-emerald-300" : "bg-slate-400/20 text-slate-300"
              }`}
            >
              {isActive ? "Active Member" : membership.status}
            </span>
          </div>
        </div>

        {/* Contact info */}
        {(customer.phone || customer.email) && (
          <div className="rounded-2xl bg-white border border-[#0c2340]/8 p-5 shadow-sm space-y-3">
            <p className="text-[11px] uppercase tracking-wide font-bold text-[#4a5b78]">Contact</p>
            {customer.phone && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF6B1A]/10 grid place-items-center text-[#FF6B1A] shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <a
                  href={`tel:${customer.phone}`}
                  className="text-sm font-semibold text-[#0c2340] hover:text-[#FF6B1A] transition"
                >
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF6B1A]/10 grid place-items-center text-[#FF6B1A] shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <a
                  href={`mailto:${customer.email}`}
                  className="text-sm font-semibold text-[#0c2340] truncate hover:text-[#FF6B1A] transition"
                >
                  {customer.email}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Membership info */}
        <div className="rounded-2xl bg-white border border-[#0c2340]/8 p-5 shadow-sm space-y-3">
          <p className="text-[11px] uppercase tracking-wide font-bold text-[#4a5b78]">Membership</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 grid place-items-center text-violet-600 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-[#4a5b78]">Member since</p>
              <p className="text-sm font-bold text-[#0c2340]">{fmtDate(membership.joinedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 grid place-items-center text-blue-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-[#4a5b78]">Last visit</p>
              <p className="text-sm font-bold text-[#0c2340]">{fmtRelative(membership.lastVisit)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 grid place-items-center text-emerald-600 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-[#4a5b78]">Status</p>
              <p className={`text-sm font-bold ${isActive ? "text-emerald-700" : "text-slate-500"}`}>
                {membership.status}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {customer.phone && (
          <div className="flex gap-3">
            <a
              href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold text-center hover:bg-emerald-600 transition shadow-sm"
            >
              WhatsApp
            </a>
            <a
              href={`tel:${customer.phone}`}
              className="flex-1 py-3 rounded-xl bg-[#0c2340] text-white text-sm font-bold text-center hover:bg-[#1a3a5f] transition shadow-sm"
            >
              Call
            </a>
          </div>
        )}

        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="w-full py-3 rounded-xl border border-[#0c2340]/12 text-[#0c2340] text-sm font-bold hover:bg-white transition"
        >
          ← Back to Dashboard
        </button>

      </div>
    </div>
  );
}
