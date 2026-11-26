import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hardenCookieOptions } from "@/lib/supabase/cookie-options";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lowerPath = pathname.toLowerCase();
  if (
    lowerPath === "/.env" ||
    lowerPath.startsWith("/.env.") ||
    lowerPath === "/.git" ||
    lowerPath.startsWith("/.git/")
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, hardenCookieOptions(options))
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isVerifiedUser = Boolean(user?.email_confirmed_at);

  if (!isVerifiedUser && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isVerifiedUser && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/event-types";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

