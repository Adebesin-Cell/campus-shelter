import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

const flagSchema = z.object({
	flagged: z.boolean(), // frontend sends boolean, we convert to DateTime
});

/**
 * PATCH /api/admin/users/[id]/flag
 * Toggle the flagged status of a user account (Admin only).
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const admin = requireAuth(request);
		requireRole(admin, "ADMIN");

		const { id } = await params;
		const body = await request.json();

		const parsed = flagSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const user = await prisma.user.findUnique({ where: { id } });
		if (!user) {
			return notFound("User not found");
		}

		const updatedUser = await prisma.user.update({
			where: { id },
			data: { flaggedAt: parsed.data.flagged ? new Date() : null },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				flaggedAt: true,
			},
		});

		return success(updatedUser);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can flag users")
				: unauthorized("You must be logged in");
		}
		console.error("[Admin Flag User Error]", error);
		return serverError("Failed to update flag status");
	}
}
