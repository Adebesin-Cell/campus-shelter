import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	created,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

/**
 * GET /api/appeals
 * Get the current user's appeals.
 */
export async function GET(request: NextRequest) {
	try {
		const authUser = requireAuth(request);

		const appeals = await prisma.appeal.findMany({
			where: { userId: authUser.userId },
			orderBy: { createdAt: "desc" },
		});

		return success(appeals);
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized(error.message);
		}
		console.error("[Get Appeals Error]", error);
		return serverError("Failed to fetch appeals");
	}
}

/**
 * POST /api/appeals
 * Submit a suspension appeal.
 */
export async function POST(request: NextRequest) {
	try {
		const authUser = requireAuth(request);

		const user = await prisma.user.findUnique({
			where: { id: authUser.userId },
			select: { landlordStatus: true, role: true },
		});

		if (
			!user ||
			user.role !== "LANDLORD" ||
			user.landlordStatus !== "SUSPENDED"
		) {
			return badRequest("Only suspended landlords can submit appeals");
		}

		// Check for existing pending appeal
		const existingPending = await prisma.appeal.findFirst({
			where: { userId: authUser.userId, status: "PENDING" },
		});

		if (existingPending) {
			return badRequest(
				"You already have a pending appeal. Please wait for it to be reviewed.",
			);
		}

		const body = await request.json();
		const reason = body.reason?.trim();

		if (!reason || reason.length < 10) {
			return badRequest("Appeal reason must be at least 10 characters");
		}

		const appeal = await prisma.appeal.create({
			data: {
				userId: authUser.userId,
				reason,
			},
		});

		return created(appeal);
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized(error.message);
		}
		console.error("[Create Appeal Error]", error);
		return serverError("Failed to submit appeal");
	}
}
