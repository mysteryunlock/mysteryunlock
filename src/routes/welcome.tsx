import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, User, ArrowRight } from "lucide-react";
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: "linear-gradient(135deg, #2E3C48 0%, #3D5066 100%)",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div className="flex justify-center mb-8">
        <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-12 w-auto object-contain" />
      </div>

      <div className="text-center mb-10 max-w-lg">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-sm" style={{ color: "#C7D2DB" }}>
          Choose how you'd like to continue
        </p>
      </div>

      <div className="w-full max-w-3xl grid sm:grid-cols-2 gap-6">
        <EntryCard
          icon={<Store className="w-7 h-7" style={{ color: "#E8DCC4" }} />}
          title="Business Owner"
          description="Manage your shop, campaigns, and prize wheels."
          signUpTo="/auth"
          signInTo="/auth"
        />
        <EntryCard
          icon={<User className="w-7 h-7" style={{ color: "#E8DCC4" }} />}
          title="Customer"
          description="View your prizes, spin history, and account."
          signUpTo="/customer-auth"
          signInTo="/customer-auth"
        />
      </div>

      <Link
        to="/"
        className="mt-10 text-sm font-medium hover:opacity-80 transition-opacity"
        style={{ color: "#C7D2DB" }}
      >
        ← Back to home
      </Link>
    </div>
  );
}

function EntryCard({
  icon,
  title,
  description,
  signUpTo,
  signInTo,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  signUpTo: string;
  signInTo: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-8 flex flex-col items-center text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, #2E3C48, #3D5066)" }}
      >
        {icon}
      </div>
      <h2 className="text-xl font-bold mb-1" style={{ color: "#1F2A37" }}>
        {title}
      </h2>
      <p className="text-sm text-gray-500 mb-6">{description}</p>

      <div className="w-full flex flex-col gap-3">
        <Link
          to={signUpTo}
          className="w-full font-semibold h-11 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
          style={{ backgroundColor: "#2E3C48", color: "#E8DCC4" }}
        >
          Sign up
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          to={signInTo}
          className="w-full font-semibold h-11 rounded-lg text-sm transition-all border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2"
          style={{ color: "#2E3C48" }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
