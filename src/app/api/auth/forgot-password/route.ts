import type { NextRequest } from "next/server";
import { generateResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError, success } from "@/lib/responses";
import { forgotPasswordSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const parsed = forgotPasswordSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { email } = parsed.data;

		// Always return success to avoid leaking whether an email exists
		const user = await prisma.user.findUnique({ where: { email } });

		if (user) {
			// Invalidate any existing unused reset tokens for this user
			await prisma.passwordReset.updateMany({
				where: { userId: user.id, used: false },
				data: { used: true },
			});

			const token = generateResetToken();
			const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

			await prisma.passwordReset.create({
				data: {
					userId: user.id,
					token,
					expiresAt,
				},
			});

			try {
				await sendPasswordResetEmail(email, token);
			} catch (emailError) {
				console.error("[Email Error]", emailError);
				// Still return success — don't reveal email delivery failures
			}
		}

		return success({
			message:
				"If an account with that email exists, a password reset link has been sent.",
		});
	} catch (error) {
		console.error("[Forgot Password Error]", error);
		return serverError("Failed to process password reset request");
	}
}
