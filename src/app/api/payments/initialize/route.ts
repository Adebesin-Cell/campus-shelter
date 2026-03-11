import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { initializeTransaction } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { initializePaymentSchema } from "@/lib/validations";

/**
 * POST /api/payments/initialize
 * Initialize a Paystack payment for an approved booking.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "STUDENT");

		const body = await request.json();
		const parsed = initializePaymentSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { bookingId } = parsed.data;

		// Fetch booking with property details
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

		// Fetch landlord bank details for subaccount
		const bankDetail = await prisma.landlordBankDetail.findUnique({
			where: { userId: booking.property.landlordId },
		});

		if (!bankDetail || !bankDetail.paystackSubaccountCode) {
			return badRequest("Landlord has not set up payment details yet");
		}

		// Fetch student email
		const student = await prisma.user.findUnique({
			where: { id: user.userId },
			select: { email: true },
		});

		if (!student) return notFound("Student not found");

		// Calculate amounts
		const amount = booking.property.priceMonthly * 100; // naira to kobo
		const platformFee = amount * (env.PLATFORM_COMMISSION_PERCENT / 100);
		const landlordAmount = amount - platformFee;

		// Generate unique reference
		const reference = randomUUID();

		// Initialize Paystack transaction
		const { authorizationUrl } = await initializeTransaction({
			email: student.email,
			amount,
			reference,
			subaccountCode: bankDetail.paystackSubaccountCode,
			callbackUrl: `${env.FRONTEND_URL}/payments/verify`,
		});

		// Create payment record and update booking atomically with UNPAID check
		const result = await prisma.$transaction(async (tx) => {
			// Re-check payment status inside transaction to prevent race conditions
			const freshBooking = await tx.booking.findUniqueOrThrow({
				where: { id: bookingId },
				select: { paymentStatus: true },
			});

			if (freshBooking.paymentStatus !== "UNPAID") {
				return null;
			}

			await tx.payment.create({
				data: {
					bookingId,
					amount: booking.property.priceMonthly,
					platformFee: platformFee / 100, // store in naira
					landlordAmount: landlordAmount / 100, // store in naira
					paystackReference: reference,
				},
			});

			await tx.booking.update({
				where: { id: bookingId },
				data: { paymentStatus: "PENDING_PAYMENT" },
			});

			return { authorizationUrl, reference };
		});

		if (!result) {
			return badRequest("Payment has already been initiated for this booking");
		}

		return success(result);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only students can make payments")
				: unauthorized();
		}
		console.error("[Payment Initialize Error]", error);
		return serverError("Failed to initialize payment");
	}
}
