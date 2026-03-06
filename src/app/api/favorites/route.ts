import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

const toggleSchema = z.object({ propertyId: z.string().min(1) });

/**
 * GET /api/favorites
 * Returns the authenticated user's favorited property IDs.
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);

		const favorites = await prisma.favorite.findMany({
			where: { userId: user.userId },
			select: { propertyId: true },
		});

		return success({ propertyIds: favorites.map((f) => f.propertyId) });
	} catch (error) {
		if (error instanceof AuthError) return unauthorized();
		console.error("[Favorites GET Error]", error);
		return serverError("Failed to fetch favorites");
	}
}

/**
 * POST /api/favorites
 * Toggle a property in/out of favorites. Returns { favorited: boolean }.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);

		const body = await request.json();
		const parsed = toggleSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { propertyId } = parsed.data;

		// Verify property exists
		const property = await prisma.property.findUnique({
			where: { id: propertyId },
		});
		if (!property) return notFound("Property not found");

		const existing = await prisma.favorite.findUnique({
			where: { userId_propertyId: { userId: user.userId, propertyId } },
		});

		if (existing) {
			await prisma.favorite.delete({ where: { id: existing.id } });
			return success({ favorited: false, propertyId });
		} else {
			await prisma.favorite.create({
				data: { userId: user.userId, propertyId },
			});
			return success({ favorited: true, propertyId });
		}
	} catch (error) {
		if (error instanceof AuthError) return unauthorized();
		console.error("[Favorites POST Error]", error);
		return serverError("Failed to toggle favorite");
	}
}
