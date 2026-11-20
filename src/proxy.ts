import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthed } from "@/lib/auth";

// Everything requires the devbot password except the unlock page itself and
// static assets. API routes also check on their own (see lib/auth.ts).
export function proxy(request: NextRequest) {
  if (isAuthed(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Locked. Enter your devbot password." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|unlock|api/unlock).*)",
  ],
};
