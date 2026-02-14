import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { success, unauthorized, notFound, serverError } from "@/lib/responses";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/leases/[id]
 * Get lease details.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const lease = await prisma.lease.findUnique({
      where: { id },
      include: {
        booking: {
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
                landlordId: true,
              },
            },
          },
        },
      },
    });

    if (!lease) return notFound("Lease not found");

    // Only the student, landlord, or admin can view the lease
    const isStudent = lease.booking.studentId === user.userId;
    const isLandlord = lease.booking.property.landlordId === user.userId;
    const isAdmin = user.role === "ADMIN";

    if (!isStudent && !isLandlord && !isAdmin) {
      return notFound("Lease not found");
    }

    return success(lease);
  } catch (error) {
    if (error instanceof AuthError) return unauthorized();
    console.error("[Lease GET Error]", error);
    return serverError("Failed to fetch lease");
  }
}
