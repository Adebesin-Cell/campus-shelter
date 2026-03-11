import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	created,
	forbidden,
	getPagination,
	notFound,
	paginated,
	serverError,
	unauthorized,
} from "@/lib/responses";
import { createBookingSchema } from "@/lib/validations";

/**
 * GET /api/bookings
 * List bookings for the authenticated user.
 * Students see their own bookings; landlords see bookings on their properties.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);
		const { searchParams } = request.nextUrl;
		const { page, limit, skip } = getPagination(searchParams);

		const statusFilter = searchParams.get("status");

		const where: Record<string, unknown> =
			user.role === "LANDLORD"
				? { property: { landlordId: user.userId } }
				: user.role === "ADMIN"
					? {}
					: { studentId: user.userId };

		if (statusFilter) {
			where.status = statusFilter;
		}

		const [bookings, total] = await Promise.all([
			prisma.booking.findMany({
				where,
				include: {
					student: {
						select: { id: true, name: true, email: true, phone: true },
					},
					property: {
						select: {
							id: true,
							title: true,
							location: true,
							priceMonthly: true,
						},
					},
					lease: true,
				},
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			prisma.booking.count({ where }),
		]);

		return paginated(bookings, {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		if (error instanceof AuthError) return unauthorized();
		console.error("[Bookings GET Error]", error);
		return serverError("Failed to fetch bookings");
	}
}

/**
 * POST /api/bookings
 * Create a new booking (Student only).
 * Checks availability and prevents double booking.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "STUDENT");

		const body = await request.json();
		const parsed = createBookingSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { propertyId, leaseStart, leaseEnd } = parsed.data;
		const startDate = new Date(leaseStart);
		const endDate = new Date(leaseEnd);

		if (endDate <= startDate) {
			return badRequest("Lease end date must be after start date");
		}

		// Verify property exists and is approved
		const property = await prisma.property.findUnique({
			where: { id: propertyId },
		});
		if (!property) return notFound("Property not found");

		if (property.status !== "APPROVED") {
			return badRequest("This property is not available for booking");
		}

		// Lease must not start before property availability date
		if (startDate < property.availableFrom) {
			return badRequest(
				`Property is not available until ${property.availableFrom.toISOString().split("T")[0]}`,
			);
		}

		// Check for overlapping bookings and create atomically
		const booking = await prisma.$transaction(async (tx) => {
			const overlapping = await tx.booking.findFirst({
				where: {
					propertyId,
					status: { in: ["PENDING", "APPROVED"] },
					leaseStart: { lt: endDate },
					leaseEnd: { gt: startDate },
				},
			});

			if (overlapping) {
				return null;
			}

			return tx.booking.create({
				data: {
					studentId: user.userId,
					propertyId,
					leaseStart: startDate,
					leaseEnd: endDate,
				},
				include: {
					student: {
						select: { id: true, name: true, email: true },
					},
					property: {
						select: { id: true, title: true, location: true },
					},
				},
			});
		});

		if (!booking) {
			return badRequest("Property is already booked for the selected dates");
		}

		return created(booking);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only students can create bookings")
				: unauthorized("You must be logged in to create a booking");
		}
		console.error("[Bookings POST Error]", error);
		return serverError("Failed to create booking");
	}
}
