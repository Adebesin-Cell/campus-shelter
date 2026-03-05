import type { NextRequest } from "next/server";
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
import { sanitizeText } from "@/lib/sanitize";
import { sendAppealDecisionEmail } from "@/lib/email";

/**
 * PATCH /api/admin/appeals/[id]
 * Approve or reject an appeal (admin only).
 * If approved, the landlord's status is restored to VERIFIED.
 * Uses a transaction to ensure atomicity.
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
		const status = body.status as string;
		const rawAdminNote = body.adminNote as string | undefined;
		const adminNote = rawAdminNote ? sanitizeText(rawAdminNote) : null;

		if (!["APPROVED", "REJECTED"].includes(status)) {
			return badRequest("Status must be APPROVED or REJECTED");
		}

		const appeal = await prisma.appeal.findUnique({
			where: { id },
			include: { user: true },
		});

		if (!appeal) {
			return notFound("Appeal not found");
		}

		if (appeal.status !== "PENDING") {
			return badRequest("This appeal has already been processed");
		}

		// Use transaction to ensure appeal + user updates are atomic
		const updatedAppeal = await prisma.$transaction(async (tx) => {
			const updated = await tx.appeal.update({
				where: { id },
				data: {
					status: status as "APPROVED" | "REJECTED",
					adminNote,
					processedBy: admin.userId,
					processedAt: new Date(),
				},
			});

			if (status === "APPROVED") {
				await tx.user.update({
					where: { id: appeal.userId },
					data: {
						landlordStatus: "VERIFIED",
						verified: true,
						suspensionReason: null,
					},
				});
			}

			return updated;
		});

		// Send email notification (fire-and-forget)
		sendAppealDecisionEmail(
			appeal.user.email,
			appeal.user.name,
			status as "APPROVED" | "REJECTED",
			adminNote || undefined,
		).catch((err) =>
			console.error("[Appeal Email Error]", err),
		);

		return success(updatedAppeal);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can process appeals")
				: unauthorized(error.message);
		}
		console.error("[Admin Process Appeal Error]", error);
		return serverError("Failed to process appeal");
	}
}
