import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serverError, success, unauthorized } from "@/lib/responses";

/**
 * GET /api/messages/unread
 * Returns the count of unread messages for the authenticated user.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);

		const count = await prisma.message.count({
			where: { receiverId: user.userId, read: false },
		});

		return success({ count });
	} catch (error) {
		if (error instanceof AuthError) return unauthorized();
		console.error("[Messages Unread GET Error]", error);
		return serverError("Failed to fetch unread count");
	}
}
