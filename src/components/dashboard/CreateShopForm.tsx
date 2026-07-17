import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createShop } from "@/lib/shops.functions";
import { parseServerValidationError } from "@/lib/utils";
import { autoSlug, slugRe } from "./utils";

export function CreateShopForm({ onCreated, onSignOut, doCreate }: { onCreated: () => void; onSignOut: () => void; doCreate: ReturnType<typeof useServerFn<typeof createShop>> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const desired = slug || autoSlug(name);
      if (!name.trim()) throw new Error("Shop name is required");
      if (!slugRe.test(desired)) throw new Error("Invalid URL slug");
      await doCreate({ data: { name: name.trim(), slug: desired } });
      onCreated();
    } catch (e2) {
      setErr(parseServerValidationError(e2) ?? (e2 instanceof Error ? e2.message : "Failed to create shop"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6">
      <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-sm space-y-3">
        <p className="text-xs uppercase tracking-widest text-gold">Create your shop</p>
        <input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }} placeholder="Shop name" className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        <div className="flex items-center bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3">
          <span className="text-muted-foreground text-sm mr-1">/s/</span>
          <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="my-shop" className="flex-1 bg-transparent outline-none" />
        </div>
        {err && <p className="text-destructive text-sm">{err}</p>}
        <button disabled={busy} className="w-full gradient-primary text-white font-bold py-3 rounded-xl disabled:opacity-60">
          {busy ? "Creating..." : "Create shop"}
        </button>
        <button type="button" onClick={onSignOut} className="w-full text-xs text-muted-foreground">Sign out</button>
      </form>
    </div>
  );
}
