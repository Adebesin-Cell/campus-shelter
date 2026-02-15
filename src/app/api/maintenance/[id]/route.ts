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
import { updateMaintenanceSchema } from "@/lib/validations";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * PATCH /api/maintenance/[id]
 * Update maintenance request status (Landlord or Admin).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD", "ADMIN");

		const { id } = await params;

		const body = await request.json();
		const parsed = updateMaintenanceSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const maintenanceRequest = await prisma.maintenanceRequest.findUnique({
			where: { id },
			include: { property: { select: { landlordId: true } } },
		});

		if (!maintenanceRequest) return notFound("Maintenance request not found");

		// Landlords can only update requests for their own properties
		if (
			user.role === "LANDLORD" &&
			maintenanceRequest.property.landlordId !== user.userId
		) {
			return forbidden(
				"You can only manage maintenance requests for your own properties",
			);
		}

		const updated = await prisma.maintenanceRequest.update({
			where: { id },
			data: { status: parsed.data.status },
			include: {
				student: { select: { id: true, name: true, email: true } },
				property: { select: { id: true, title: true, location: true } },
			},
		});

		return success(updated);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords or admins can update maintenance requests")
				: unauthorized();
		}
		console.error("[Maintenance PATCH Error]", error);
		return serverError("Failed to update maintenance request");
	}
}
