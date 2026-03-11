import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbidden, serverError, success, unauthorized } from "@/lib/responses";

/**
 * GET /api/wallet
 * Get wallet balance and recent transactions.
 * Auto-creates wallet if it doesn't exist.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "STUDENT");

		const wallet = await prisma.wallet.upsert({
			where: { userId: user.userId },
			create: { userId: user.userId },
			update: {},
			include: {
				transactions: {
					orderBy: { createdAt: "desc" },
					take: 20,
				},
			},
		});

		return success(wallet);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only students can access wallet")
				: unauthorized();
		}
		console.error("[Wallet GET Error]", error);
		return serverError("Failed to fetch wallet");
	}
}
