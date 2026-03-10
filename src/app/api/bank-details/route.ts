import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import {
	createSubaccount,
	listBanks,
	resolveAccountNumber,
} from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { saveBankDetailSchema } from "@/lib/validations";

/**
 * GET /api/bank-details
 * Return the landlord's saved bank details.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD");

		const bankDetail = await prisma.landlordBankDetail.findUnique({
			where: { userId: user.userId },
		});

		return success(bankDetail ?? null);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords can access bank details")
				: unauthorized();
		}
		console.error("[Bank Details GET Error]", error);
		return serverError("Failed to fetch bank details");
	}
}

/**
 * POST /api/bank-details
 * Save or update bank details and create a Paystack subaccount.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD");

		const body = await request.json();
		const parsed = saveBankDetailSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { bankCode, accountNumber } = parsed.data;

		// Resolve account name from Paystack
		const resolved = await resolveAccountNumber(accountNumber, bankCode);

		// Get bank name
		const banks = await listBanks();
		const bank = banks.find((b) => b.code === bankCode);
		const bankName = bank?.name ?? "Unknown Bank";

		// Fetch user's name for subaccount business name
		const dbUser = await prisma.user.findUnique({
			where: { id: user.userId },
			select: { name: true },
		});

		// Calculate landlord percentage (they get the remainder after platform commission)
		const percentageCharge = 100 - env.PLATFORM_COMMISSION_PERCENT;

		// Create Paystack subaccount
		const subaccountCode = await createSubaccount({
			businessName: dbUser?.name ?? "Landlord",
			bankCode,
			accountNumber,
			percentageCharge,
		});

		// Upsert bank detail record
		const bankDetail = await prisma.landlordBankDetail.upsert({
			where: { userId: user.userId },
			create: {
				userId: user.userId,
				bankCode,
				bankName,
				accountNumber,
				accountName: resolved.accountName,
				paystackSubaccountCode: subaccountCode,
			},
			update: {
				bankCode,
				bankName,
				accountNumber,
				accountName: resolved.accountName,
				paystackSubaccountCode: subaccountCode,
			},
		});

		return success(bankDetail);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords can save bank details")
				: unauthorized();
		}
		console.error("[Bank Details POST Error]", error);
		return serverError("Failed to save bank details");
	}
}
