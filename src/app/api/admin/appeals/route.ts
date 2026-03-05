import type { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma";
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
 * GET /api/admin/appeals
 * List all appeals (admin only).
 * Supports: ?status=PENDING&search=john&page=1&limit=10
 */
export async function GET(request: NextRequest) {
	try {
		const admin = requireAuth(request);
		requireRole(admin, "ADMIN");

		const { searchParams } = new URL(request.url);
		const { page, limit, skip } = getPagination(searchParams);
		const statusFilter = searchParams.get("status");
		const search = searchParams.get("search")?.trim();

		const where: Prisma.AppealWhereInput = {};

		if (
			statusFilter &&
			["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)
		) {
			where.status = statusFilter as "PENDING" | "APPROVED" | "REJECTED";
		}

		if (search) {
			where.user = {
				OR: [
					{ name: { contains: search, mode: "insensitive" } },
					{ email: { contains: search, mode: "insensitive" } },
				],
			};
		}

		const [appeals, total] = await Promise.all([
			prisma.appeal.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							landlordStatus: true,
						},
					},
				},
			}),
			prisma.appeal.count({ where }),
		]);

		return paginated(appeals, {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can view appeals")
				: unauthorized(error.message);
		}
		console.error("[Admin Get Appeals Error]", error);
		return serverError("Failed to fetch appeals");
	}
}
