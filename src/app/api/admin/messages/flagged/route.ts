import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	forbidden,
	getPagination,
	paginated,
	serverError,
	unauthorized,
} from "@/lib/responses";

/**
 * GET /api/admin/messages/flagged
 * Admin endpoint to view all flagged messages.
 */
export async function GET(request: NextRequest) {
	try {
		const admin = requireAuth(request);
		requireRole(admin, "ADMIN");

		const { searchParams } = request.nextUrl;
		const { page, limit, skip } = getPagination(searchParams);
		const search = searchParams.get("search") || "";

		const where: Record<string, unknown> = {
			flaggedAt: { not: null },
		};

		if (search) {
			where.OR = [
				{ sender: { name: { contains: search, mode: "insensitive" } } },
				{ receiver: { name: { contains: search, mode: "insensitive" } } },
				{ content: { contains: search, mode: "insensitive" } },
			];
		}

		const [messages, total] = await Promise.all([
			prisma.message.findMany({
				where,
				include: {
					sender: { select: { id: true, name: true, email: true } },
					receiver: { select: { id: true, name: true, email: true } },
				},
				orderBy: { flaggedAt: "desc" },
				skip,
				take: limit,
			}),
			prisma.message.count({ where }),
		]);

		return paginated(messages, {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can view flagged messages")
				: unauthorized();
		}
		console.error("[Admin Flagged Messages Error]", error);
		return serverError("Failed to fetch flagged messages");
	}
}
