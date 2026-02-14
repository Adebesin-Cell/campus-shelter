import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
import { createBookingSchema } from "@/lib/validations";
import {
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  paginated,
  getPagination,
} from "@/lib/responses";

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

    const where =
      user.role === "LANDLORD"
        ? { property: { landlordId: user.userId } }
        : user.role === "ADMIN"
          ? {}
          : { studentId: user.userId };

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
      return badRequest("Validation failed", parsed.error.flatten().fieldErrors);
    }

    const { propertyId, leaseStart, leaseEnd } = parsed.data;
    const startDate = new Date(leaseStart);
    const endDate = new Date(leaseEnd);

    if (endDate <= startDate) {
      return badRequest("Lease end date must be after start date");
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) return notFound("Property not found");

    // Check for overlapping bookings
    const overlapping = await prisma.booking.findFirst({
      where: {
        propertyId,
        status: { in: ["PENDING", "APPROVED"] },
        leaseStart: { lt: endDate },
        leaseEnd: { gt: startDate },
      },
    });

    if (overlapping) {
      return badRequest("Property is already booked for the selected dates");
    }

    const booking = await prisma.booking.create({
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

    return created(booking);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden"
        ? forbidden("Only students can create bookings")
        : unauthorized();
    }
    console.error("[Bookings POST Error]", error);
    return serverError("Failed to create booking");
  }
}
