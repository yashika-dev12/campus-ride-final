import { useSyncExternalStore } from "react";
import { db } from "./db";

/* ---------------------------------------------------------------------------
 * Campus Ride — Unified Centralized Reactive Data Store & Engine
 * 
 * This merged version includes:
 * - Full vehicle / payment / trust-score / verification / database-backed profile
 * - Event ID association for campus events (Rangrez, Hackathon, Sports Fest, etc.)
 * - All ride management functionality
 * - Impact metrics
 * - OTP verification support
 * ------------------------------------------------------------------------- */

/* ---------------------------------- Types --------------------------------- */

export type LatLng = { lat: number; lng: number };

export type Driver = {
  id: string;
  name: string;
  dept: string;
  initials: string;
  color: string;
  rating: number;
};

export type Vehicle = {
  id: string;
  name: string; // e.g., "Hyundai i20"
  model: string; // e.g., "i20"
  brand?: string; // e.g., "Hyundai"
  color?: string; // e.g., "White"
  registrationNumber: string; // e.g., "PB-11-AK-2205"
  totalSeats: number; // 2 to 7
  isDefault?: boolean;
};

export type RideCategory = "Upcoming" | "Completed" | "Cancelled";
export type RideStatus = "Available" | "Full" | "Completed" | "Cancelled";

export type Ride = {
  id: string;
  driver: Driver;
  from: string;
  to: string;
  fromCoords?: LatLng | null;
  toCoords?: LatLng | null;
  date: string; // ISO yyyy-mm-dd
  time: string; // 24h HH:mm
  totalSeats: number;
  availableSeats: number;
  passengers: string[]; // array of user IDs
  cost: number; // Split Fare (₹ per seat)
  totalFare: number; // Total Fare (₹ base + distance * per_km)
  distanceKm: number;
  preferences: string[];
  status: RideStatus;
  createdAt: number;
  soloFare: number;
  vehicle?: Vehicle | null;
  /** Association with a campus event, if any (e.g. "ev_rangrez"). */
  eventId?: string | null;
};

export type PaymentTransaction = {
  id: string;
  rideId?: string;
  amount: number;
  type: "paid" | "received";
  description: string;
  date: string;
  upiId: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  university: string;
  course: string;
  graduationYear: string;
  profileImage?: string;
  photoUrl?: string;
  isVerified: boolean;
  verifiedAt: string | null;
  trustScore: number;
  rating: number;
  rideCount?: number;
  totalRides?: number;
  initials: string;
  dept: string;
  upiId?: string;
  paymentHistory?: PaymentTransaction[];
  preferences?: string[];
  studentIdDoc?: string;
  vehicles?: Vehicle[];
  selectedVehicleId?: string | null;
  plan?: "free" | "premium"; // Premium subscription status
};

/** Alias for compatibility with components referencing UserProfile */
export type UserProfile = User;

export type CampusRideState = {
  user: User | null;
  rides: Ride[];
};

export interface ImpactMetrics {
  totalRides: number;
  moneySaved: number;
  co2SavedKg: number;
}

export type OfferRideInput = {
  from: string;
  to: string;
  fromCoords?: LatLng | null;
  toCoords?: LatLng | null;
  date: string; // ISO yyyy-mm-dd
  time: string; // HH:mm
  seats: number;
  cost?: number;
  distanceKm?: number;
  preferences: string[];
  vehicleId?: string | null;
  vehicle?: Vehicle | null;
  /** Optional campus event this ride is offered for. */
  eventId?: string | null;
};

/* ------------------------------- Constants -------------------------------- */

const STORAGE_KEY = "campus-ride:v4";
const DRIVER_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EC4899", "#0EA5E9", "#8B5CF6"];

export const BASE_FARE = 30; // ₹
export const PER_KM_RATE = 7; // ₹/km
export const CO2_PER_KM = 0.171;

/* -------------------------------- Fare Math ------------------------------- */

/** Total Fare = Base Fare + (Distance x Per KM), rounded to nearest rupee. */
export function calculateTotalFare(distanceKmVal: number, baseFare = BASE_FARE, perKm = PER_KM_RATE): number {
  const dist = Math.max(1, distanceKmVal);
  return Math.round(baseFare + dist * perKm);
}

/** Split Fare = Total Fare / Number of Passengers, rounded to nearest rupee. */
export function calculateSplitFare(totalFare: number, passengerCount: number): number {
  const count = Math.max(1, passengerCount);
  return Math.round(totalFare / count);
}

