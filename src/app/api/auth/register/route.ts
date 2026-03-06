import type { NextRequest } from "next/server";
import { hashPassword, signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { badRequest, created, serverError } from "@/lib/responses";
import { registerSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	try {
		const ip = getClientIp(request);
		const rl = checkRateLimit(`register:${ip}`, { max: 5, windowSec: 3600 });
		if (!rl.allowed) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Too many registration attempts. Try again later.",
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
		const parsed = registerSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { name, email, phone, password, role } = parsed.data;

		// Check if user already exists
		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			return badRequest("Email already registered");
		}

		// Hash password and create user
		const hashedPassword = await hashPassword(password);
		const user = await prisma.user.create({
			data: {
				name,
				email,
				phone,
				password: hashedPassword,
				role,
				landlordStatus: role === "LANDLORD" ? "PENDING" : null,
				idCardUrl: role === "LANDLORD" ? parsed.data.idCardUrl : null,
			},
			select: {
				id: true,
				name: true,
				email: true,
				phone: true,
				role: true,
				landlordStatus: true,
				verified: true,
				createdAt: true,
			},
		});

		// Generate JWT
		const token = signToken({ userId: user.id, role: user.role });

		return created({ user, token });
	} catch (error) {
		console.error("[Register Error]", error);
		return serverError("Failed to register user");
	}
}
