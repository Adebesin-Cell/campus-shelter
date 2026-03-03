import type { NextRequest } from "next/server";
import {
	AuthError,
	comparePassword,
	hashPassword,
	requireAuth,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { changePasswordSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	try {
		const authUser = requireAuth(request);

		const body = await request.json();
		const parsed = changePasswordSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { currentPassword, newPassword } = parsed.data;

		const user = await prisma.user.findUnique({
			where: { id: authUser.userId },
		});

		if (!user) {
			return unauthorized("User not found");
		}

		const isValid = await comparePassword(currentPassword, user.password);
		if (!isValid) {
			return badRequest("Current password is incorrect");
		}

		const hashedPassword = await hashPassword(newPassword);

		await prisma.user.update({
			where: { id: user.id },
			data: { password: hashedPassword },
		});

		return success({ message: "Password changed successfully" });
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized();
		}
		console.error("[Change Password Error]", error);
		return serverError("Failed to change password");
	}
}
