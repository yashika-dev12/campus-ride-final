export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  university: string;
  course: string;
  graduationYear: string;
  profileImage?: string;
  isVerified: boolean;
  verifiedAt: string | null;
  trustScore: number;
  rating: number;
  rideCount?: number;
  initials: string;
  dept: string;
};

/**
 * Database Repository Interface
 *
 * All methods are asynchronous to mimic a network database (Supabase, Prisma, MongoDB, etc.).
 * To migrate to a real database:
 * 1. Implement this interface using your database client.
 * 2. Export the new client implementation as `db`.
 */
export interface UserDatabase {
  getUser(userId: string): Promise<UserProfile | null>;
  saveUser(user: UserProfile): Promise<UserProfile>;
  createUser(email: string, details?: Partial<UserProfile>): Promise<UserProfile>;
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(" ") || "Campus Rider"
  );
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function universityFromEmail(email: string): string {
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

class LocalStorageDatabase implements UserDatabase {
  private getStorageState(): any {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("campus-ride:v1");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveStorageState(user: UserProfile) {
    if (typeof window === "undefined") return;
    try {
      const state = this.getStorageState() || { rides: [] };
      state.user = user;
      window.localStorage.setItem("campus-ride:v1", JSON.stringify(state));
    } catch (e) {
      console.error("[Database Persistence Error]:", e);
    }
  }

  async getUser(userId: string): Promise<UserProfile | null> {
    const state = this.getStorageState();
    if (state && state.user && state.user.id === userId) {
      return state.user;
    }
    return null;
  }

  async saveUser(user: UserProfile): Promise<UserProfile> {
    this.saveStorageState(user);
    return user;
  }

  async createUser(email: string, details?: Partial<UserProfile>): Promise<UserProfile> {
    const name = details?.name || nameFromEmail(email);
    const university = details?.university || universityFromEmail(email);
    const course = details?.course || "CSE";
    const graduationYear = details?.graduationYear || "2026";
    const yearShort = graduationYear.length >= 2 ? graduationYear.slice(-2) : "26";
    const courseCode = course.includes("Computer") || course.toLowerCase().includes("cse") ? "CSE" : course;
    const dept = `${courseCode} '${yearShort}`;

    const user: UserProfile = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      email: email.trim(),
      phone: details?.phone || "",
      university,
      course,
      graduationYear,
      profileImage: details?.profileImage || "",
      isVerified: details?.isVerified ?? false,
      verifiedAt: details?.verifiedAt || null,
      trustScore: details?.trustScore ?? 96,
      rating: details?.rating ?? 4.9,
      rideCount: details?.rideCount ?? 14,
      initials: initialsOf(name),
      dept,
    };

    this.saveStorageState(user);
    return user;
  }
}

export const db: UserDatabase = new LocalStorageDatabase();
