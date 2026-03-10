import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	getPagination,
	paginated,
	serverError,
	unauthorized,
} from "@/lib/responses";

/**
 * GET /api/payments
 * List payments based on the user's role.
 * Students see their own, landlords see their properties', admins see all.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);
		const { searchParams } = request.nextUrl;
		const { page, limit, skip } = getPagination(searchParams);

		const where: Record<string, unknown> =
			user.role === "STUDENT"
				? { booking: { studentId: user.userId } }
				: user.role === "LANDLORD"
					? { booking: { property: { landlordId: user.userId } } }
					: {}; // ADMIN sees all

		const [payments, total] = await Promise.all([
			prisma.payment.findMany({
				where,
				include: {
					booking: {
						include: {
							student: {
								select: { id: true, name: true, email: true },
							},
							property: {
								select: {
									id: true,
									title: true,
									location: true,
									priceMonthly: true,
								},
							},
						},
					},
				},
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			prisma.payment.count({ where }),
		]);

		return paginated(payments, {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		if (error instanceof AuthError) return unauthorized();
		console.error("[Payments GET Error]", error);
		return serverError("Failed to fetch payments");
	}
}
