import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbidden, serverError, success, unauthorized } from "@/lib/responses";

/**
 * GET /api/bookings/expiring
 * Returns bookings where leaseEnd is within the next 30 days and status is APPROVED.
 * - Students see only their own expiring bookings.
 * - Landlords see expiring bookings for their properties.
 * - Admins see all expiring bookings.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "STUDENT", "LANDLORD", "ADMIN");

		const now = new Date();
		const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

		const baseWhere = {
			status: "APPROVED" as const,
			leaseEnd: {
				gte: now,
				lte: in30Days,
			},
		};

		let where: typeof baseWhere & Record<string, unknown>;

		if (user.role === "STUDENT") {
			where = { ...baseWhere, studentId: user.userId };
		} else if (user.role === "LANDLORD") {
			where = {
				...baseWhere,
				property: { landlordId: user.userId },
			};
		} else {
			// ADMIN — no additional filter
			where = { ...baseWhere };
		}

		const bookings = await prisma.booking.findMany({
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
						landlordId: true,
					},
				},
				room: {
					select: {
						id: true,
						name: true,
						roomType: true,
						priceMonthly: true,
						priceWeekly: true,
					},
				},
			},
			orderBy: { leaseEnd: "asc" },
		});

		return success(bookings);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Access denied")
				: unauthorized();
		}
		console.error("[Bookings Expiring GET Error]", error);
		return serverError("Failed to fetch expiring bookings");
	}
}
