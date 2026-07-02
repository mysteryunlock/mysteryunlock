import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & Privacy — Mystery Unlock" },
      {
        name: "description",
        content:
          "How Mystery Unlock handles authentication, customer data, and platform security. Maintained by the Mystery Unlock operator.",
      },
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link to="/" className="text-sm opacity-70 hover:opacity-100">← Back</Link>
          <h1 className="text-3xl font-black tracking-tight">Trust & Privacy</h1>
          <p className="text-sm opacity-70">
            This page is maintained by the Mystery Unlock operator to answer common security and
            privacy questions. It describes current practices and is editable project content —
            it is not an independent certification or audit.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">Access & authentication</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Shop owners sign in with email and password.</li>
            <li>Customer spins are gated by single-use access codes issued by the shop owner.</li>
            <li>Privileged actions (managing shops, reading codes) require an authenticated server-side check.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">Data we collect</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Shop owner: email address and the shop content they create (name, slug, logo, prizes).</li>
            <li>Customers: an optional first name they type before spinning, and the prize they won.</li>
            <li>We do not collect payment information through this app.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">How data is protected</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Access codes and spin results are not exposed to the public API; only the server can read or modify them.</li>
            <li>Public shop pages expose only the shop's display fields (name, slug, logo, prize wheel) — internal owner identifiers are not returned to anonymous visitors.</li>
            <li>Role grants (e.g. super admin) can only be made server-side; users cannot grant roles to themselves from the client.</li>
            <li>Row-level security is enabled on all user data tables.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">Shared responsibility</h2>
          <p className="text-sm">
            Mystery Unlock runs on the Lovable Cloud platform, which provides hosting, managed
            authentication, and the database. The Mystery Unlock operator is responsible for shop
            content, prize rules, who they grant admin access to, and how they communicate
            with their customers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">Data deletion</h2>
          <p className="text-sm">
            Shop owners can delete spin records and unused codes from the shop dashboard. To
            request deletion of an account or all related data, contact the shop operator
            directly.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">Reporting a security issue</h2>
          <p className="text-sm">
            If you believe you have found a security issue, please contact the shop operator
            with details so it can be triaged and addressed.
          </p>
        </section>
      </div>
      </div>
      <Footer />
    </div>
  );
}
