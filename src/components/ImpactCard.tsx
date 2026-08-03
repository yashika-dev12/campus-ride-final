import type { LucideIcon } from "lucide-react";
import { useCountUp } from "../hooks/useCountUp";

/** One metric shown in the "Your impact" dashboard. */
export interface ImpactStat {
  /** Stable key for list rendering. */
  key: string;
  label: string;
  /** Raw numeric value; animated and formatted for display. */
  value: number;
  icon: LucideIcon;
  /** Render the animated value as a string (currency, units, etc.). */
  format: (value: number) => string;
}

type ImpactCardProps = Omit<ImpactStat, "key">;

/**
 * A single reusable stat card: gradient icon chip, count-up animated value,
 * and label. Purely presentational — data and formatting are passed in.
 */
export function ImpactCard({ label, value, icon: Icon, format }: ImpactCardProps) {
  const animated = useCountUp(value);

  return (
    <div className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl bg-white/55 px-2 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[var(--shadow-soft)]">
      <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-white shadow-[var(--shadow-soft)] transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-4 w-4" />
      </div>
      <p className="max-w-full truncate text-lg font-bold leading-none text-gradient-brand tabular-nums">
        {format(animated)}
      </p>
      <p className="text-center text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