/* ----------------------- Vehicle Validation & Formatting ------------------ */

export function validateRegistrationNumber(regNo: string): boolean {
  if (!regNo) return false;
  const cleaned = regNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const indianRegRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
  return indianRegRegex.test(cleaned);
}

export function formatRegistrationNumber(regNo: string): string {
  const cleaned = regNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 8) return regNo.trim().toUpperCase();
  const match = /^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{4})$/.exec(cleaned);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}-${match[4]}`;
  }
  return regNo.trim().toUpperCase();
}

/* -------------------------------- Utilities ------------------------------- */

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(" ") || "Campus Rider"
  );
}

export function universityFromEmail(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain.includes("chitkara")) return "Chitkara University";
  if (domain.includes("stanford")) return "Stanford University";
  if (domain.includes("harvard")) return "Harvard University";
  if (domain.includes("mit")) return "MIT";
  if (domain.includes("oxford")) return "Oxford University";
  if (domain.includes("cambridge")) return "Cambridge University";
  if (domain.includes("berkeley")) return "UC Berkeley";
  if (domain.includes("iit")) return "IIT Delhi";
  const part = domain.split(".")[0];
  if (part) return part.charAt(0).toUpperCase() + part.slice(1) + " University";
  return "Chitkara University";
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-07-08" -> "Today" / "Tomorrow" / "Wed, 9 Jul" */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const today = todayISO();
  if (iso === today) return "Today";
  const d = new Date(iso + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** "13:15" -> "1:15 PM". Passes through values that are already formatted. */
export function formatTime(time: string): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return time;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${period}`;
}

/** Great-circle distance in km between two lat/lng points (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

function estimateDistanceKm(fromCoords?: LatLng | null, toCoords?: LatLng | null): number {
  if (fromCoords && toCoords) return distanceKm(fromCoords, toCoords);
  return 30;
}

/* -------------------------------- Impact Math ----------------------------- */

export function rideMoneySaved(ride: Ride): number {
  return Math.max(0, ride.soloFare - ride.cost);
}

export function rideCo2Saved(ride: Ride): number {
  const occupants = ride.passengers.length + 1;
  const solo = ride.distanceKm * CO2_PER_KM;
  return solo * (1 - 1 / occupants);
}

export function computeImpact(rides: readonly Ride[]): ImpactMetrics {
  const shared = rides.filter((r) => r.passengers.length > 0 && r.status !== "Cancelled");
  return {
    totalRides: shared.length,
    moneySaved: Math.round(shared.reduce((sum, r) => sum + rideMoneySaved(r), 0)),
    co2SavedKg: Math.round(shared.reduce((sum, r) => sum + rideCo2Saved(r), 0) * 10) / 10,
  };
}

/* ------------------------------ Seed Database ----------------------------- */

