import type { NextRequest } from "next/server";
import { AuthError, generateResetToken, requireAuth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
	badRequest,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

/**
 * POST /api/auth/resend-verification
 * Resend the email verification link (authenticated).
 */
export async function POST(request: NextRequest) {
	try {
		const authUser = requireAuth(request);

		const ip = getClientIp(request);
		const rl = checkRateLimit(`resend-verify:${ip}`, {
			max: 3,
			windowSec: 600,
		});
		if (!rl.allowed) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Too many requests. Please try again later.",
				}),
				{
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
					},
				},
			);
		}

		const user = await prisma.user.findUnique({
			where: { id: authUser.userId },
			select: { id: true, name: true, email: true, emailVerified: true },
		});

		if (!user) {
			return badRequest("User not found");
		}

		if (user.emailVerified) {
			return badRequest("Email is already verified");
		}

		// Delete any existing verification tokens for this user
		await prisma.emailVerification.deleteMany({
			where: { userId: user.id },
		});

		// Create new verification token (24h expiry)
		const token = generateResetToken();
		await prisma.emailVerification.create({
			data: {
				userId: user.id,
				token,
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		// Send verification email (fire and forget)
		sendVerificationEmail(user.email, user.name, token).catch((err) => {
			console.error("[Resend Verification Email Error]", err);
		});

		return success({ message: "Verification email sent" });
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized();
		}
		console.error("[Resend Verification Error]", error);
		return serverError("Failed to resend verification email");
	}
}
