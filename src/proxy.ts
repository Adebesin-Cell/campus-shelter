import { type NextRequest, NextResponse } from "next/server";
import { env } from "./lib/env";

const PUBLIC_PATHS = ["/api/docs", "/api-docs"];

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Only protect /api/* routes
	if (!pathname.startsWith("/api")) {
		return NextResponse.next();
	}

	// Handle CORS preflight requests immediately — no API key check
	if (request.method === "OPTIONS") {
		return new NextResponse(null, {
			status: 204,
			headers: CORS_HEADERS,
		});
	}

	// Allow Swagger UI and spec through without API key
	if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
		const response = NextResponse.next();
		for (const [key, value] of Object.entries(CORS_HEADERS)) {
			response.headers.set(key, value);
		}
		return response;
	}

	const apiKey = request.headers.get("x-api-key");
	const expectedKey = env.API_KEY;

	if (!expectedKey || apiKey !== expectedKey) {
		return NextResponse.json(
			{ success: false, message: "Invalid or missing API key" },
			{
				status: 401,
				headers: CORS_HEADERS,
			},
		);
	}

	// Set CORS headers on the successful response
	const response = NextResponse.next();
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
}

export const config = {
	matcher: ["/api/:path*"],
};
