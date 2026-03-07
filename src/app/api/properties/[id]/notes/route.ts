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

const notesSchema = z.object({
	notes: z.string().max(2000, "Notes must be under 2000 characters").nullable(),
});

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * PATCH /api/properties/[id]/notes
 * Update property notes without triggering re-approval.
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
		const parsed = notesSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const property = await prisma.property.update({
			where: { id },
			data: { notes: parsed.data.notes },
			select: { id: true, notes: true },
		});

		return success(property);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords can update notes")
				: unauthorized("You must be logged in");
		}
		console.error("[Property Notes PATCH Error]", error);
		return serverError("Failed to update notes");
	}
}
