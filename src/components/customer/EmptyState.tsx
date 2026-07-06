type Props = {
  icon: string;
  heading: string;
  body: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyState({ icon, heading, body, action }: Props) {
  return (
    <div className="text-center py-16 px-4 animate-fade-in">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center text-3xl" aria-hidden="true">
        {icon}
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
