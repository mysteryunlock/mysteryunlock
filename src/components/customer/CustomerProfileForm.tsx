import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { updateMyProfileFn } from "@/lib/customer-auth.functions";
import { parseServerValidationError } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  customer: { name: string | null; phone: string | null; email: string };
  onSaved:  () => void;
};

export function CustomerProfileForm({ customer, onSaved }: Props) {
  const doUpdate = useServerFn(updateMyProfileFn);

  const [name,    setName]    = useState(customer.name  ?? "");
  const [phone,   setPhone]   = useState(customer.phone ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const dirty = name !== (customer.name ?? "") || phone !== (customer.phone ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length > 80)  { setError("Name must be 80 characters or fewer."); return; }
    if (trimmedPhone && !/^[+\d][\d\s\-()]{4,29}$/.test(trimmedPhone)) {
      setError("Enter a valid phone number (e.g. +1 555-1234).");
      return;
    }
    setError(""); setLoading(true);
    try {
      await doUpdate({
        data: {
          ...(trimmedName  ? { name: trimmedName }   : {}),
          phone: trimmedPhone,
        },
      });
      toast.success("Profile saved");
      onSaved();
    } catch (err) {
      setError(parseServerValidationError(err) ?? (err instanceof Error ? err.message : "Could not save profile."));
    } finally { setLoading(false); }
  };

  const inputCls = "w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/15 transition-colors";

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl bg-card border border-border p-5 shadow-sm">
      {/* Email — read-only */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">
          Email address
        </label>
        <input
          type="email"
          value={customer.email}
          disabled
          className={`${inputCls} opacity-60 cursor-not-allowed`}
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Email changes are managed through sign-in.
        </p>
      </div>

      {/* Display name */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">
          Display name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="Your name"
          maxLength={80}
          className={inputCls}
        />
      </div>

      {/* Phone */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">
          Phone number <span className="normal-case text-[10px]">(optional)</span>
        </label>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError(""); }}
          placeholder="+1 555-1234"
          maxLength={30}
          className={inputCls}
        />
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <button
        type="submit"
        disabled={loading || !dirty}
        className="relative z-10 w-full gradient-primary text-white font-bold py-3.5 rounded-xl shadow-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
