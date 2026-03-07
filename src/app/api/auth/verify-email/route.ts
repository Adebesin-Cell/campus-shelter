import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError, success } from "@/lib/responses";

/**
 * POST /api/auth/verify-email
 * Verify a user's email address using the token sent via email.
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { token } = body as { token?: string };

		if (!token) {
			return badRequest("Verification token is required");
		}

		const verification = await prisma.emailVerification.findUnique({
			where: { token },
			include: { user: { select: { id: true, emailVerifiedAt: true } } },
		});

		if (!verification) {
			return badRequest("Invalid verification token");
		}

		if (verification.expiresAt < new Date()) {
			// Clean up expired token
			await prisma.emailVerification.delete({
				where: { id: verification.id },
			});
			return badRequest(
				"Verification token has expired. Please request a new one.",
			);
		}

		if (verification.user.emailVerifiedAt) {
			// Already verified — clean up token and return success
			await prisma.emailVerification.delete({
				where: { id: verification.id },
			});
			return success({ message: "Email already verified" });
		}

		// Mark email as verified and delete the token
		await prisma.$transaction([
			prisma.user.update({
				where: { id: verification.userId },
				data: { emailVerifiedAt: new Date() },
			}),
			prisma.emailVerification.deleteMany({
				where: { userId: verification.userId },
			}),
		]);

		return success({ message: "Email verified successfully" });
	} catch (error) {
		console.error("[Verify Email Error]", error);
		return serverError("Failed to verify email");
	}
}
