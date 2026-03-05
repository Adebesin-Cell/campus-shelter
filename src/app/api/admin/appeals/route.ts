import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbidden, serverError, success, unauthorized } from "@/lib/responses";

/**
 * GET /api/admin/appeals
 * List all appeals (admin only).
 */
export async function GET(request: NextRequest) {
	try {
		const admin = requireAuth(request);
		requireRole(admin, "ADMIN");

		const appeals = await prisma.appeal.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						landlordStatus: true,
					},
				},
			},
		});

		return success(appeals);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can view appeals")
				: unauthorized(error.message);
		}
		console.error("[Admin Get Appeals Error]", error);
		return serverError("Failed to fetch appeals");
	}
}
