import { createServerFn } from "@tanstack/react-start";

/**
 * A single class slot extracted from a student's timetable.
 */
export interface ClassSession {
  day: string;
  subject: string;
  startTime: string;
  endTime: string;
}

/**
 * Structured result returned to the dashboard AI Ride Matching card.
 */
export interface TimetableAnalysis {
  classTimings: ClassSession[];
  lastClassEndTime: string;
  days: string[];
  subjects: string[];
}

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ANALYSIS_PROMPT = `You are analyzing a university student's class timetable, provided as a PDF or an image.
Read the timetable carefully and extract the schedule.

Return the result and nothing else. Rules:
- "classTimings": every class slot, each with its day, subject, startTime and endTime.
- Use 12-hour times like "9:00 AM" or "1:15 PM".
- "lastClassEndTime": the latest class end time across the whole week, formatted the same way.
- "days": the distinct days that have at least one class, in week order.
- "subjects": the distinct subject names.
If the image is unreadable or is clearly not a timetable, return empty arrays and an empty lastClassEndTime.`;

// Gemini structured-output schema so the model returns predictable JSON.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    classTimings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string" },
          subject: { type: "string" },
          startTime: { type: "string" },
          endTime: { type: "string" },
        },
        required: ["day", "subject", "startTime", "endTime"],
      },
    },
    lastClassEndTime: { type: "string" },
    days: { type: "array", items: { type: "string" } },
    subjects: { type: "array", items: { type: "string" } },
  },
  required: ["classTimings", "lastClassEndTime", "days", "subjects"],
};

function toBase64(bytes: Uint8Array): string {
  // Buffer exists in the Node/Nitro server runtime; fall back to btoa if not.
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Server function: accepts a timetable PDF/image upload, analyzes it with the
 * Google Gemini API, and returns structured timetable data to the frontend.
 * Runs only on the server, so the API key is never shipped to the client.
 */
export const analyzeTimetable = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected a multipart form upload.");
    }
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("No timetable file was provided.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("File is too large. Please upload a timetable under 10 MB.");
    }
    const type = file.type || "";
    const isSupported = type === "application/pdf" || type.startsWith("image/");
    if (!isSupported) {
      throw new Error("Unsupported file type. Please upload a PDF or an image.");
    }
    return file;
  })
  .handler(async ({ data: file }): Promise<TimetableAnalysis> => {
    const apiKey =
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Timetable analysis is not configured. Add GEMINI_API_KEY to your .env file."
      );
    }

    const base64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    const mimeType = file.type || "application/octet-stream";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: ANALYSIS_PROMPT },
                { inlineData: { mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Keep the raw provider detail in server logs, show a clean message to users.
      console.error(`Gemini request failed (${response.status}): ${detail}`);
      if ([400, 401, 403].includes(response.status)) {
        throw new Error("Timetable analysis is misconfigured. Please check the Gemini API key.");
      }
      throw new Error("Couldn't analyze the timetable right now. Please try again.");
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini did not return any timetable data.");
    }

    let parsed: TimetableAnalysis;
    try {
      parsed = JSON.parse(text) as TimetableAnalysis;
    } catch {
      throw new Error("Could not read the timetable. Please try a clearer file.");
    }

    if (!parsed.lastClassEndTime || parsed.classTimings?.length === 0) {
      throw new Error(
        "We couldn't detect a class schedule in that file. Please upload a clear timetable."
      );
    }

    return {
      classTimings: parsed.classTimings ?? [],
      lastClassEndTime: parsed.lastClassEndTime,
      days: parsed.days ?? [],
      subjects: parsed.subjects ?? [],
    };
  });
