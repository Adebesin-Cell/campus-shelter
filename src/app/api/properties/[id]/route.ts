import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
import { updatePropertySchema } from "@/lib/validations";
import {
  success,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/responses";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/properties/[id]
 * Get single property with landlord, reviews, average rating, and availability.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        landlord: {
          select: { id: true, name: true, email: true, phone: true },
        },
        reviews: {
          include: {
            student: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        availability: {
          orderBy: { date: "asc" },
        },
        _count: { select: { bookings: true, reviews: true } },
      },
    });

    if (!property) {
      return notFound("Property not found");
    }

    // Calculate average rating
    const avgRating =
      property.reviews.length > 0
        ? property.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
          property.reviews.length
        : 0;

    return success({
      ...property,
      avgRating: Math.round(avgRating * 10) / 10,
    });
  } catch (error) {
    console.error("[Property GET Error]", error);
    return serverError("Failed to fetch property");
  }
}

/**
 * PATCH /api/properties/[id]
 * Update a property (owner landlord only).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = requireAuth(request);
    requireRole(user, "LANDLORD");

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) return notFound("Property not found");
    if (existing.landlordId !== user.userId) {
      return forbidden("You can only update your own properties");
    }

    const body = await request.json();
    const parsed = updatePropertySchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten().fieldErrors);
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.availableFrom) {
      updateData.availableFrom = new Date(parsed.data.availableFrom);
    }

    const property = await prisma.property.update({
      where: { id },
      data: updateData,
      include: {
        landlord: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    return success(property);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden" ? forbidden() : unauthorized();
    }
    console.error("[Property PATCH Error]", error);
    return serverError("Failed to update property");
  }
}

/**
 * DELETE /api/properties/[id]
 * Delete a property (owner landlord or admin).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = requireAuth(request);
    requireRole(user, "LANDLORD", "ADMIN");

    const { id } = await params;

    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) return notFound("Property not found");

    // Landlords can only delete their own properties
    if (user.role === "LANDLORD" && existing.landlordId !== user.userId) {
      return forbidden("You can only delete your own properties");
    }

    await prisma.property.delete({ where: { id } });

    return success({ message: "Property deleted successfully" });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden" ? forbidden() : unauthorized();
    }
    console.error("[Property DELETE Error]", error);
    return serverError("Failed to delete property");
  }
}
