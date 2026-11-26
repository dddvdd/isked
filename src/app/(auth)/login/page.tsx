"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  signInWithPasswordAction,
  signUpWithPasswordAction,
} from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const res = await signInWithPasswordAction({ email, password });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push("/dashboard/event-types");
        router.refresh();
      } else {
        const res = await signUpWithPasswordAction({
          email,
          password,
          fullName,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.hasSession) {
          router.push("/dashboard/event-types");
          router.refresh();
        } else {
          setMessage(
            "Check your email for a confirmation link to finish signing up."
          );
        }
      }
    } catch {
      setError("Authentication request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) {
        setError("Google sign-in could not be started.");
        setOauthLoading(false);
      }
    } catch {
      setError("Google sign-in failed.");
      setOauthLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 text-xl font-semibold tracking-tight"
      >
        <Calendar className="h-6 w-6 text-primary" />
        <span className="font-brand">Isked</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Sign in to manage your event types, availability, and bookings."
              : "Start scheduling meetings with your own public booking link."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={oauthLoading || loading}
          >
            {oauthLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Juan Dela Cruz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                placeholder="••••••••"
                required
                minLength={mode === "signup" ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "signup" && (
                <p className="text-[11px] text-muted-foreground">
                  Minimum 8 characters with uppercase, lowercase, and a number.
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
                {message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>

          <p className="text-center text-[11px] text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Data Privacy Notice
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
