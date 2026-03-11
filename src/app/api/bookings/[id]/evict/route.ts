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
import { evictBookingSchema } from "@/lib/validations";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * POST /api/bookings/[id]/evict
 * Evict a tenant from a property (Landlord only).
 * Only APPROVED bookings can be evicted.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD");

		const { id } = await params;

		const body = await request.json();
		const parsed = evictBookingSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const booking = await prisma.booking.findUnique({
			where: { id },
			include: { property: { select: { landlordId: true } } },
		});

		if (!booking) return notFound("Booking not found");

		if (booking.property.landlordId !== user.userId) {
			return forbidden("You can only evict tenants from your own properties");
		}

		if (booking.status !== "APPROVED") {
			return badRequest("Only active (approved) bookings can be evicted");
		}

		const updated = await prisma.$transaction(async (tx) => {
			// Terminate any active lease
			if (booking.id) {
				await tx.lease.updateMany({
					where: { bookingId: id },
					data: { terminatedAt: new Date() },
				});
			}

			return tx.booking.update({
				where: { id },
				data: {
					status: "EVICTED",
					evictionReason: parsed.data.reason,
					evictionDate: new Date(),
				},
				include: {
					student: {
						select: { id: true, name: true, email: true, phone: true },
					},
					property: {
						select: { id: true, title: true, location: true },
					},
					lease: true,
				},
			});
		});

		return success(updated);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords can evict tenants")
				: unauthorized();
		}
		console.error("[Evict Booking Error]", error);
		return serverError("Failed to evict tenant");
	}
}
