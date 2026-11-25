import type { User as SupabaseUser } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const RESERVED_USERNAMES = new Set([
  "login",
  "signup",
  "auth",
  "dashboard",
  "booking",
  "api",
  "settings",
  "admin",
]);

function sanitizeUsernameBase(email: string): string {
  const prefix = email.split("@")[0] ?? "user";
  const cleaned = prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  if (!cleaned || RESERVED_USERNAMES.has(cleaned)) {
    return "host";
  }
  return cleaned;
}

async function generateUniqueUsername(email: string): Promise<string> {
  const base = sanitizeUsernameBase(email);

  const existing = await prisma.user.findUnique({
    where: { username: base },
    select: { id: true },
  });

  if (!existing) {
    return base;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}-${suffix}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Ensures a Supabase-authenticated user has a corresponding Prisma User record
 * with a unique username, default UTC timezone, and Mon-Fri 09:00-17:00 availability.
 */
export async function ensureUserOnboarded(authUser: SupabaseUser) {
  if (!authUser.email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  const existingById = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (existingById) {
    return existingById;
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: authUser.email },
  });

  if (existingByEmail) {
    return existingByEmail;
  }

  const username = await generateUniqueUsername(authUser.email);
  const fullName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    null;
  const avatarUrl =
    (authUser.user_metadata?.avatar_url as string | undefined) ?? null;

  const weekdayAvailability = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
  }));

  return prisma.user.create({
    data: {
      id: authUser.id,
      email: authUser.email,
      username,
      name: fullName,
      avatarUrl,
      timezone: "UTC",
      availabilities: {
        create: weekdayAvailability,
      },
    },
  });
}

/**
 * Returns the currently authenticated and onboarded Prisma User, or null.
 */
export async function getCurrentUser() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return ensureUserOnboarded(user);
}

/**
 * Requires an authenticated user; redirects to /login otherwise.
 */
export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

