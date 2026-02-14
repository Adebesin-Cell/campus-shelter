import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
import { createMaintenanceSchema } from "@/lib/validations";
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
 * GET /api/maintenance
 * List maintenance requests.
 * Students see their own; landlords see requests on their properties; admins see all.
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = getPagination(searchParams);

    const where =
      user.role === "ADMIN"
        ? {}
        : user.role === "LANDLORD"
          ? { property: { landlordId: user.userId } }
          : { studentId: user.userId };

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        include: {
          student: { select: { id: true, name: true, email: true } },
          property: { select: { id: true, title: true, location: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return paginated(requests, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof AuthError) return unauthorized();
    console.error("[Maintenance GET Error]", error);
    return serverError("Failed to fetch maintenance requests");
  }
}

/**
 * POST /api/maintenance
 * Create a maintenance request (Student only).
 */
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    requireRole(user, "STUDENT");

    const body = await request.json();
    const parsed = createMaintenanceSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten().fieldErrors);
    }

    const { propertyId, description } = parsed.data;

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) return notFound("Property not found");

    // Verify student has an active booking for this property
    const hasBooking = await prisma.booking.findFirst({
      where: {
        studentId: user.userId,
        propertyId,
        status: "APPROVED",
      },
    });

    if (!hasBooking) {
      return forbidden(
        "You can only create maintenance requests for properties you are renting"
      );
    }

    const maintenanceRequest = await prisma.maintenanceRequest.create({
      data: {
        propertyId,
        studentId: user.userId,
        description,
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true, location: true } },
      },
    });

    return created(maintenanceRequest);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden"
        ? forbidden("Only students can create maintenance requests")
        : unauthorized();
    }
    console.error("[Maintenance POST Error]", error);
    return serverError("Failed to create maintenance request");
  }
}
