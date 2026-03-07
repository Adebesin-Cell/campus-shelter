import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

/**
 * GET /api/admin/users/[id]
 * Get a single user's details (Admin only).
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const admin = requireAuth(request);
		requireRole(admin, "ADMIN");

		const { id } = await params;

		const user = await prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				email: true,
				phone: true,
				role: true,
				verified: true,
				flagged: true,
				landlordStatus: true,
				suspensionReason: true,
				idCardUrl: true,
				createdAt: true,
				updatedAt: true,
				_count: {
					select: {
						properties: true,
						bookings: true,
						reviews: true,
					},
				},
			},
		});

		if (!user) {
			return notFound("User not found");
		}

		return success(user);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Admin access required")
				: unauthorized();
		}
		console.error("[Admin Get User Error]", error);
		return serverError("Failed to fetch user");
	}
}
