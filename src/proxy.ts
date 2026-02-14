import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/api/docs", "/api-docs"];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Only protect /api/* routes
	if (!pathname.startsWith("/api")) {
		return NextResponse.next();
	}

	// Allow Swagger UI and spec through without API key
	if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
		return NextResponse.next();
	}

	const apiKey = request.headers.get("x-api-key");
	const expectedKey = process.env.API_KEY;

	if (!expectedKey || apiKey !== expectedKey) {
		return NextResponse.json(
			{ success: false, message: "Invalid or missing API key" },
			{ status: 401 },
		);
	}

	// Set CORS headers
	const response = NextResponse.next();
	response.headers.set("Access-Control-Allow-Origin", "*");
	response.headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PATCH, DELETE, OPTIONS",
	);
	response.headers.set(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization, x-api-key",
	);
	return response;
}

export const config = {
	matcher: ["/api/:path*"],
};
