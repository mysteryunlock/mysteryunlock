import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Mystery Unlock" },
      {
        name: "description",
        content:
          "Mystery Unlock Terms of Service. Read our acceptable use policy, subscription terms, and liability disclaimer.",
      },
    ],
  }),
  component: TermsPage,
});

const C = {
  bg: "#F7FBFD",
  light: "#D6E6EF",
  primary: "#7FA6B8",
  primaryDark: "#5e8a9e",
  dark: "#2A3E4B",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2
        className="text-xl font-bold"
        style={{ color: C.dark, fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed" style={{ color: `${C.dark}cc` }}>
        {children}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: C.primary }} />
      <span>{children}</span>
    </li>
  );
}

function TermsPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: C.bg, fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm mb-8 hover:opacity-70 transition-opacity"
            style={{ color: `${C.dark}99` }}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current" aria-hidden>
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </Link>

          <header className="mb-10">
            <div
              className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
              style={{ background: C.light, color: C.primaryDark }}
            >
              Legal
            </div>
            <h1
              className="text-4xl font-black tracking-tight mb-3"
              style={{ color: C.dark, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Terms of Service
            </h1>
            <p className="text-sm" style={{ color: `${C.dark}80` }}>
              Last updated: July 2, 2026 · Effective immediately
            </p>
          </header>

          <div
            className="rounded-2xl p-5 mb-10 text-sm"
            style={{ background: C.light, color: `${C.dark}cc` }}
          >
            Please read these Terms of Service carefully before using <strong style={{ color: C.dark }}>Mystery Unlock</strong> ("Service"), operated by Mystery Unlock ("we", "us", or "our"). By accessing or using the Service, you agree to be bound by these Terms.
            If you do not agree, you may not use the Service.
          </div>

          <div className="space-y-10">
            <Section title="1. The Service">
              <p>
                Mystery Unlock is a SaaS platform that allows retail shop owners ("Shop Owners") to create and manage branded spin-to-win prize campaigns. Customers of those shop owners ("End Users") participate in campaigns using single-use access codes provided by the Shop Owner.
              </p>
              <p>
                We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice.
              </p>
            </Section>

            <Section title="2. Accounts">
              <p>To use the Service as a Shop Owner, you must create an account. Accounts are subject to admin approval before activation.</p>
              <ul className="space-y-1.5 list-none pl-0">
                <Bullet>You must provide accurate and complete information when registering</Bullet>
                <Bullet>You are responsible for maintaining the confidentiality of your account credentials</Bullet>
                <Bullet>You must notify us immediately of any unauthorised use of your account</Bullet>
                <Bullet>One person or legal entity may not maintain more than one free account</Bullet>
                <Bullet>You must be at least 18 years old to create an account</Bullet>
              </ul>
              <p>
                We reserve the right to suspend or terminate accounts that violate these Terms or that remain inactive for an extended period.
              </p>
            </Section>

            <Section title="3. Acceptable Use">
              <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not:</p>
              <ul className="space-y-1.5 list-none pl-0">
                <Bullet>Use the Service to run deceptive, fraudulent, or misleading prize campaigns</Bullet>
                <Bullet>Violate any applicable local, national, or international law or regulation, including gambling and lottery laws in your jurisdiction</Bullet>
                <Bullet>Upload or transmit content that is defamatory, obscene, or infringes any third-party intellectual property rights</Bullet>
                <Bullet>Attempt to gain unauthorised access to any part of the Service or its infrastructure</Bullet>
                <Bullet>Use automated tools, bots, or scripts to generate access codes or spin the wheel</Bullet>
                <Bullet>Reverse-engineer, decompile, or disassemble any part of the Service</Bullet>
                <Bullet>Resell or sublicense the Service to third parties without our written consent</Bullet>
              </ul>
              <p>
                You are solely responsible for ensuring that your prize campaigns comply with all applicable laws in your jurisdiction, including any rules around promotions, sweepstakes, and consumer protection.
              </p>
            </Section>

            <Section title="4. Subscriptions & Billing">
              <p>
                Mystery Unlock offers both free and paid subscription plans. Paid plans are billed in advance on a recurring basis (monthly or annually as chosen).
              </p>
              <ul className="space-y-1.5 list-none pl-0">
                <Bullet>You authorise us (or our payment processor) to charge your payment method on the billing cycle you select</Bullet>
                <Bullet>All fees are non-refundable except where required by law or at our sole discretion</Bullet>
                <Bullet>You may cancel your subscription at any time; your access continues until the end of the current billing period</Bullet>
                <Bullet>We may change subscription pricing with at least 30 days' notice before the change takes effect</Bullet>
                <Bullet>Failure to pay may result in suspension or termination of your account</Bullet>
              </ul>
              <p>
                Free plan users may have limited features and campaign volume. We reserve the right to modify free plan limits at any time.
              </p>
            </Section>

            <Section title="5. Intellectual Property">
              <p>
                The Service, including all software, design, trademarks, and content created by Mystery Unlock, is owned by us and protected by applicable intellectual property laws.
              </p>
              <ul className="space-y-1.5 list-none pl-0">
                <Bullet>You retain ownership of content you upload (logos, prize names, etc.)</Bullet>
                <Bullet>By uploading content, you grant us a non-exclusive licence to display and process it solely to operate the Service</Bullet>
                <Bullet>You may not use our trademarks, logos, or branding without prior written consent</Bullet>
              </ul>
            </Section>

            <Section title="6. Data & Privacy">
              <p>
                Your use of the Service is also governed by our{" "}
                <Link to="/privacy" className="underline" style={{ color: C.primaryDark }}>Privacy Policy</Link>,
                which is incorporated into these Terms by reference.
              </p>
              <p>
                As a Shop Owner, you are a data controller for the personal data of your customers (End Users) that you collect through the platform. You are responsible for obtaining any necessary consents and complying with applicable data protection laws.
              </p>
            </Section>

            <Section title="7. Disclaimers">
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="space-y-1.5 list-none pl-0">
                <Bullet>Warranties of merchantability, fitness for a particular purpose, and non-infringement</Bullet>
                <Bullet>Guarantees that the Service will be uninterrupted, error-free, or free of viruses</Bullet>
                <Bullet>Accuracy or completeness of any information provided through the Service</Bullet>
              </ul>
            </Section>

            <Section title="8. Limitation of Liability">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL MYSTERY UNLOCK, ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR:
              </p>
              <ul className="space-y-1.5 list-none pl-0">
                <Bullet>Any indirect, incidental, special, consequential, or punitive damages</Bullet>
                <Bullet>Loss of profits, revenue, data, goodwill, or business opportunities</Bullet>
                <Bullet>Damages arising from unauthorised access to or alteration of your data</Bullet>
                <Bullet>Any matter beyond our reasonable control</Bullet>
              </ul>
              <p>
                Our total aggregate liability to you for any claims arising out of or related to the Service shall not exceed the greater of (a) the amount you paid us in the 12 months preceding the claim or (b) USD $50.
              </p>
            </Section>

            <Section title="9. Indemnification">
              <p>
                You agree to indemnify and hold harmless Mystery Unlock and its affiliates, officers, directors, and employees from any claim, loss, liability, or expense (including reasonable legal fees) arising from:
              </p>
              <ul className="space-y-1.5 list-none pl-0">
                <Bullet>Your use of the Service in violation of these Terms</Bullet>
                <Bullet>Content you upload or publish through the Service</Bullet>
                <Bullet>Your prize campaigns and any obligations to your customers</Bullet>
                <Bullet>Your violation of any third-party rights or applicable law</Bullet>
              </ul>
            </Section>

            <Section title="10. Termination">
              <p>
                Either party may terminate this agreement at any time. We may suspend or terminate your access immediately, without notice, if you breach these Terms.
              </p>
              <p>
                Upon termination, your right to use the Service will immediately cease. Sections on Intellectual Property, Disclaimers, Limitation of Liability, and Indemnification survive termination.
              </p>
            </Section>

            <Section title="11. Governing Law">
              <p>
                These Terms are governed by and construed in accordance with applicable law. Any disputes arising under these Terms shall be resolved through good-faith negotiation first, and if unresolved, through binding arbitration or the courts of competent jurisdiction.
              </p>
            </Section>

            <Section title="12. Changes to These Terms">
              <p>
                We may revise these Terms at any time. We will notify you of material changes by posting the updated Terms on this page with a new "Last updated" date and, where appropriate, by emailing you. Your continued use of the Service after changes become effective constitutes acceptance of the revised Terms.
              </p>
            </Section>

            <Section title="13. Contact">
              <p>Questions about these Terms? Get in touch:</p>
              <div
                className="rounded-xl p-4 mt-2 text-sm"
                style={{ background: "white", border: `1px solid ${C.dark}10` }}
              >
                <strong style={{ color: C.dark }}>Mystery Unlock</strong><br />
                Email:{" "}
                <a href="mailto:support@mysteryunlock.com" className="underline" style={{ color: C.primaryDark }}>
                  support@mysteryunlock.com
                </a><br />
                Website:{" "}
                <a href="https://mysteryunlock.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: C.primaryDark }}>
                  https://mysteryunlock.com
                </a>
              </div>
            </Section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
