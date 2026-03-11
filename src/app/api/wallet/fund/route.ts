import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { initializeWalletTransaction } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { fundWalletSchema } from "@/lib/validations";

/**
 * POST /api/wallet/fund
 * Initialize a Paystack transaction to fund the wallet.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "STUDENT");

		const body = await request.json();
		const parsed = fundWalletSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { amount } = parsed.data;

		// Fetch student email
		const student = await prisma.user.findUnique({
			where: { id: user.userId },
			select: { email: true },
		});

		if (!student) return notFound("Student not found");

		// Generate wallet-prefixed reference
		const reference = `wlt_${randomUUID()}`;

		// Initialize Paystack transaction (no subaccount — funds go to platform)
		const { authorizationUrl } = await initializeWalletTransaction({
			email: student.email,
			amount: amount * 100, // naira to kobo
			reference,
			callbackUrl: `${env.FRONTEND_URL}/wallet/verify`,
		});

		return success({ authorizationUrl, reference });
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only students can fund wallet")
				: unauthorized();
		}
		console.error("[Wallet Fund Error]", error);
		return serverError("Failed to initialize wallet funding");
	}
}
