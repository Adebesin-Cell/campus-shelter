import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/payments/webhook
 * Paystack webhook handler (public, no auth).
 * Verifies signature and processes payment events.
 */
export async function POST(request: Request) {
	try {
		const body = await request.text();

		// Verify Paystack signature
		const signature = request.headers.get("x-paystack-signature");
		if (!signature) {
			return NextResponse.json(
				{ error: "No signature provided" },
				{ status: 400 },
			);
		}

		const hash = createHmac("sha512", env.PAYSTACK_SECRET_KEY!)
			.update(body)
			.digest("hex");

		if (hash !== signature) {
			return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
		}

		const event = JSON.parse(body);

		// Handle charge.success event
		if (event.event === "charge.success") {
			const reference = event.data.reference as string;

			const payment = await prisma.payment.findUnique({
				where: { paystackReference: reference },
				include: { booking: true },
			});

			if (payment && payment.booking.paymentStatus !== "PAID") {
				await prisma.$transaction(async (tx) => {
					await tx.payment.update({
						where: { id: payment.id },
						data: {
							paystackStatus: event.data.status,
							paidAt: new Date(event.data.paid_at),
						},
					});

					await tx.booking.update({
						where: { id: payment.bookingId },
						data: { paymentStatus: "PAID" },
					});
				});
			}
		}

		return NextResponse.json({ received: true }, { status: 200 });
	} catch (error) {
		console.error("[Paystack Webhook Error]", error);
		return NextResponse.json({ received: true }, { status: 200 });
	}
}
