import type { NextRequest } from "next/server";
import { AuthError, getAuthUser, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	created,
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";
import { roomSchema } from "@/lib/validations";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/properties/[id]/rooms
 * List all rooms for a property (anyone can view).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;

		const property = await prisma.property.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!property) return notFound("Property not found");

		const rooms = await prisma.room.findMany({
			where: { propertyId: id },
			orderBy: { createdAt: "asc" },
		});

		return success(rooms);
	} catch (error) {
		console.error("[Property Rooms GET Error]", error);
		return serverError("Failed to fetch rooms");
	}
}

/**
 * POST /api/properties/[id]/rooms
 * Add a new room to a property (landlord owner or admin only).
 * Body: { name, roomType, priceMonthly, priceWeekly?, furnished?, description? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD", "ADMIN");

		const { id } = await params;

		const property = await prisma.property.findUnique({
			where: { id },
			select: { id: true, landlordId: true },
		});

		if (!property) return notFound("Property not found");

		// Landlords can only add rooms to their own properties
		if (user.role === "LANDLORD" && property.landlordId !== user.userId) {
			return forbidden("You can only add rooms to your own properties");
		}

		const body = await request.json();
		const parsed = roomSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const room = await prisma.room.create({
			data: {
				...parsed.data,
				propertyId: id,
			},
		});

		return created(room);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords and admins can add rooms")
				: unauthorized("You must be logged in to add a room");
		}
		console.error("[Property Rooms POST Error]", error);
		return serverError("Failed to create room");
	}
}
