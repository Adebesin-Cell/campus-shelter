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
 * PATCH /api/admin/messages/[id]/unflag
 * Resolve/unflag a flagged message (Admin only).
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const admin = requireAuth(request);
		requireRole(admin, "ADMIN");

		const { id } = await params;

		const message = await prisma.message.findUnique({ where: { id } });
		if (!message) {
			return notFound("Message not found");
		}

		const updatedMessage = await prisma.message.update({
			where: { id },
			data: { flaggedAt: null },
			include: {
				sender: { select: { id: true, name: true, email: true } },
				receiver: { select: { id: true, name: true, email: true } },
			},
		});

		return success(updatedMessage);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can unflag messages")
				: unauthorized();
		}
		console.error("[Admin Unflag Message Error]", error);
		return serverError("Failed to unflag message");
	}
}
