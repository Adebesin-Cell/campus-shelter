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
import { updateLandlordStatusSchema } from "@/lib/validations";

/**
 * PATCH /api/admin/users/[id]/verify
 * Admin endpoint to verify/reject a landlord.
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
		const parsed = updateLandlordStatusSchema.safeParse(body);

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

		if (user.role !== "LANDLORD") {
			return badRequest("Only landlord accounts can be verified");
		}

		const updatedUser = await prisma.user.update({
			where: { id },
			data: {
				landlordStatus: parsed.data.status,
				verified: parsed.data.status === "VERIFIED",
				suspensionReason:
					parsed.data.status === "SUSPENDED"
						? parsed.data.suspensionReason || null
						: null,
			},
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				landlordStatus: true,
				verified: true,
				suspensionReason: true,
			},
		});

		return success(updatedUser);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can verify landlords")
				: unauthorized("You must be logged in to perform this action");
		}
		console.error("[Admin Verify Landlord Error]", error);
		return serverError("Failed to update landlord status");
	}
}
