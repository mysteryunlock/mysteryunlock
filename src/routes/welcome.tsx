import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, User, ArrowRight, ChevronLeft, Sparkles } from "lucide-react";
import { DEFAULT_LOGO } from "@/lib/spin-store";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome — Mystery Unlock" },
      { name: "description", content: "Sign in as a business owner or a customer." },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12 bg-[#F7F8FA] animate-fade-in">
      {/* Logo */}
      <div className="mb-10">
        <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-10 w-auto object-contain" />
      </div>

      {/* Pill badge */}
      <div className="inline-flex items-center gap-2 bg-[#FF6B1A]/10 border border-[#FF6B1A]/20 rounded-full px-3.5 py-1.5 mb-6">
        <Sparkles className="w-3.5 h-3.5 text-[#FF6B1A]" strokeWidth={2} />
        <span className="text-[11px] font-semibold text-[#FF6B1A] uppercase tracking-wide">Mystery Unlock</span>
      </div>

      {/* Heading */}
      <div className="text-center mb-10 max-w-sm">
        <h1 className="text-3xl font-display font-bold text-[#0C2340] mb-2 leading-tight">
          Welcome back
        </h1>
        <p className="text-sm text-[#4a5b78] leading-relaxed">
          Choose how you'd like to continue
        </p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-2xl grid sm:grid-cols-2 gap-4">
        <EntryCard
          icon={<Store className="w-6 h-6 text-[#FF6B1A]" strokeWidth={1.75} />}
          title="Business Owner"
          description="Manage your shop, campaigns, prize wheels, and customer data."
          signUpTo="/auth"
          signInTo="/auth"
        />
        <EntryCard
          icon={<User className="w-6 h-6 text-[#0C2340]" strokeWidth={1.75} />}
          title="Customer"
          description="View your prizes, spin history, and connected shops."
          singleTo="/customer-auth"
          singleLabel="Continue with Email"
          secondary
        />
      </div>

      {/* Back link */}
      <Link
        to="/"
        className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-[#4a5b78] hover:text-[#0C2340] transition-colors min-h-[44px]"
      >
        <ChevronLeft className="w-4 h-4" strokeWidth={2} />
        Back to home
      </Link>
    </div>
  );
}

type EntryCardProps =
  | {
      icon: React.ReactNode;
      title: string;
      description: string;
      signUpTo: string;
      signInTo: string;
      singleTo?: never;
      singleLabel?: never;
      secondary?: boolean;
    }
  | {
      icon: React.ReactNode;
      title: string;
      description: string;
      signUpTo?: never;
      signInTo?: never;
      singleTo: string;
      singleLabel: string;
      secondary?: boolean;
    };

function EntryCard({ icon, title, description, signUpTo, signInTo, singleTo, singleLabel, secondary }: EntryCardProps) {
  return (
    <div className="bg-white rounded-[20px] border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.10)] p-7 flex flex-col">
      {/* Icon */}
      <div className={`w-12 h-12 rounded-2xl grid place-items-center mb-5 ${secondary ? "bg-[#0C2340]/8" : "bg-[#FF6B1A]/10"}`}>
        {icon}
      </div>

      <h2 className="text-lg font-display font-bold text-[#0C2340] mb-1.5">
        {title}
      </h2>
      <p className="text-sm text-[#4a5b78] leading-relaxed mb-6 flex-1">
        {description}
      </p>

      <div className="flex flex-col gap-2.5">
        {singleTo ? (
          <Link
            to={singleTo}
            className="w-full h-11 rounded-xl bg-[#0C2340] text-white text-sm font-display font-semibold flex items-center justify-center gap-2 hover:bg-[#1a3a66] transition-colors min-h-[44px]"
          >
            {singleLabel}
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        ) : (
          <>
            <Link
              to={signUpTo}
              className="w-full h-11 rounded-xl gradient-primary text-white text-sm font-display font-semibold flex items-center justify-center gap-2 shadow-[0_4px_12px_-4px_rgba(255,107,26,0.40)] hover:opacity-95 transition-all min-h-[44px]"
            >
              Sign up
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
            <Link
              to={signInTo}
              className="w-full h-11 rounded-xl border border-[#0C2340]/15 bg-white text-[#0C2340] text-sm font-display font-semibold flex items-center justify-center hover:bg-[#F7F8FA] transition-colors min-h-[44px]"
            >
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
