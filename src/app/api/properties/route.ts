import type { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	created,
	forbidden,
	getPagination,
	paginated,
	serverError,
	unauthorized,
} from "@/lib/responses";
import { createPropertySchema } from "@/lib/validations";

/**
 * GET /api/properties
 * List properties with advanced filtering & pagination.
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = request.nextUrl;
		const { page, limit, skip } = getPagination(searchParams);

		// Build dynamic where clause
		const where: Prisma.PropertyWhereInput = { approved: true };

		const minPrice = searchParams.get("minPrice");
		const maxPrice = searchParams.get("maxPrice");
		if (minPrice || maxPrice) {
			where.priceMonthly = {};
			if (minPrice) where.priceMonthly.gte = parseFloat(minPrice);
			if (maxPrice) where.priceMonthly.lte = parseFloat(maxPrice);
		}

		const location = searchParams.get("location");
		if (location) {
			where.location = { contains: location, mode: "insensitive" };
		}

		const wifi = searchParams.get("wifi");
		if (wifi === "true") where.wifi = true;

		const furnished = searchParams.get("furnished");
		if (furnished === "true") where.furnished = true;

		const roomType = searchParams.get("roomType");
		if (roomType && ["SINGLE", "SELF_CON", "MINI_FLAT"].includes(roomType)) {
			where.roomType = roomType as Prisma.EnumRoomTypeFilter["equals"];
		}

		const distanceFromFUTA = searchParams.get("distanceFromFUTA");
		if (distanceFromFUTA) {
			where.distanceFromFUTA = { lte: parseFloat(distanceFromFUTA) };
		}

		const minRating = searchParams.get("minRating");

		// Query with pagination
		const [properties, total] = await Promise.all([
			prisma.property.findMany({
				where,
				include: {
					landlord: {
						select: { id: true, name: true, email: true, phone: true },
					},
					reviews: { select: { rating: true } },
					_count: { select: { bookings: true, reviews: true } },
				},
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			prisma.property.count({ where }),
		]);

		// Calculate average ratings and apply minRating filter
		type PropertyWithReviews = (typeof properties)[number];
		let result = properties.map((property: PropertyWithReviews) => {
			const { reviews, ...rest } = property;
			const avgRating =
				reviews.length > 0
					? reviews.reduce(
							(sum: number, r: { rating: number }) => sum + r.rating,
							0,
						) / reviews.length
					: 0;
			return { ...rest, avgRating: Math.round(avgRating * 10) / 10 };
		});

		if (minRating) {
			result = result.filter((p) => p.avgRating >= parseFloat(minRating));
		}

		return paginated(result, {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		console.error("[Properties GET Error]", error);
		return serverError("Failed to fetch properties");
	}
}

/**
 * POST /api/properties
 * Create a new property (Landlord only).
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD");

		const body = await request.json();
		const parsed = createPropertySchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const property = await prisma.property.create({
			data: {
				...parsed.data,
				availableFrom: new Date(parsed.data.availableFrom),
				landlordId: user.userId,
			},
			include: {
				landlord: {
					select: { id: true, name: true, email: true, phone: true },
				},
			},
		});

		return created(property);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords can create properties")
				: unauthorized();
		}
		console.error("[Properties POST Error]", error);
		return serverError("Failed to create property");
	}
}
