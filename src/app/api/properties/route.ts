import type { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { AuthError, getAuthUser, requireAuth, requireRole } from "@/lib/auth";
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
		const landlordIdParam = searchParams.get("landlordId");
		const authUser = getAuthUser(request);

		const where: Prisma.PropertyWhereInput = {};

		if (landlordIdParam) {
			where.landlordId = landlordIdParam;
			// Only show unapproved properties if requester is the landlord or an admin
			if (
				!(authUser?.role === "ADMIN" || authUser?.userId === landlordIdParam)
			) {
				where.status = "APPROVED";
			}
		} else {
			// standard browse - only show approved unless admin
			if (authUser?.role !== "ADMIN") {
				where.status = "APPROVED";
			}
		}

		const minPrice = searchParams.get("minPrice");
		const maxPrice = searchParams.get("maxPrice");
		if (minPrice || maxPrice) {
			where.priceMonthly = {};
			const minP = minPrice ? parseFloat(minPrice) : null;
			const maxP = maxPrice ? parseFloat(maxPrice) : null;
			if (
				(minP !== null && Number.isNaN(minP)) ||
				(maxP !== null && Number.isNaN(maxP))
			) {
				return badRequest("Invalid price filter value");
			}
			if (minP !== null) where.priceMonthly.gte = minP;
			if (maxP !== null) where.priceMonthly.lte = maxP;
		}

		const search = searchParams.get("search");
		if (search) {
			where.OR = [
				{ title: { contains: search, mode: "insensitive" } },
				{ location: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
			];
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
			const dist = parseFloat(distanceFromFUTA);
			if (Number.isNaN(dist)) {
				return badRequest("Invalid distanceFromFUTA value");
			}
			where.distanceFromFUTA = { lte: dist };
		}

		const minRating = searchParams.get("minRating");
		const minRatingValue = minRating ? parseFloat(minRating) : null;

		if (minRatingValue !== null && Number.isNaN(minRatingValue)) {
			return badRequest("Invalid minRating value");
		}

		// When filtering by minRating, we need to fetch all matching properties
		// first, then paginate in JS, because avg rating is computed from reviews.
		const useJsPagination = minRatingValue !== null;

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
				...(useJsPagination ? {} : { skip, take: limit }),
			}),
			useJsPagination ? Promise.resolve(0) : prisma.property.count({ where }),
		]);

		// Calculate average ratings
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

		if (minRatingValue !== null) {
			result = result.filter((p) => p.avgRating >= minRatingValue);
		}

		const finalTotal = useJsPagination ? result.length : total;
		if (useJsPagination) {
			result = result.slice(skip, skip + limit);
		}

		return paginated(result, {
			total: finalTotal,
			page,
			limit,
			totalPages: Math.ceil(finalTotal / limit),
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
		requireRole(user, "LANDLORD", "ADMIN");

		// If landlord, check if they are verified
		if (user.role === "LANDLORD") {
			const landlord = await prisma.user.findUnique({
				where: { id: user.userId },
				select: { landlordStatus: true },
			});
			if (landlord?.landlordStatus !== "VERIFIED") {
				return forbidden(
					"Your account must be verified before you can post properties",
				);
			}
		}

		const body = await request.json();
		const parsed = createPropertySchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		// If admin, they can specify a landlordId. If landlord, it's always their own ID.
		let landlordId = user.userId;
		if (user.role === "ADMIN" && parsed.data.landlordId) {
			landlordId = parsed.data.landlordId;
		}

		const property = await prisma.property.create({
			data: {
				...parsed.data,
				availableFrom: new Date(parsed.data.availableFrom),
				landlordId,
				status: "PENDING_APPROVAL",
				approved: false,
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
				? forbidden("Only landlords and admins can create properties")
				: unauthorized("You must be logged in to create a property");
		}
		console.error("[Properties POST Error]", error);
		return serverError("Failed to create property");
	}
}
