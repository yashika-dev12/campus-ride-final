import { IndianRupee, Leaf, Route, Zap } from "lucide-react";
import { useImpactStats } from "../hooks/useImpactStats";
import { ImpactCard, type ImpactStat } from "./ImpactCard";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const kg = (n: number) => `${Math.round(n).toLocaleString("en-IN")} kg`;
const count = (n: number) => `${Math.round(n)}`;

/**
 * "Your impact" — a live analytics dashboard card. Reads metrics from the ride
 * store via {@link useImpactStats}; values animate and update on their own
 * whenever ride data changes. Responsive 3-up grid that never overflows.
 */
export function ImpactSection() {
  const { totalRides, moneySaved, co2SavedKg } = useImpactStats();

  const stats: ImpactStat[] = [
    { key: "saved", label: "Saved", value: moneySaved, icon: IndianRupee, format: inr },
    { key: "co2", label: "CO₂ cut", value: co2SavedKg, icon: Leaf, format: kg },
    { key: "rides", label: "Rides", value: totalRides, icon: Route, format: count },
  ];

  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Your impact</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--mint)] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--mint)]" />
            </span>
            Live · updates in real time
          </p>
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/60">
          <Zap className="h-4 w-4 text-[color:var(--mint)]" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(({ key, ...stat }) => (
          <ImpactCard key={key} {...stat} />
        ))}
      </div>
    </div>
  );
}
