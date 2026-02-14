import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { createLeaseSchema } from "@/lib/validations";
import {
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/responses";

/**
 * POST /api/leases
 * Create a lease for an approved booking.
 */
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const body = await request.json();
    const parsed = createLeaseSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten().fieldErrors);
    }

    const { bookingId, documentUrl } = parsed.data;

    // Verify booking exists and is approved
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { landlordId: true } },
        lease: true,
      },
    });

    if (!booking) return notFound("Booking not found");
    if (booking.status !== "APPROVED") {
      return badRequest("Lease can only be created for approved bookings");
    }

    // Only the landlord of the property can create a lease
    if (booking.property.landlordId !== user.userId) {
      return forbidden("Only the property landlord can create leases");
    }

    if (booking.lease) {
      return badRequest("Lease already exists for this booking");
    }

    const lease = await prisma.lease.create({
      data: {
        bookingId,
        documentUrl,
      },
      include: {
        booking: {
          include: {
            student: { select: { id: true, name: true, email: true } },
            property: { select: { id: true, title: true } },
          },
        },
      },
    });

    return created(lease);
  } catch (error) {
    if (error instanceof AuthError) return unauthorized();
    console.error("[Leases POST Error]", error);
    return serverError("Failed to create lease");
  }
}
