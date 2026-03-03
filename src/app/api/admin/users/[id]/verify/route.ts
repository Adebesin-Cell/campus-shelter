import type { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, serverError, success } from "@/lib/responses";
import { updateLandlordStatusSchema } from "@/lib/validations";

/**
 * PATCH /api/admin/users/[id]/verify
 * Admin endpoint to verify/reject a landlord.
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const admin = requireAuth(request);
		requireRole(admin, "ADMIN");

		const { id } = params;
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
			return badRequest("Only landlords can be verified");
		}

		const updatedUser = await prisma.user.update({
			where: { id },
			data: {
				landlordStatus: parsed.data.status,
				// Auto-set verified boolean if status is VERIFIED for backward compatibility
				verified: parsed.data.status === "VERIFIED",
			},
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				landlordStatus: true,
				verified: true,
			},
		});

		return success(updatedUser);
	} catch (error: any) {
		console.error("[Admin Verify Landlord Error]", error);
		if (error.name === "AuthError") return serverError(error.message);
		return serverError("Failed to verify landlord");
	}
}
