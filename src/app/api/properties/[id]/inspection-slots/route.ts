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

interface RouteParams {
	params: Promise<{ id: string }>;
}

const updateSlotsSchema = z.object({
	inspectionSlots: z.array(z.string().min(1)).max(20),
});

/**
 * PATCH /api/properties/[id]/inspection-slots
 * Landlord sets available inspection time slots for their property.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD");

		const { id } = await params;

		const existing = await prisma.property.findUnique({ where: { id } });
		if (!existing) return notFound("Property not found");
		if (existing.landlordId !== user.userId) {
			return forbidden("You can only update your own properties");
		}

		const body = await request.json();
		const parsed = updateSlotsSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const property = await prisma.property.update({
			where: { id },
			data: { inspectionSlots: parsed.data.inspectionSlots },
			select: { id: true, inspectionSlots: true },
		});

		return success(property);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords can manage inspection slots")
				: unauthorized("You must be logged in");
		}
		console.error("[Inspection Slots PATCH Error]", error);
		return serverError("Failed to update inspection slots");
	}
}
