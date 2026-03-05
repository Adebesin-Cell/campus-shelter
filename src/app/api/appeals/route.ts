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
import { sanitizeText } from "@/lib/sanitize";
import { sendAppealSubmittedEmail } from "@/lib/email";

/** Cooldown period (in hours) after a rejected appeal before a new one can be submitted. */
const APPEAL_COOLDOWN_HOURS = 72;

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
			select: { name: true, email: true, landlordStatus: true, role: true },
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

		// Check cooldown: must wait APPEAL_COOLDOWN_HOURS after last rejection
		const lastRejected = await prisma.appeal.findFirst({
			where: { userId: authUser.userId, status: "REJECTED" },
			orderBy: { processedAt: "desc" },
		});

		if (lastRejected?.processedAt) {
			const cooldownEnd = new Date(
				lastRejected.processedAt.getTime() +
					APPEAL_COOLDOWN_HOURS * 60 * 60 * 1000,
			);
			if (new Date() < cooldownEnd) {
				const hoursLeft = Math.ceil(
					(cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60),
				);
				return badRequest(
					`You must wait ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} before submitting another appeal.`,
				);
			}
		}

		const body = await request.json();
		const rawReason = body.reason?.trim();

		if (!rawReason || rawReason.length < 10) {
			return badRequest("Appeal reason must be at least 10 characters");
		}

		const reason = sanitizeText(rawReason);

		const appeal = await prisma.appeal.create({
			data: {
				userId: authUser.userId,
				reason,
			},
		});

		// Send confirmation email (fire-and-forget)
		sendAppealSubmittedEmail(user.email, user.name).catch((err) =>
			console.error("[Appeal Submitted Email Error]", err),
		);

		return created(appeal);
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized(error.message);
		}
		console.error("[Create Appeal Error]", error);
		return serverError("Failed to submit appeal");
	}
}

/**
 * DELETE /api/appeals
 * Withdraw a pending appeal.
 */
export async function DELETE(request: NextRequest) {
	try {
		const authUser = requireAuth(request);

		const { searchParams } = new URL(request.url);
		const appealId = searchParams.get("id");

		if (!appealId) {
			return badRequest("Appeal ID is required");
		}

		const appeal = await prisma.appeal.findUnique({
			where: { id: appealId },
		});

		if (!appeal) {
			return badRequest("Appeal not found");
		}

		if (appeal.userId !== authUser.userId) {
			return badRequest("You can only withdraw your own appeals");
		}

		if (appeal.status !== "PENDING") {
			return badRequest("Only pending appeals can be withdrawn");
		}

		await prisma.appeal.delete({
			where: { id: appealId },
		});

		return success({ message: "Appeal withdrawn successfully" });
	} catch (error) {
		if (error instanceof AuthError) {
			return unauthorized(error.message);
		}
		console.error("[Withdraw Appeal Error]", error);
		return serverError("Failed to withdraw appeal");
	}
}
