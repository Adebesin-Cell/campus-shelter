import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { createRefund } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { refundPaymentSchema } from "@/lib/validations";

/**
 * POST /api/admin/payments/[id]/refund
 * Refund a payment (Admin only).
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const admin = requireAuth(request);
		requireRole(admin, "ADMIN");

		const { id } = await params;

		const body = await request.json();
		const parsed = refundPaymentSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { reason } = parsed.data;

		// Find payment with booking
		const payment = await prisma.payment.findUnique({
			where: { id },
			include: { booking: true },
		});

		if (!payment) return notFound("Payment not found");

		if (!payment.paystackStatus) {
			return badRequest("Payment has not been completed yet");
		}

		if (payment.booking.paymentStatus !== "PAID") {
			return badRequest("Only paid bookings can be refunded");
		}

		// Create refund on Paystack
		await createRefund(payment.paystackReference);

		// Update payment and booking in a transaction
		const updatedPayment = await prisma.$transaction(async (tx) => {
			const updated = await tx.payment.update({
				where: { id },
				data: {
					refundedAt: new Date(),
					refundReason: reason,
					refundedBy: admin.userId,
				},
				include: {
					booking: {
						include: {
							student: {
								select: { id: true, name: true, email: true },
							},
							property: {
								select: { id: true, title: true, location: true },
							},
						},
					},
				},
			});

			await tx.booking.update({
				where: { id: payment.bookingId },
				data: { paymentStatus: "REFUNDED" },
			});

			return updated;
		});

		return success(updatedPayment);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can process refunds")
				: unauthorized();
		}
		console.error("[Admin Refund Error]", error);
		return serverError("Failed to process refund");
	}
}
