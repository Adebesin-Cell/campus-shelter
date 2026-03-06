import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

/**
 * GET /api/auth/me
 * Get current authenticated user details from DB.
 */
export async function GET(request: NextRequest) {
	try {
		const authUser = requireAuth(request);

		const user = await prisma.user.findUnique({
			where: { id: authUser.userId },
			select: {
				id: true,
				name: true,
				email: true,
				phone: true,
				role: true,
				verified: true,
				landlordStatus: true,
				suspensionReason: true,
				idCardUrl: true,
				createdAt: true,
			},
		});

		if (!user) {
			return notFound("User not found");
		}

		return success({ user });
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized(error.message);
		}
		console.error("[Get Me Error]", error);
		return serverError("Failed to fetch user profile");
	}
}

/**
 * PATCH /api/auth/me
 * Update current user's name and phone.
 */
export async function PATCH(request: NextRequest) {
	try {
		const authUser = requireAuth(request);
		const body = await request.json();
		const { name, phone } = body as { name?: string; phone?: string };

		if (name !== undefined && name.trim().length < 2) {
			return badRequest("Name must be at least 2 characters");
		}

		const updated = await prisma.user.update({
			where: { id: authUser.userId },
			data: {
				...(name !== undefined && { name: name.trim() }),
				...(phone !== undefined && { phone: phone.trim() || null }),
			},
			select: {
				id: true,
				name: true,
				email: true,
				phone: true,
				role: true,
				verified: true,
				landlordStatus: true,
				suspensionReason: true,
				idCardUrl: true,
				createdAt: true,
			},
		});

		return success({ user: updated });
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized(error.message);
		}
		console.error("[Update Me Error]", error);
		return serverError("Failed to update profile");
	}
}
