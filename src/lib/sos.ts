import { createServerFn } from "@tanstack/react-start";

/**
 * Payload sent when a rider triggers the Emergency SOS button.
 */
export interface SosRequest {
  rideId: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface SosResponse {
  success: boolean;
  id: string;
}

// In-memory store of received SOS alerts (resets on server restart). In a real
// deployment this is where you'd persist to a database / page the safety team.
const sosLog: (SosRequest & { id: string; receivedAt: string })[] = [];

/**
 * Backend endpoint for Emergency SOS alerts. Runs on the server: validates the
 * request, stores/logs it, and returns success. This is the POST /api/sos
 * equivalent for this TanStack Start app (server functions are its backend).
 */
export const sendSos = createServerFn({ method: "POST" })
  .inputValidator((data: SosRequest) => {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid SOS payload.");
    }
    const invalid: string[] = [];
    if (typeof data.rideId !== "string" || data.rideId.trim() === "") invalid.push("rideId");
    if (typeof data.userId !== "string" || data.userId.trim() === "") invalid.push("userId");
    if (
      typeof data.latitude !== "number" ||
      Number.isNaN(data.latitude) ||
      data.latitude < -90 ||
      data.latitude > 90
    ) {
      invalid.push("latitude");
    }
    if (
      typeof data.longitude !== "number" ||
      Number.isNaN(data.longitude) ||
      data.longitude < -180 ||
      data.longitude > 180
    ) {
      invalid.push("longitude");
    }
    if (typeof data.timestamp !== "string" || data.timestamp.trim() === "") invalid.push("timestamp");
    if (invalid.length > 0) {
      throw new Error(`Invalid SOS request. Check: ${invalid.join(", ")}.`);
    }
    return data;
  })
  .handler(async ({ data }): Promise<SosResponse> => {
    const id = `sos_${Date.now()}_${sosLog.length + 1}`;
    const record = { ...data, id, receivedAt: new Date().toISOString() };
    sosLog.push(record);
    // Log/store the alert so the safety team can act on it.
    console.log("[SOS] Emergency alert received:", record);
    return { success: true, id };
  });
