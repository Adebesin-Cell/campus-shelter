import type { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError, success } from "@/lib/responses";
import { resetPasswordSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const parsed = resetPasswordSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { token, newPassword } = parsed.data;

		const resetRecord = await prisma.passwordReset.findUnique({
			where: { token },
		});

		if (
			!resetRecord ||
			resetRecord.used ||
			resetRecord.expiresAt < new Date()
		) {
			return badRequest("Invalid or expired reset token");
		}

		const hashedPassword = await hashPassword(newPassword);

		await prisma.$transaction([
			prisma.user.update({
				where: { id: resetRecord.userId },
				data: { password: hashedPassword },
			}),
			prisma.passwordReset.update({
				where: { id: resetRecord.id },
				data: { used: true },
			}),
		]);

		return success({ message: "Password has been reset successfully" });
	} catch (error) {
		console.error("[Reset Password Error]", error);
		return serverError("Failed to reset password");
	}
}
