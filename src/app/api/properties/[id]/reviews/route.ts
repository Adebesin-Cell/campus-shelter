import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, notFound, serverError, getPagination, paginated } from "@/lib/responses";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/properties/[id]/reviews
 * Get all reviews for a property with pagination.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = getPagination(searchParams);

    // Verify property exists
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { propertyId: id },
        include: {
          student: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { propertyId: id } }),
    ]);

    // Calculate average rating
    const avgResult = await prisma.review.aggregate({
      where: { propertyId: id },
      _avg: { rating: true },
    });

    return paginated(reviews, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[Property Reviews GET Error]", error);
    return serverError("Failed to fetch reviews");
  }
}
