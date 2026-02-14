import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { success, badRequest, unauthorized, serverError } from "@/lib/responses";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten().fieldErrors);
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
