import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import type { Role } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const SALT_ROUNDS = 12;

// ─── Password Utilities ───────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
	plain: string,
	hashed: string,
): Promise<boolean> {
	return bcrypt.compare(plain, hashed);
}

// ─── JWT Utilities ────────────────────────────────────────

export interface TokenPayload {
	userId: string;
	role: Role;
}

export function signToken(payload: TokenPayload): string {
	return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
	return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

// ─── Auth Helpers ─────────────────────────────────────────

export interface AuthUser {
	userId: string;
	role: Role;
}

/**
 * Extract and verify JWT from the Authorization header.
 * Returns the authenticated user payload, or null if invalid/missing.
 */
export function getAuthUser(request: NextRequest): AuthUser | null {
	try {
		const authHeader = request.headers.get("authorization");
		if (!authHeader?.startsWith("Bearer ")) return null;

		const token = authHeader.slice(7);
		const payload = verifyToken(token);
		return { userId: payload.userId, role: payload.role };
	} catch {
		return null;
	}
}

/**
 * Require an authenticated user. Throws if not authenticated.
 */
export function requireAuth(request: NextRequest): AuthUser {
	const user = getAuthUser(request);
	if (!user) {
		throw new AuthError("Unauthorized");
	}
	return user;
}

/**
 * Check if the user has one of the required roles.
 */
export function requireRole(user: AuthUser, ...roles: Role[]): void {
	if (!roles.includes(user.role)) {
		throw new AuthError("Forbidden");
	}
}

export class AuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthError";
	}
}
