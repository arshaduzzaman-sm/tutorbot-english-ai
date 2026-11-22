import { cn } from "@/lib/utils";

/** Accessible progress bar. value is 0..1. */
export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-purple" style={{ width: `${pct}%` }} />
    </div>
  );
}
