/**
 * Simple in-memory rate limiter for API routes.
 * Tracks request counts per IP within a sliding window.
 */

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(
	() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (now > entry.resetAt) store.delete(key);
		}
	},
	5 * 60 * 1000,
);

interface RateLimitOptions {
	/** Max requests allowed within the window */
	max: number;
	/** Window duration in seconds */
	windowSec: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
}

export function checkRateLimit(
	key: string,
	opts: RateLimitOptions,
): RateLimitResult {
	const now = Date.now();
	const entry = store.get(key);

	if (!entry || now > entry.resetAt) {
		// First request or window expired
		store.set(key, { count: 1, resetAt: now + opts.windowSec * 1000 });
		return {
			allowed: true,
			remaining: opts.max - 1,
			resetAt: now + opts.windowSec * 1000,
		};
	}

	entry.count++;
	if (entry.count > opts.max) {
		return { allowed: false, remaining: 0, resetAt: entry.resetAt };
	}

	return {
		allowed: true,
		remaining: opts.max - entry.count,
		resetAt: entry.resetAt,
	};
}

/**
 * Extract client IP from request headers (works behind proxies).
 */
export function getClientIp(request: Request): string {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		"unknown"
	);
}
