import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { created, badRequest, serverError } from "@/lib/responses";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten().fieldErrors);
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
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
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
