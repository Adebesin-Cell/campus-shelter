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
import { updateBookingStatusSchema } from "@/lib/validations";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * PATCH /api/bookings/[id]
 * Approve or reject a booking (Landlord only).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD");

		const { id } = await params;

		const body = await request.json();
		const parsed = updateBookingStatusSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		// Verify booking exists and belongs to landlord's property
		const booking = await prisma.booking.findUnique({
			where: { id },
			include: { property: { select: { landlordId: true } } },
		});

		if (!booking) return notFound("Booking not found");

		if (booking.property.landlordId !== user.userId) {
			return forbidden("You can only manage bookings for your own properties");
		}

		if (booking.status !== "PENDING") {
			return badRequest("Booking has already been processed");
		}

		const updated = await prisma.booking.update({
			where: { id },
			data: { status: parsed.data.status },
			include: {
				student: {
					select: { id: true, name: true, email: true },
				},
				property: {
					select: { id: true, title: true, location: true },
				},
			},
		});

		return success(updated);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords can manage bookings")
				: unauthorized();
		}
		console.error("[Booking PATCH Error]", error);
		return serverError("Failed to update booking");
	}
}
