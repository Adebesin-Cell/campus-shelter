import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serverError, success, unauthorized } from "@/lib/responses";

/**
 * DELETE /api/auth/delete-account
 * Permanently delete the authenticated user's account and all associated data.
 */
export async function DELETE(request: NextRequest) {
	try {
		const authUser = requireAuth(request);

		// Delete user and all related data (cascading via Prisma relations)
		await prisma.user.delete({
			where: { id: authUser.userId },
		});

		return success({ message: "Account deleted successfully" });
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized();
		}
		console.error("[Delete Account Error]", error);
		return serverError("Failed to delete account");
	}
}
