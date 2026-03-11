import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { verifyTransaction } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

/**
 * GET /api/wallet/verify?reference=wlt_xxx
 * Verify a wallet funding payment and credit the wallet.
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

		// Check if this reference has already been processed
		const existing = await prisma.walletTransaction.findUnique({
			where: { paystackReference: reference },
		});

		if (existing) {
			// Already processed — return current wallet
			const wallet = await prisma.wallet.findUnique({
				where: { userId: user.userId },
				include: {
					transactions: {
						orderBy: { createdAt: "desc" },
						take: 20,
					},
				},
			});
			return success(wallet);
		}

		// Verify with Paystack
		const verification = await verifyTransaction(reference);

		if (verification.status !== "success") {
			return badRequest("Payment verification failed");
		}

		// Credit wallet atomically
		const amount = verification.amount / 100; // kobo to naira

		const wallet = await prisma.$transaction(async (tx) => {
			// Upsert wallet
			const currentWallet = await tx.wallet.upsert({
				where: { userId: user.userId },
				create: { userId: user.userId },
				update: {},
			});

			// Double-check reference not processed (race condition guard)
			const alreadyProcessed = await tx.walletTransaction.findUnique({
				where: { paystackReference: reference },
			});

			if (alreadyProcessed) {
				return tx.wallet.findUnique({
					where: { id: currentWallet.id },
					include: {
						transactions: {
							orderBy: { createdAt: "desc" },
							take: 20,
						},
					},
				});
			}

			const balanceBefore = currentWallet.balance;
			const balanceAfter = balanceBefore + amount;

			// Update balance
			const updatedWallet = await tx.wallet.update({
				where: { id: currentWallet.id },
				data: { balance: balanceAfter },
			});

			// Create transaction record
			await tx.walletTransaction.create({
				data: {
					walletId: updatedWallet.id,
					type: "FUND",
					amount,
					balanceBefore,
					balanceAfter,
					description: `Wallet funded with ₦${amount.toLocaleString()}`,
					paystackReference: reference,
				},
			});

			return tx.wallet.findUnique({
				where: { id: updatedWallet.id },
				include: {
					transactions: {
						orderBy: { createdAt: "desc" },
						take: 20,
					},
				},
			});
		});

		return success(wallet);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only students can verify wallet funding")
				: unauthorized();
		}
		console.error("[Wallet Verify Error]", error);
		return serverError("Failed to verify wallet funding");
	}
}
