import type { LucideIcon } from "lucide-react";

type Props = {
  /** Pass a LucideIcon component or a legacy emoji string. */
  icon: LucideIcon | string;
  heading: string;
  body: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyState({ icon: Icon, heading, body, action }: Props) {
  return (
    <div className="text-center py-16 px-4 animate-fade-in">
      <div
        className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center"
        aria-hidden="true"
      >
        {typeof Icon === "string"
          ? <span className="text-3xl">{Icon}</span>
          : <Icon className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
        }
      </div>
      <p className="font-bold text-foreground text-base">{heading}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
