import type { NextRequest } from "next/server";
import { comparePassword, signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { loginSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const parsed = loginSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { email, password } = parsed.data;

		// Find user by email
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			return unauthorized("Invalid email or password");
		}

		// Compare password
		const isValid = await comparePassword(password, user.password);
		if (!isValid) {
			return unauthorized("Invalid email or password");
		}

		// Generate JWT
		const token = signToken({ userId: user.id, role: user.role });

		return success({
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				phone: user.phone,
				role: user.role,
				verified: user.verified,
				createdAt: user.createdAt,
			},
			token,
		});
	} catch (error) {
		console.error("[Login Error]", error);
		return serverError("Failed to login");
	}
}
