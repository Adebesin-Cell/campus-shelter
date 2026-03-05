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

/**
 * PATCH /api/admin/appeals/[id]
 * Approve or reject an appeal (admin only).
 * If approved, the landlord's status is restored to VERIFIED.
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
		const adminNote = body.adminNote as string | undefined;

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

		// Update appeal status
		const updatedAppeal = await prisma.appeal.update({
			where: { id },
			data: {
				status: status as "APPROVED" | "REJECTED",
				adminNote: adminNote || null,
			},
		});

		// If approved, restore landlord to VERIFIED
		if (status === "APPROVED") {
			await prisma.user.update({
				where: { id: appeal.userId },
				data: {
					landlordStatus: "VERIFIED",
					verified: true,
				},
			});
		}

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
