export function SecondaryHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={onBack} className="text-sm px-2.5 py-1.5 rounded-lg bg-[#F5F7FA] text-[#0c2340] hover:bg-[#ECEFF5]">← Back</button>
      <h2 className="text-lg font-black text-[#0c2340]">{title}</h2>
    </div>
  );
}