function seedDatabase(): CampusRideState {
  const defaultCar: Vehicle = {
    id: "veh_hyundai_i20",
    name: "Hyundai i20",
    model: "i20",
    brand: "Hyundai",
    color: "White",
    registrationNumber: "PB-11-AK-2205",
    totalSeats: 4,
    isDefault: true,
  };

  const defaultUser: User = {
    id: "user_aditi",
    name: "Aditi Sharma",
    email: "aditi.sharma@chitkara.edu",
    phone: "+91 98765 43210",
    university: "Chitkara University",
    course: "Computer Science & Engineering",
    graduationYear: "2026",
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    trustScore: 98,
    rating: 4.9,
    rideCount: 14,
    totalRides: 14,
    initials: "AS",
    dept: "CSE '26",
    upiId: "username@upici",
    preferences: ["Music OK", "AC on", "No smoking"],
    vehicles: [defaultCar],
    selectedVehicleId: defaultCar.id,
    plan: "free",
    paymentHistory: [
      {
        id: "pay_1",
        amount: 85,
        type: "paid",
        description: "Ride to Chandigarh Sec 17",
        date: todayISO(),
        upiId: "username@upici",
      },
      {
        id: "pay_2",
        amount: 90,
        type: "paid",
        description: "Ride to Elante Mall",
        date: todayISO(),
        upiId: "username@upici",
      },
    ],
  };

  const seedRidesList: Ride[] = [
    {
      id: "ride_rohan_1",
      driver: {
        id: "seed_rohan",
        name: "Rohan Kapoor",
        dept: "CSE '25",
        initials: "RK",
        color: "#4F46E5",
        rating: 4.9,
      },
      from: "Chitkara University, Punjab",
      to: "Sector 17 Plaza, Chandigarh",
      fromCoords: { lat: 30.5161, lng: 76.6596 },
      toCoords: { lat: 30.741, lng: 76.7794 },
      date: todayISO(),
      time: "13:15",
      totalSeats: 3,
      availableSeats: 2,
      passengers: ["user_aditi"],
      distanceKm: 32,
      totalFare: calculateTotalFare(32),
      cost: calculateSplitFare(calculateTotalFare(32), 4),
      soloFare: 320,
      preferences: ["Music OK", "AC on", "No smoking"],
      status: "Available",
      createdAt: Date.now() - 3600000,
      vehicle: defaultCar,
      eventId: null,
    },
    {
      id: "ride_priya_2",
      driver: {
        id: "seed_priya",
        name: "Priya Malhotra",
        dept: "ECE '26",
        initials: "PM",
        color: "#10B981",
        rating: 4.8,
      },
      from: "Chitkara University Campus",
      to: "Elante Mall, Industrial Area Phase I, Chandigarh",
      fromCoords: { lat: 30.5161, lng: 76.6596 },
      toCoords: { lat: 30.7054, lng: 76.8013 },
      date: todayISO(),
      time: "14:00",
      totalSeats: 3,
      availableSeats: 3,
      passengers: [],
      distanceKm: 28,
      totalFare: calculateTotalFare(28),
      cost: calculateSplitFare(calculateTotalFare(28), 4),
      soloFare: 290,
      preferences: ["AC on", "Quiet ride", "Female-only"],
      status: "Available",
      createdAt: Date.now() - 1800000,
      vehicle: {
        id: "veh_priya_swift",
        name: "Maruti Swift",
        model: "Swift",
        brand: "Maruti Suzuki",
        color: "Red",
        registrationNumber: "CH-01-BV-4412",
        totalSeats: 4,
      },
      eventId: null,
    },
    {
      id: "ride_arjun_3",
      driver: {
        id: "seed_arjun",
        name: "Arjun Singh",
        dept: "MBA '25",
        initials: "AS",
        color: "#F59E0B",
        rating: 4.7,
      },
      from: "Boys Hostel D, Campus",
      to: "Panchkula Sector 5",
      fromCoords: { lat: 30.5161, lng: 76.6596 },
      toCoords: { lat: 30.6942, lng: 76.8606 },
      date: todayISO(),
      time: "16:30",
      totalSeats: 2,
      availableSeats: 1,
      passengers: ["seed_rider_x"],
      distanceKm: 35,
      totalFare: calculateTotalFare(35),
      cost: calculateSplitFare(calculateTotalFare(35), 3),
      soloFare: 360,
      preferences: ["Music OK"],
      status: "Available",
      createdAt: Date.now() - 900000,
      vehicle: {
        id: "veh_arjun_city",
        name: "Honda City",
        model: "City",
        brand: "Honda",
        color: "Silver",
        registrationNumber: "HR-03-AA-8811",
        totalSeats: 4,
      },
      eventId: null,
    },
    {
      id: "ride_neha_4",
      driver: {
        id: "seed_neha",
        name: "Neha Verma",
        dept: "Design '27",
        initials: "NV",
        color: "#EC4899",
        rating: 5.0,
      },
      from: "Chitkara University, Punjab",
      to: "Chandigarh International Airport (IXC), Mohali",
      fromCoords: { lat: 30.5161, lng: 76.6596 },
      toCoords: { lat: 30.6735, lng: 76.7885 },
      date: todayISO(),
      time: "18:00",
      totalSeats: 3,
      availableSeats: 3,
      passengers: [],
      distanceKm: 25,
      totalFare: calculateTotalFare(25),
      cost: calculateSplitFare(calculateTotalFare(25), 4),
      soloFare: 270,
      preferences: ["AC on", "Female-only", "Luggage OK"],
      status: "Available",
      createdAt: Date.now() - 300000,
      vehicle: {
        id: "veh_neha_baleno",
        name: "Baleno",
        model: "Baleno",
        brand: "Nexa",
        color: "Blue",
        registrationNumber: "PB-65-CD-1002",
        totalSeats: 4,
      },
      eventId: null,
    },

    /* -------- Campus-event rides (restored from the earlier store) -------- */

    {
      id: "ride_simran_rangrez",
      driver: {
        id: "seed_simran",
        name: "Simran Kaur",
        dept: "ECE '25",
        initials: "SK",
        color: "#EC4899",
        rating: 4.9,
      },
      from: "Chitkara University, Punjab",
      to: "Chitkara University Arena",
      fromCoords: { lat: 30.5161, lng: 76.6596 },
      toCoords: { lat: 30.5175, lng: 76.6552 },
      date: todayISO(),
      time: "08:30",
      totalSeats: 4,
      availableSeats: 3,
      passengers: ["seed_rider_rangrez"],
      distanceKm: 6,
      totalFare: calculateTotalFare(6),
      cost: calculateSplitFare(calculateTotalFare(6), 5),
      soloFare: Math.round(calculateTotalFare(6) * 1.4),
      preferences: ["Music OK", "AC on"],
      status: "Available",
      createdAt: Date.now() - 500000,
      vehicle: {
        id: "veh_simran_i10",
        name: "Grand i10",
        model: "i10",
        brand: "Hyundai",
        color: "Grey",
        registrationNumber: "PB-11-EF-3390",
        totalSeats: 5,
      },
      eventId: "ev_rangrez",
    },
    {
      id: "ride_kabir_rangrez",
      driver: {
        id: "seed_kabir",
        name: "Kabir Singh",
        dept: "ME '26",
        initials: "KS",
        color: "#4F46E5",
        rating: 4.6,
      },
      from: "Chitkara University Arena",
      to: "Chitkara University, Punjab",
      fromCoords: { lat: 30.5175, lng: 76.6552 },
      toCoords: { lat: 30.5161, lng: 76.6596 },
      date: todayISO(),
      time: "20:30",
      totalSeats: 3,
      availableSeats: 3,
      passengers: [],
      distanceKm: 6,
      totalFare: calculateTotalFare(6),
      cost: calculateSplitFare(calculateTotalFare(6), 4),
      soloFare: Math.round(calculateTotalFare(6) * 1.4),
      preferences: ["No smoking", "Quiet ride"],
      status: "Available",
      createdAt: Date.now() - 450000,
      vehicle: {
        id: "veh_kabir_ertiga",
        name: "Ertiga",
        model: "Ertiga",
        brand: "Maruti Suzuki",
        color: "Black",
        registrationNumber: "PB-11-GH-7741",
        totalSeats: 4,
      },
      eventId: "ev_rangrez",
    },
    {
      id: "ride_aarav_hackathon",
      driver: {
        id: "seed_aarav",
        name: "Aarav Sharma",
        dept: "CSE '26",
        initials: "AS",
        color: "#0EA5E9",
        rating: 5.0,
      },
      from: "Patiala Cantt",
      to: "Chitkara Auditorium",
      fromCoords: { lat: 30.3255, lng: 76.4045 },
      toCoords: { lat: 30.3547, lng: 76.3639 },
      date: todayISO(),
      time: "08:00",
      totalSeats: 3,
      availableSeats: 2,
      passengers: ["seed_rider_hackathon"],
      distanceKm: 15,
      totalFare: calculateTotalFare(15),
      cost: calculateSplitFare(calculateTotalFare(15), 4),
      soloFare: Math.round(calculateTotalFare(15) * 1.4),
      preferences: ["Music OK", "AC on"],
      status: "Available",
      createdAt: Date.now() - 400000,
      vehicle: {
        id: "veh_aarav_verna",
        name: "Verna",
        model: "Verna",
        brand: "Hyundai",
        color: "White",
        registrationNumber: "PB-11-JK-1123",
        totalSeats: 4,
      },
      eventId: "ev_hackathon",
    },
    {
      id: "ride_ishita_hackathon",
      driver: {
        id: "seed_ishita",
        name: "Ishita Patel",
        dept: "CSE '27",
        initials: "IP",
        color: "#10B981",
        rating: 4.8,
      },
      from: "Chitkara Auditorium",
      to: "Chandigarh Sector 22",
      fromCoords: { lat: 30.3547, lng: 76.3639 },
      toCoords: { lat: 30.7343, lng: 76.7794 },
      date: todayISO(),
      time: "21:00",
      totalSeats: 4,
      availableSeats: 4,
      passengers: [],
      distanceKm: 15,
      totalFare: calculateTotalFare(15),
      cost: calculateSplitFare(calculateTotalFare(15), 5),
      soloFare: Math.round(calculateTotalFare(15) * 1.4),
      preferences: ["Female-only", "AC on"],
      status: "Available",
      createdAt: Date.now() - 350000,
      vehicle: {
        id: "veh_ishita_baleno",
        name: "Baleno",
        model: "Baleno",
        brand: "Nexa",
        color: "Red",
        registrationNumber: "PB-11-LM-6602",
        totalSeats: 5,
      },
      eventId: "ev_hackathon",
    },
    {
      id: "ride_vikram_sportsfest",
      driver: {
        id: "seed_vikram",
        name: "Vikram Malhotra",
        dept: "MBA '25",
        initials: "VM",
        color: "#F59E0B",
        rating: 4.7,
      },
      from: "Chitkara University, Punjab",
      to: "University Sports Complex",
      fromCoords: { lat: 30.5161, lng: 76.6596 },
      toCoords: { lat: 30.5203, lng: 76.6511 },
      date: todayISO(),
      time: "07:30",
      totalSeats: 3,
      availableSeats: 3,
      passengers: [],
      distanceKm: 3,
      totalFare: calculateTotalFare(3),
      cost: calculateSplitFare(calculateTotalFare(3), 4),
      soloFare: Math.round(calculateTotalFare(3) * 1.4),
      preferences: ["AC on"],
      status: "Available",
      createdAt: Date.now() - 300000,
      vehicle: {
        id: "veh_vikram_city",
        name: "Honda City",
        model: "City",
        brand: "Honda",
        color: "White",
        registrationNumber: "PB-11-NO-2287",
        totalSeats: 4,
      },
      eventId: "ev_sportsfest",
    },
    {
      id: "ride_riya_techconf",
      driver: {
        id: "seed_riya",
        name: "Riya Sen",
        dept: "Design '26",
        initials: "RS",
        color: "#EC4899",
        rating: 4.9,
      },
      from: "Chitkara University, Punjab",
      to: "Seminar Hall-3",
      fromCoords: { lat: 30.5161, lng: 76.6596 },
      toCoords: { lat: 30.5169, lng: 76.6578 },
      date: todayISO(),
      time: "09:15",
      totalSeats: 2,
      availableSeats: 2,
      passengers: [],
      distanceKm: 2,
      totalFare: calculateTotalFare(2),
      cost: calculateSplitFare(calculateTotalFare(2), 3),
      soloFare: Math.round(calculateTotalFare(2) * 1.4),
      preferences: ["Quiet ride"],
      status: "Available",
      createdAt: Date.now() - 250000,
      vehicle: {
        id: "veh_riya_altroz",
        name: "Altroz",
        model: "Altroz",
        brand: "Tata",
        color: "Blue",
        registrationNumber: "PB-11-QR-5519",
        totalSeats: 3,
      },
      eventId: "ev_techconf",
    },
  ];

  return { user: defaultUser, rides: seedRidesList };
}

