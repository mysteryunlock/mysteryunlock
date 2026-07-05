import { type ReactNode, useEffect, useState } from "react";

export function TabMount({ active, children }: { active: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(active);
  useEffect(() => { if (active) setMounted(true); }, [active]);
  if (!mounted) return null;
  return <div style={{ display: active ? undefined : "none" }}>{children}</div>;
}
