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
 * - Approve or reject a booking (Landlord only).
 * - Cancel a booking (Student who owns the booking only; PENDING bookings only).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
	try {
		const user = requireAuth(request);

		const { id } = await params;

		const body = await request.json();

		// Student cancellation path
		if (user.role === "STUDENT") {
			if (body.status !== "CANCELLED") {
				return forbidden("Students can only cancel their own bookings");
			}

			const booking = await prisma.booking.findUnique({
				where: { id },
				select: {
					id: true,
					studentId: true,
					status: true,
					roomId: true,
				},
			});

			if (!booking) return notFound("Booking not found");

			if (booking.studentId !== user.userId) {
				return forbidden("You can only cancel your own bookings");
			}

			if (booking.status !== "PENDING") {
				return badRequest("Only PENDING bookings can be cancelled");
			}

			const updated = await prisma.$transaction(async (tx) => {
				if (booking.roomId) {
					await tx.room.update({
						where: { id: booking.roomId },
						data: { isAvailable: true },
					});
				}

				return tx.booking.update({
					where: { id },
					data: { status: "CANCELLED" },
					include: {
						student: {
							select: { id: true, name: true, email: true },
						},
						property: {
							select: { id: true, title: true, location: true },
						},
						room: true,
						payment: true,
					},
				});
			});

			return success(updated);
		}

		// Landlord path — approve or reject
		requireRole(user, "LANDLORD");

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

		const updated = await prisma.$transaction(async (tx) => {
			// When approving, mark the associated room as unavailable
			if (parsed.data.status === "APPROVED" && booking.roomId) {
				await tx.room.update({
					where: { id: booking.roomId },
					data: { isAvailable: false },
				});
			}
			// When rejecting, ensure the room stays available (no-op since it wasn't changed yet,
			// but being explicit here for clarity)

			return tx.booking.update({
				where: { id },
				data: { status: parsed.data.status },
				include: {
					student: {
						select: { id: true, name: true, email: true },
					},
					property: {
						select: { id: true, title: true, location: true },
					},
					room: true,
					payment: true,
				},
			});
		});

		return success(updated);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("You do not have permission to perform this action")
				: unauthorized();
		}
		console.error("[Booking PATCH Error]", error);
		return serverError("Failed to update booking");
	}
}
