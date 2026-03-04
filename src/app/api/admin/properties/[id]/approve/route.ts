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
import { updatePropertyStatusSchema } from "@/lib/validations";

/**
 * PATCH /api/admin/properties/[id]/approve
 * Admin endpoint to approve/reject a property.
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
		const parsed = updatePropertyStatusSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const property = await prisma.property.findUnique({ where: { id } });

		if (!property) {
			return notFound("Property not found");
		}

		const updatedProperty = await prisma.property.update({
			where: { id },
			data: {
				status: parsed.data.status,
				// Auto-set approved boolean if status is APPROVED for backward compatibility
				approved: parsed.data.status === "APPROVED",
			},
		});

		return success(updatedProperty);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can approve properties")
				: unauthorized("You must be logged in to perform this action");
		}
		console.error("[Admin Approve Property Error]", error);
		return serverError("Failed to update property status");
	}
}