/* -------------------------------- Persistent Store ------------------------ */

function emptyState(): CampusRideState {
  return seedDatabase();
}

function loadState(): CampusRideState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as CampusRideState;
    if (!parsed || !Array.isArray(parsed.rides)) return emptyState();
    return {
      user: parsed.user ?? emptyState().user,
      rides: parsed.rides.length > 0 ? parsed.rides : emptyState().rides,
    };
  } catch {
    return emptyState();
  }
}

const serverSnapshot: CampusRideState = emptyState();
let state: CampusRideState = emptyState();
let hydrated = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: CampusRideState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — keep in-memory state */
    }
  }
  emit();
}

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = loadState();
  emit();
}

export function subscribeRides(listener: () => void): () => void {
  hydrateFromStorage();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRides(): Ride[] {
  return state.rides;
}

export const rideStore = {
  subscribe(listener: () => void): () => void {
    hydrateFromStorage();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): CampusRideState {
    return state;
  },
  getServerSnapshot(): CampusRideState {
    return serverSnapshot;
  },

  /* ------------------------------- Actions -------------------------------- */

  login(email: string, details?: Partial<User>): User {
    const name = details?.name ?? nameFromEmail(email);
    const university = details?.university ?? universityFromEmail(email);
    const course = details?.course ?? "Computer Science & Engineering";
    const graduationYear = details?.graduationYear ?? "2026";
    const yearShort = graduationYear.length >= 2 ? graduationYear.slice(-2) : "26";
    const courseCode = course.includes("Computer") || course.toLowerCase().includes("cse") ? "CSE" : course;
    const dept = `${courseCode} '${yearShort}`;

    const existing = state.user;
    const defaultCar: Vehicle = {
      id: "veh_hyundai_i20",
      name: "Hyundai i20",
      model: "i20",
      brand: "Hyundai",
      color: "White",
      registrationNumber: "PB-11-AK-2205",
      totalSeats: 4,
      isDefault: true,
    };

    const user: User = {
      id: existing?.email === email ? existing.id : makeId("user"),
      name: existing?.email === email ? existing.name : name,
      email: email.trim(),
      phone: details?.phone ?? existing?.phone ?? "+91 98765 43210",
      university,
      course,
      graduationYear,
      profileImage: details?.profileImage ?? existing?.profileImage ?? "",
      photoUrl: details?.photoUrl ?? existing?.photoUrl ?? "",
      isVerified: details?.isVerified ?? existing?.isVerified ?? true,
      verifiedAt: details?.verifiedAt ?? existing?.verifiedAt ?? new Date().toISOString(),
      trustScore: details?.trustScore ?? existing?.trustScore ?? 98,
      rating: details?.rating ?? existing?.rating ?? 4.9,
      rideCount: details?.rideCount ?? existing?.rideCount ?? 14,
      totalRides: details?.totalRides ?? existing?.totalRides ?? 14,
      initials: initialsOf(name),
      dept,
      upiId: details?.upiId ?? existing?.upiId ?? `${email.split("@")[0]}@upi`,
      paymentHistory: details?.paymentHistory ?? existing?.paymentHistory ?? [],
      preferences: details?.preferences ?? existing?.preferences ?? ["Music OK", "AC on"],
      vehicles: details?.vehicles ?? (existing?.vehicles && existing.vehicles.length > 0 ? existing.vehicles : [defaultCar]),
      selectedVehicleId: details?.selectedVehicleId ?? existing?.selectedVehicleId ?? defaultCar.id,
      plan: details?.plan ?? existing?.plan ?? "free",
    };

    setState({ ...state, user });
    void db.createUser(email, user);
    return user;
  },

  logout() {
    setState({ ...state, user: null });
  },

  updateUserProfile(updates: Partial<User>) {
    if (!state.user) return;
    const name = updates.name?.trim() || state.user.name;
    const course = updates.course?.trim() || state.user.course;
    const graduationYear = updates.graduationYear?.trim() || state.user.graduationYear || "2026";
    const yearShort = graduationYear.length >= 2 ? graduationYear.slice(-2) : "26";
    const courseCode = course.includes("Computer") || course.toLowerCase().includes("cse") ? "CSE" : course;
    const dept = `${courseCode} '${yearShort}`;

    const updatedUser: User = {
      ...state.user,
      ...updates,
      name,
      course,
      graduationYear,
      dept,
      initials: initialsOf(name),
    };

    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
  },

  updateUserEmail(newEmail: string): User | null {
    if (!state.user) return null;
    const university = universityFromEmail(newEmail);
    const updatedUser: User = {
      ...state.user,
      email: newEmail.trim(),
      university,
      isVerified: true,
      verifiedAt: new Date().toISOString(),
    };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
    return updatedUser;
  },

  upgradeToPremium(): User | null {
    if (!state.user) return null;
    const updatedUser: User = {
      ...state.user,
      plan: "premium",
    };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
    return updatedUser;
  },

  /* ---------------------------- Vehicle Actions --------------------------- */

  addVehicle(input: {
    name: string;
    model: string;
    brand?: string;
    color?: string;
    registrationNumber: string;
    totalSeats: number;
  }): { ok: boolean; error?: string; vehicle?: Vehicle } {
    const user = state.user;
    if (!user) return { ok: false, error: "Please sign in to add a vehicle." };
    if (!input.name.trim()) return { ok: false, error: "Vehicle name is required." };
    if (!input.model.trim()) return { ok: false, error: "Car model is required." };
    if (!input.registrationNumber.trim()) return { ok: false, error: "Registration number is required." };
    if (!validateRegistrationNumber(input.registrationNumber)) {
      return {
        ok: false,
        error: "Please enter a valid Indian vehicle registration number (e.g., PB-11-AK-2205).",
      };
    }
    if (!input.totalSeats || input.totalSeats < 2 || input.totalSeats > 7) {
      return { ok: false, error: "Total seats for a car must be between 2 and 7." };
    }

    const formattedReg = formatRegistrationNumber(input.registrationNumber);
    const vehicle: Vehicle = {
      id: makeId("veh"),
      name: input.name.trim(),
      model: input.model.trim(),
      brand: input.brand?.trim(),
      color: input.color?.trim() || "White",
      registrationNumber: formattedReg,
      totalSeats: input.totalSeats,
    };

    const vehicles = [...(user.vehicles ?? []), vehicle];
    const updatedUser: User = {
      ...user,
      vehicles,
      selectedVehicleId: vehicle.id,
    };

    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
    return { ok: true, vehicle };
  },

  updateVehicle(id: string, updates: Partial<Vehicle>): { ok: boolean; error?: string } {
    const user = state.user;
    if (!user) return { ok: false, error: "User not logged in." };
    if (updates.registrationNumber && !validateRegistrationNumber(updates.registrationNumber)) {
      return { ok: false, error: "Please enter a valid Indian registration number." };
    }

    const vehicles = (user.vehicles ?? []).map((v) => {
      if (v.id !== id) return v;
      return {
        ...v,
        ...updates,
        registrationNumber: updates.registrationNumber
          ? formatRegistrationNumber(updates.registrationNumber)
          : v.registrationNumber,
      };
    });

    const updatedUser = { ...user, vehicles };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
    return { ok: true };
  },

  deleteVehicle(id: string): { ok: boolean } {
    const user = state.user;
    if (!user) return { ok: false };
    const vehicles = (user.vehicles ?? []).filter((v) => v.id !== id);
    const selectedVehicleId = user.selectedVehicleId === id ? vehicles[0]?.id ?? null : user.selectedVehicleId;
    const updatedUser = { ...user, vehicles, selectedVehicleId };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
    return { ok: true };
  },

  selectVehicle(id: string) {
    const user = state.user;
    if (!user) return;
    const updatedUser = { ...user, selectedVehicleId: id };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
  },

  togglePreference(pref: string) {
    if (!state.user) return;
    const current = state.user.preferences ?? [];
    const preferences = current.includes(pref)
      ? current.filter((p) => p !== pref)
      : [...current, pref];
    const updatedUser = { ...state.user, preferences };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
  },

  saveUpi(upiId: string) {
    if (!state.user) return;
    const updatedUser = { ...state.user, upiId: upiId.trim() };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
  },

  deleteUpi() {
    if (!state.user) return;
    const updatedUser = { ...state.user, upiId: "" };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
  },

  submitVerification(studentIdDoc: string) {
    if (!state.user) return;
    const updatedUser = {
      ...state.user,
      studentIdDoc,
      isVerified: true,
      verifiedAt: new Date().toISOString(),
    };
    setState({ ...state, user: updatedUser });
    void db.saveUser(updatedUser);
  },

  /* ----------------------------- Ride Actions ----------------------------- */

  addRide(input: OfferRideInput): Ride {
    const user = state.user;
    const driver: Driver = user
      ? {
          id: user.id,
          name: user.name,
          dept: user.dept,
          initials: user.initials,
          color: DRIVER_COLORS[state.rides.length % DRIVER_COLORS.length],
          rating: user.rating || 5.0,
        }
      : {
          id: makeId("driver"),
          name: "You",
          dept: "CSE '26",
          initials: "ME",
          color: DRIVER_COLORS[0],
          rating: 5.0,
        };

    const selectedVehicle = user?.vehicles?.find((v) => v.id === (input.vehicleId || user.selectedVehicleId)) ?? user?.vehicles?.[0] ?? input.vehicle ?? null;

    const distKm =
      input.distanceKm && input.distanceKm > 0
        ? input.distanceKm
        : estimateDistanceKm(input.fromCoords, input.toCoords);

    const totalFare = calculateTotalFare(distKm);
    const passengerCapacity = input.seats + 1; // driver + seats
    const costPerSeat = input.cost && input.cost > 0 ? input.cost : calculateSplitFare(totalFare, passengerCapacity);

    const ride: Ride = {
      id: makeId("ride"),
      driver,
      from: input.from.trim(),
      to: input.to.trim(),
      fromCoords: input.fromCoords ?? null,
      toCoords: input.toCoords ?? null,
      date: input.date,
      time: input.time,
      totalSeats: input.seats,
      availableSeats: input.seats,
      passengers: [],
      totalFare,
      cost: costPerSeat,
      preferences: input.preferences,
      status: "Available",
      createdAt: Date.now(),
      distanceKm: distKm,
      soloFare: Math.round(totalFare * 1.4),
      vehicle: selectedVehicle,
      eventId: input.eventId ?? null,
    };

    setState({ ...state, rides: [ride, ...state.rides] });
    return ride;
  },

  joinRide(rideId: string): { ok: boolean; error?: string } {
    const user = state.user;
    if (!user) return { ok: false, error: "You need to be signed in to join a ride." };
    const ride = state.rides.find((r) => r.id === rideId);
    if (!ride) return { ok: false, error: "This ride is no longer available." };
    if (ride.driver.id === user.id) return { ok: false, error: "You can't join your own ride." };
    if (ride.passengers.includes(user.id))
      return { ok: false, error: "You've already joined this ride." };
    if (ride.availableSeats <= 0) return { ok: false, error: "This ride is full." };

    const updatedRides = state.rides.map((r) => {
      if (r.id !== rideId) return r;
      const nextPassengers = [...r.passengers, user.id];
      const availableSeats = r.availableSeats - 1;
      const passengerCount = nextPassengers.length + 1;
      const cost = calculateSplitFare(r.totalFare, passengerCount);

      return {
        ...r,
        passengers: nextPassengers,
        availableSeats,
        cost,
        status: (availableSeats <= 0 ? "Full" : "Available") as RideStatus,
      };
    });

    const newPayment: PaymentTransaction = {
      id: makeId("pay"),
      rideId,
      amount: ride.cost,
      type: "paid",
      description: `Ride to ${ride.to}`,
      date: todayISO(),
      upiId: user.upiId || "user@upi",
    };

    const totalRidesCount = (user.totalRides ?? user.rideCount ?? 0) + 1;
    const updatedUser: User = {
      ...user,
      totalRides: totalRidesCount,
      rideCount: totalRidesCount,
      paymentHistory: [newPayment, ...(user.paymentHistory ?? [])],
    };

    setState({ user: updatedUser, rides: updatedRides });
    void db.saveUser(updatedUser);
    return { ok: true };
  },

  cancelRide(rideId: string): { ok: boolean; message: string } {
    const user = state.user;
    if (!user) return { ok: false, message: "User not logged in." };
    const ride = state.rides.find((r) => r.id === rideId);
    if (!ride) return { ok: false, message: "Ride not found." };

    if (ride.driver.id === user.id) {
      // Driver cancels entire ride
      const rides = state.rides.map((r) => (r.id === rideId ? { ...r, status: "Cancelled" as RideStatus } : r));
      setState({ ...state, rides });
      return { ok: true, message: "Ride cancelled successfully." };
    } else if (ride.passengers.includes(user.id)) {
      // Passenger leaves ride
      const rides = state.rides.map((r) => {
        if (r.id !== rideId) return r;
        const nextPassengers = r.passengers.filter((id) => id !== user.id);
        const availableSeats = r.availableSeats + 1;
        const cost = calculateSplitFare(r.totalFare, nextPassengers.length + 1);
        return {
          ...r,
          passengers: nextPassengers,
          availableSeats,
          cost,
          status: "Available" as RideStatus,
        };
      });
      setState({ ...state, rides });
      return { ok: true, message: "Booking cancelled successfully." };
    }

    return { ok: false, message: "You are not part of this ride." };
  },
};

/* ------------------------------ Offer Input Validation -------------------- */

const LOCATION_RE = /[a-zA-Z]/;

export function validateOffer(input: Partial<OfferRideInput>): string | null {
  const from = (input.from ?? "").trim();
  const to = (input.to ?? "").trim();
  if (!from) return "Please enter a pickup location.";
  if (from.length < 3 || !LOCATION_RE.test(from)) return "Please enter a valid pickup location.";
  if (!to) return "Please enter a destination.";
  if (to.length < 3 || !LOCATION_RE.test(to)) return "Please enter a valid destination.";
  if (from.toLowerCase() === to.toLowerCase()) return "Pickup and destination must be different.";
  if (!input.date) return "Please choose a departure date.";
  if (input.date < todayISO()) return "Departure date can't be in the past.";
  if (!input.time) return "Please choose a departure time.";
  if (!input.seats || input.seats <= 0) return "Seats must be greater than zero.";
  if (input.cost != null && (Number.isNaN(input.cost) || input.cost < 0))
    return "Please enter a valid contribution amount.";
  return null;
}

/* -------------------------------- React Hooks ----------------------------- */

export function useCampusRide(): CampusRideState {
  return useSyncExternalStore(
    rideStore.subscribe,
    rideStore.getSnapshot,
    rideStore.getServerSnapshot,
  );
}

export const MIN_DATE = todayISO;