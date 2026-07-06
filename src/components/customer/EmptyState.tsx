type Props = {
  icon: string;
  heading: string;
  body: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyState({ icon, heading, body, action }: Props) {
  return (
    <div className="text-center py-14">
      <p className="text-5xl mb-4" aria-hidden="true">{icon}</p>
      <p className="font-bold text-foreground text-base">{heading}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">{body}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2.5 rounded-xl gradient-primary text-[#0F1115] text-sm font-bold"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
