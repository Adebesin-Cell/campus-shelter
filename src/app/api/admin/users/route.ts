import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
import {
  unauthorized,
  forbidden,
  serverError,
  paginated,
  getPagination,
} from "@/lib/responses";

/**
 * GET /api/admin/users
 * List all users (Admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    requireRole(user, "ADMIN");

    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = getPagination(searchParams);

    const role = searchParams.get("role");
    const where = role ? { role: role as "STUDENT" | "LANDLORD" | "ADMIN" } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          verified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              properties: true,
              bookings: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return paginated(users, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden"
        ? forbidden("Admin access required")
        : unauthorized();
    }
    console.error("[Admin Users Error]", error);
    return serverError("Failed to fetch users");
  }
}
