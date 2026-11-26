"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security";

const signInSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").max(254),
  password: z.string().min(1, "Password is required").max(128),
});

const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

const signUpSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").max(254),
  password: strongPasswordSchema,
  fullName: z.string().trim().max(120).optional(),
});

export async function signInWithPasswordAction(rawInput: {
  email: string;
  password: string;
}) {
  const allowed = await checkRateLimit({
    namespace: "auth-signin",
    limit: 8,
    windowMs: 5 * 60_000,
  });
  if (!allowed) {
    return {
      ok: false as const,
      error: "Too many sign-in attempts. Please wait 5 minutes and try again.",
    };
  }

  const parsed = signInSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid credentials",
    };
  }

  // Per-account limit stops distributed brute-force / credential stuffing
  // against a single email from many different IP addresses.
  const accountAllowed = await checkRateLimit({
    namespace: "auth-signin-account",
    identifier: parsed.data.email,
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!accountAllowed) {
    return {
      ok: false as const,
      error:
        "Too many sign-in attempts for this account. Please wait 15 minutes and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false as const,
      error: "Invalid email or password.",
    };
  }

  return { ok: true as const };
}

export async function signUpWithPasswordAction(rawInput: {
  email: string;
  password: string;
  fullName?: string;
}) {
  const allowed = await checkRateLimit({
    namespace: "auth-signup",
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!allowed) {
    return {
      ok: false as const,
      error: "Too many sign-up attempts. Please wait a few minutes.",
    };
  }

  const parsed = signUpSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid sign-up details",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName || undefined,
      },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    return {
      ok: false as const,
      error: "Unable to create account with the provided details.",
    };
  }

  return {
    ok: true as const,
    hasSession: Boolean(data.session),
  };
}

export async function signOutAction() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
