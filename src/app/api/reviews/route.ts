import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
import { createReviewSchema } from "@/lib/validations";
import {
  created,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from "@/lib/responses";

/**
 * POST /api/reviews
 * Create a review for a property (Student who booked only).
 */
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    requireRole(user, "STUDENT");

    const body = await request.json();
    const parsed = createReviewSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten().fieldErrors);
    }

    const { propertyId, rating, comment } = parsed.data;

    // Verify the student has an approved booking for this property
    const hasBooking = await prisma.booking.findFirst({
      where: {
        studentId: user.userId,
        propertyId,
        status: "APPROVED",
      },
    });

    if (!hasBooking) {
      return forbidden(
        "You can only review properties you have booked"
      );
    }

    // Check if already reviewed
    const existingReview = await prisma.review.findUnique({
      where: {
        studentId_propertyId: {
          studentId: user.userId,
          propertyId,
        },
      },
    });

    if (existingReview) {
      return badRequest("You have already reviewed this property");
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment,
        studentId: user.userId,
        propertyId,
      },
      include: {
        student: { select: { id: true, name: true } },
        property: { select: { id: true, title: true } },
      },
    });

    return created(review);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message === "Forbidden"
        ? forbidden("Only students can create reviews")
        : unauthorized();
    }
    console.error("[Reviews POST Error]", error);
    return serverError("Failed to create review");
  }
}
