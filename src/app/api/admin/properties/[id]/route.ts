import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
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
 * PATCH /api/admin/properties/[id]
 * Approve a property listing (Admin only).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = requireAuth(request);
    requireRole(user, "ADMIN");

    const { id } = await params;

    const body = await request.json();
    const { approved } = body;

    if (typeof approved !== "boolean") {
      return badRequest("'approved' field must be a boolean");
    }

    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    const updated = await prisma.property.update({
      where: { id },
      data: { approved },
      include: {
        landlord: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return success(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden"
        ? forbidden("Admin access required")
        : unauthorized();
    }
    console.error("[Admin Property PATCH Error]", error);
    return serverError("Failed to update property");
  }
}

/**
 * DELETE /api/admin/properties/[id]
 * Delete a property listing (Admin only).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = requireAuth(request);
    requireRole(user, "ADMIN");

    const { id } = await params;

    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    await prisma.property.delete({ where: { id } });

    return success({ message: "Property deleted successfully" });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden"
        ? forbidden("Admin access required")
        : unauthorized();
    }
    console.error("[Admin Property DELETE Error]", error);
    return serverError("Failed to delete property");
  }
}
