import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
import { success, unauthorized, forbidden, serverError } from "@/lib/responses";

/**
 * GET /api/admin/analytics
 * Get platform analytics (Admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    requireRole(user, "ADMIN");

    const [
      totalUsers,
      totalProperties,
      totalBookings,
      bookingsByStatus,
      usersByRole,
      topPropertiesByBookings,
      topPropertiesByRating,
      recentBookings,
      revenueEstimate,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.booking.count(),

      prisma.booking.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),

      prisma.user.groupBy({
        by: ["role"],
        _count: { _all: true },
      }),

      prisma.property.findMany({
        orderBy: { bookings: { _count: "desc" } },
        take: 5,
        select: {
          id: true,
          title: true,
          location: true,
          priceMonthly: true,
          _count: { select: { bookings: true, reviews: true } },
        },
      }),

      prisma.property.findMany({
        take: 5,
        select: {
          id: true,
          title: true,
          location: true,
          priceMonthly: true,
          reviews: { select: { rating: true } },
          _count: { select: { reviews: true } },
        },
      }),

      prisma.booking.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      prisma.booking.findMany({
        where: { status: "APPROVED" },
        include: { property: { select: { priceMonthly: true } } },
      }),
    ]);

    // Process top properties by rating
    type PropertyWithReviews = (typeof topPropertiesByRating)[number];
    const processedTopByRating = topPropertiesByRating
      .map((p: PropertyWithReviews) => {
        const avgRating =
          p.reviews.length > 0
            ? p.reviews.reduce(
                (sum: number, r: { rating: number }) => sum + r.rating,
                0
              ) / p.reviews.length
            : 0;
        const { reviews, ...rest } = p;
        return { ...rest, avgRating: Math.round(avgRating * 10) / 10 };
      })
      .sort((a: { avgRating: number }, b: { avgRating: number }) => b.avgRating - a.avgRating);

    // Calculate total estimated revenue
    type BookingWithProperty = (typeof revenueEstimate)[number];
    const totalRevenue = revenueEstimate.reduce(
      (sum: number, b: BookingWithProperty) => sum + b.property.priceMonthly,
      0
    );

    return success({
      overview: {
        totalUsers,
        totalProperties,
        totalBookings,
        recentBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
      bookingsByStatus: bookingsByStatus.map(
        (b: (typeof bookingsByStatus)[number]) => ({
          status: b.status,
          count: b._count._all,
        })
      ),
      usersByRole: usersByRole.map((u: (typeof usersByRole)[number]) => ({
        role: u.role,
        count: u._count._all,
      })),
      topPropertiesByBookings,
      topPropertiesByRating: processedTopByRating.slice(0, 5),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden"
        ? forbidden("Admin access required")
        : unauthorized();
    }
    console.error("[Admin Analytics Error]", error);
    return serverError("Failed to fetch analytics");
  }
}
