import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/payments/webhook
 * Paystack webhook handler (public, no auth).
 * Verifies signature and processes payment events.
 * Handles both booking payments and wallet funding.
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

			// Check if this is a wallet funding reference
			if (reference.startsWith("wlt_")) {
				await handleWalletFunding(reference, event.data);
			} else {
				await handleBookingPayment(reference, event.data);
			}
		}

		return NextResponse.json({ received: true }, { status: 200 });
	} catch (error) {
		console.error("[Paystack Webhook Error]", error);
		return NextResponse.json({ received: true }, { status: 200 });
	}
}

/**
 * Handle wallet funding webhook event.
 */
async function handleWalletFunding(
	reference: string,
	data: { amount: number; status: string; customer?: { email?: string } },
) {
	// Check if already processed
	const existing = await prisma.walletTransaction.findUnique({
		where: { paystackReference: reference },
	});

	if (existing) return;

	// Amount from Paystack is in kobo
	const amount = data.amount / 100;

	// We need to find the user from the Paystack metadata or email
	// Since we used the student's email to initialize, we can look up by email
	// However, the reference is our best bet — we generated it for a specific user
	// The verify endpoint handles the actual crediting, so the webhook is a fallback

	// For wallet funding, we need to know which user initiated it.
	// Since we don't store a pending record, we verify via Paystack's customer email.
	const paystackEmail = data.customer?.email;
	if (!paystackEmail) return;

	const user = await prisma.user.findUnique({
		where: { email: paystackEmail },
	});

	if (!user) return;

	await prisma.$transaction(async (tx) => {
		// Double-check not already processed
		const alreadyProcessed = await tx.walletTransaction.findUnique({
			where: { paystackReference: reference },
		});

		if (alreadyProcessed) return;

		const wallet = await tx.wallet.upsert({
			where: { userId: user.id },
			create: { userId: user.id },
			update: {},
		});

		const balanceBefore = wallet.balance;
		const balanceAfter = balanceBefore + amount;

		await tx.wallet.update({
			where: { id: wallet.id },
			data: { balance: balanceAfter },
		});

		await tx.walletTransaction.create({
			data: {
				walletId: wallet.id,
				type: "FUND",
				amount,
				balanceBefore,
				balanceAfter,
				description: `Wallet funded with ₦${amount.toLocaleString()}`,
				paystackReference: reference,
			},
		});
	});
}

/**
 * Handle booking payment webhook event.
 */
async function handleBookingPayment(
	reference: string,
	data: { status: string; paid_at: string },
) {
	const payment = await prisma.payment.findUnique({
		where: { paystackReference: reference },
		include: { booking: true },
	});

	if (payment && payment.booking.paymentStatus !== "PAID") {
		await prisma.$transaction(async (tx) => {
			await tx.payment.update({
				where: { id: payment.id },
				data: {
					paystackStatus: data.status,
					paidAt: new Date(data.paid_at),
				},
			});

			await tx.booking.update({
				where: { id: payment.bookingId },
				data: { paymentStatus: "PAID" },
			});
		});
	}
}
