import { useMemo, useSyncExternalStore } from "react";
import { computeImpact, getRides, subscribeRides, type ImpactMetrics } from "../lib/rides";

/**
 * Live "Your impact" metrics. Subscribes to the ride store, so the values
 * recompute and re-render automatically whenever a ride is created, joined,
 * completed, or cancelled — no page refresh needed.
 */
export function useImpactStats(): ImpactMetrics {
  const rides = useSyncExternalStore(subscribeRides, getRides, getRides);
  return useMemo(() => computeImpact(rides), [rides]);
}
