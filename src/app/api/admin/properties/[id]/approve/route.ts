import type { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, serverError, success } from "@/lib/responses";
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
	} catch (error: any) {
		console.error("[Admin Approve Property Error]", error);
		if (error.name === "AuthError") return serverError(error.message);
		return serverError("Failed to approve property");
	}
}
