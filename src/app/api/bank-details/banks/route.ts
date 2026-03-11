import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { listBanks } from "@/lib/paystack";
import { forbidden, serverError, success, unauthorized } from "@/lib/responses";

/**
 * GET /api/bank-details/banks
 * Return the list of supported banks from Paystack.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD");

		const banks = await listBanks();

		return success(banks);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords can access bank list")
				: unauthorized();
		}
		console.error("[Banks GET Error]", error);
		return serverError("Failed to fetch banks");
	}
}
