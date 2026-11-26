import type { CookieOptions } from "@supabase/ssr";

/**
 * Hardens Supabase session cookies written by the server (proxy, Server Actions,
 * Route Handlers): HttpOnly so injected JavaScript can never read the session
 * tokens, SameSite=Lax against cross-site request forgery, and Secure in production.
 *
 * The browser Supabase client is only used to start the Google OAuth redirect
 * (PKCE code verifier), which does not need to read these session cookies.
 */
export function hardenCookieOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: options.path ?? "/",
  };
}
