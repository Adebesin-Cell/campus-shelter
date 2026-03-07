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
import { updateLandlordStatusSchema } from "@/lib/validations";

const verifyStudentSchema = z.object({
	verified: z.boolean(), // frontend sends boolean, we convert to DateTime
});

/**
 * PATCH /api/admin/users/[id]/verify
 * Admin endpoint to verify/reject a landlord or verify a student.
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

		const user = await prisma.user.findUnique({ where: { id } });

		if (!user) {
			return notFound("User not found");
		}

		if (user.role === "STUDENT") {
			const parsed = verifyStudentSchema.safeParse(body);
			if (!parsed.success) {
				return badRequest(
					"Validation failed",
					parsed.error.flatten().fieldErrors,
				);
			}
			const updatedUser = await prisma.user.update({
				where: { id },
				data: { verifiedAt: parsed.data.verified ? new Date() : null },
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					verifiedAt: true,
					idCardUrl: true,
				},
			});
			return success(updatedUser);
		}

		if (user.role !== "LANDLORD") {
			return badRequest("Only landlord or student accounts can be verified");
		}

		const parsed = updateLandlordStatusSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const updatedUser = await prisma.user.update({
			where: { id },
			data: {
				landlordStatus: parsed.data.status,
				verifiedAt: parsed.data.status === "VERIFIED" ? new Date() : null,
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
				verifiedAt: true,
				suspensionReason: true,
			},
		});

		return success(updatedUser);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can verify users")
				: unauthorized("You must be logged in to perform this action");
		}
		console.error("[Admin Verify User Error]", error);
		return serverError("Failed to update user verification status");
	}
}
