import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { verifyTransaction } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

/**
 * GET /api/payments/verify?reference=xxx
 * Verify a Paystack payment by reference.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "STUDENT");

		const { searchParams } = request.nextUrl;
		const reference = searchParams.get("reference");

		if (!reference) {
			return badRequest("Payment reference is required");
		}

		// Verify with Paystack
		const verification = await verifyTransaction(reference);

		// Find payment by reference
		const payment = await prisma.payment.findUnique({
			where: { paystackReference: reference },
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

		if (!payment) return notFound("Payment not found");

		// Update if verified and not already paid
		if (
			verification.status === "success" &&
			payment.booking.paymentStatus !== "PAID"
		) {
			const updatedPayment = await prisma.$transaction(async (tx) => {
				const updated = await tx.payment.update({
					where: { id: payment.id },
					data: {
						paystackStatus: verification.status,
						paidAt: new Date(verification.paid_at),
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
					data: { paymentStatus: "PAID" },
				});

				return updated;
			});

			return success(updatedPayment);
		}

		return success(payment);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only students can verify payments")
				: unauthorized();
		}
		console.error("[Payment Verify Error]", error);
		return serverError("Failed to verify payment");
	}
}
