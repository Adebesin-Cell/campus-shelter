import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, serverError, success, unauthorized } from "@/lib/responses";

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
