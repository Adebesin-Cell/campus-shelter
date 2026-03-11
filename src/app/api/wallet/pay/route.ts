import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { walletPaySchema } from "@/lib/validations";

/**
 * POST /api/wallet/pay
 * Pay for an approved booking using wallet balance.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "STUDENT");

		const body = await request.json();
		const parsed = walletPaySchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { bookingId } = parsed.data;

		// Fetch booking with property
		const booking = await prisma.booking.findUnique({
			where: { id: bookingId },
			include: {
				property: {
					select: {
						id: true,
						priceMonthly: true,
						landlordId: true,
					},
				},
			},
		});

		if (!booking) return notFound("Booking not found");

		if (booking.studentId !== user.userId) {
			return forbidden("You can only pay for your own bookings");
		}

		if (booking.status !== "APPROVED") {
			return badRequest("Booking must be approved before payment");
		}

		if (booking.paymentStatus !== "UNPAID") {
			return badRequest("Payment has already been initiated for this booking");
		}

		// Check wallet balance
		const wallet = await prisma.wallet.findUnique({
			where: { userId: user.userId },
		});

		if (!wallet) {
			return badRequest("Wallet not found. Please fund your wallet first");
		}

		const amount = booking.property.priceMonthly;

		if (wallet.balance < amount) {
			return badRequest(
				`Insufficient wallet balance. Required: ₦${amount.toLocaleString()}, Available: ₦${wallet.balance.toLocaleString()}`,
			);
		}

		// Calculate fees
		const platformFee = amount * (env.PLATFORM_COMMISSION_PERCENT / 100);
		const landlordAmount = amount - platformFee;

		// Generate wallet payment reference
		const reference = `wlt_pay_${randomUUID()}`;

		// Process payment atomically
		const result = await prisma.$transaction(async (tx) => {
			// Re-check booking status inside transaction
			const freshBooking = await tx.booking.findUniqueOrThrow({
				where: { id: bookingId },
				select: { paymentStatus: true },
			});

			if (freshBooking.paymentStatus !== "UNPAID") {
				return null;
			}

			// Re-check wallet balance inside transaction
			const freshWallet = await tx.wallet.findUniqueOrThrow({
				where: { id: wallet.id },
			});

			if (freshWallet.balance < amount) {
				return null;
			}

			const balanceBefore = freshWallet.balance;
			const balanceAfter = balanceBefore - amount;

			// Deduct from wallet
			await tx.wallet.update({
				where: { id: wallet.id },
				data: { balance: balanceAfter },
			});

			// Create wallet transaction
			await tx.walletTransaction.create({
				data: {
					walletId: wallet.id,
					type: "RENT_PAYMENT",
					amount,
					balanceBefore,
					balanceAfter,
					description: `Rent payment for booking ${bookingId}`,
					bookingId,
				},
			});

			// Create payment record
			await tx.payment.create({
				data: {
					bookingId,
					amount,
					platformFee,
					landlordAmount,
					paystackReference: reference,
					paystackStatus: "success",
					paidAt: new Date(),
				},
			});

			// Update booking payment status
			await tx.booking.update({
				where: { id: bookingId },
				data: { paymentStatus: "PAID" },
			});

			return {
				balanceAfter,
				amount,
				reference,
			};
		});

		if (!result) {
			return badRequest(
				"Payment could not be processed. Booking status may have changed or insufficient balance",
			);
		}

		return success({
			message: "Payment successful",
			amount: result.amount,
			reference: result.reference,
			walletBalance: result.balanceAfter,
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only students can make wallet payments")
				: unauthorized();
		}
		console.error("[Wallet Pay Error]", error);
		return serverError("Failed to process wallet payment");
	}
}
