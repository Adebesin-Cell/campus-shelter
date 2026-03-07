import type { NextRequest } from "next/server";
import { comparePassword, signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
	badRequest,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { loginSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	try {
		const ip = getClientIp(request);
		const rl = checkRateLimit(`login:${ip}`, { max: 10, windowSec: 900 });
		if (!rl.allowed) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Too many login attempts. Try again later.",
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
				verifiedAt: user.verifiedAt,
				emailVerifiedAt: user.emailVerifiedAt,
				landlordStatus: user.landlordStatus,
				suspensionReason: user.suspensionReason,
				idCardUrl: user.idCardUrl,
				createdAt: user.createdAt,
			},
			token,
		});
	} catch (error) {
		console.error("[Login Error]", error);
		return serverError("Failed to login");
	}
}
