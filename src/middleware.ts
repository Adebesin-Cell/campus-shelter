import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Edge Middleware.
 *
 * Note: JWT verification with `jsonwebtoken` (Node.js-only) cannot run in
 * Edge Runtime.  Per-route auth is handled inside each route handler via
 * `getAuthUser()` / `requireAuth()` from `@/lib/auth`.
 *
 * This middleware can be used for CORS headers, rate-limiting stubs, or
 * request logging in the future.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
