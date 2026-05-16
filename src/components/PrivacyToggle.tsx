import { cn } from "@/lib/utils";

export function PrivacyToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full flex items-start justify-between gap-4 text-left p-4 rounded-2xl border transition-colors",
        "bg-card/60 border-border/60 hover:bg-card/80 disabled:opacity-50",
        !checked && "border-primary/30 bg-primary/5"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <span
        className={cn(
          "shrink-0 w-11 h-6 rounded-full relative transition-colors mt-0.5",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}
