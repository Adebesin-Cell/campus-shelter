import { env } from "./env";

const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackFetch<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const secretKey = env.PAYSTACK_SECRET_KEY;
	if (!secretKey) {
		throw new Error("Paystack secret key is not configured");
	}

	const res = await fetch(`${PAYSTACK_BASE}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/json",
			...options.headers,
		},
	});

	const data = await res.json();
	if (!res.ok) {
		throw new Error(data.message || `Paystack error: ${res.status}`);
	}
	return data;
}

// ─── Types ──────────────────────────────────────────────

interface PaystackBank {
	name: string;
	code: string;
	country: string;
	currency: string;
}

interface ResolveAccountResponse {
	status: boolean;
	data: { account_number: string; account_name: string; bank_id: number };
}

interface SubaccountResponse {
	status: boolean;
	data: { subaccount_code: string; id: number };
}

interface TransactionInitResponse {
	status: boolean;
	data: { authorization_url: string; access_code: string; reference: string };
}

interface TransactionVerifyResponse {
	status: boolean;
	data: {
		status: string;
		reference: string;
		amount: number;
		paid_at: string;
		channel: string;
	};
}

// ─── API Functions ──────────────────────────────────────

export async function listBanks(): Promise<PaystackBank[]> {
	const res = await paystackFetch<{ status: boolean; data: PaystackBank[] }>(
		"/bank?country=nigeria&perPage=100",
	);
	return res.data;
}

export async function resolveAccountNumber(
	accountNumber: string,
	bankCode: string,
): Promise<{ accountName: string; accountNumber: string }> {
	const res = await paystackFetch<ResolveAccountResponse>(
		`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
	);
	return {
		accountName: res.data.account_name,
		accountNumber: res.data.account_number,
	};
}

export async function createSubaccount(data: {
	businessName: string;
	bankCode: string;
	accountNumber: string;
	percentageCharge: number;
}): Promise<string> {
	const res = await paystackFetch<SubaccountResponse>("/subaccount", {
		method: "POST",
		body: JSON.stringify({
			business_name: data.businessName,
			settlement_bank: data.bankCode,
			account_number: data.accountNumber,
			percentage_charge: data.percentageCharge,
		}),
	});
	return res.data.subaccount_code;
}

export async function initializeTransaction(data: {
	email: string;
	amount: number; // in kobo
	reference: string;
	subaccountCode: string;
	callbackUrl: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
	const res = await paystackFetch<TransactionInitResponse>(
		"/transaction/initialize",
		{
			method: "POST",
			body: JSON.stringify({
				email: data.email,
				amount: data.amount,
				reference: data.reference,
				subaccount: data.subaccountCode,
				bearer: "account",
				callback_url: data.callbackUrl,
			}),
		},
	);
	return {
		authorizationUrl: res.data.authorization_url,
		reference: res.data.reference,
	};
}

export async function initializeWalletTransaction(data: {
	email: string;
	amount: number; // in kobo
	reference: string;
	callbackUrl: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
	const res = await paystackFetch<TransactionInitResponse>(
		"/transaction/initialize",
		{
			method: "POST",
			body: JSON.stringify({
				email: data.email,
				amount: data.amount,
				reference: data.reference,
				callback_url: data.callbackUrl,
			}),
		},
	);
	return {
		authorizationUrl: res.data.authorization_url,
		reference: res.data.reference,
	};
}

export async function verifyTransaction(
	reference: string,
): Promise<TransactionVerifyResponse["data"]> {
	const res = await paystackFetch<TransactionVerifyResponse>(
		`/transaction/verify/${reference}`,
	);
	return res.data;
}

export async function createRefund(
	transactionReference: string,
): Promise<void> {
	await paystackFetch("/refund", {
		method: "POST",
		body: JSON.stringify({ transaction: transactionReference }),
	});
}
