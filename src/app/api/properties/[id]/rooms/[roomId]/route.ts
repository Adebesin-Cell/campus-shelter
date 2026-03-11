import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	notFound,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

interface RouteParams {
	params: Promise<{ id: string; roomId: string }>;
}

const updateRoomSchema = z.object({
	name: z.string().min(1, "Room name is required").optional(),
	roomType: z.enum(["SINGLE", "SELF_CON", "MINI_FLAT"]).optional(),
	priceMonthly: z
		.number()
		.positive("Monthly price must be positive")
		.optional(),
	priceWeekly: z
		.number()
		.positive("Weekly price must be positive")
		.optional()
		.nullable(),
	furnished: z.boolean().optional(),
	isAvailable: z.boolean().optional(),
	description: z
		.string()
		.max(2000, "Description must be under 2000 characters")
		.optional()
		.nullable(),
});

/**
 * PATCH /api/properties/[id]/rooms/[roomId]
 * Update a room (landlord owner or admin only).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD", "ADMIN");

		const { id, roomId } = await params;

		const room = await prisma.room.findUnique({
			where: { id: roomId },
			include: { property: { select: { id: true, landlordId: true } } },
		});

		if (!room) return notFound("Room not found");

		if (room.propertyId !== id) {
			return notFound("Room not found for this property");
		}

		// Landlords can only update rooms on their own properties
		if (user.role === "LANDLORD" && room.property.landlordId !== user.userId) {
			return forbidden("You can only update rooms on your own properties");
		}

		const body = await request.json();
		const parsed = updateRoomSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const updated = await prisma.room.update({
			where: { id: roomId },
			data: parsed.data,
		});

		return success(updated);
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords and admins can update rooms")
				: unauthorized("You must be logged in to update a room");
		}
		console.error("[Room PATCH Error]", error);
		return serverError("Failed to update room");
	}
}

/**
 * DELETE /api/properties/[id]/rooms/[roomId]
 * Delete a room (landlord owner or admin only).
 * Only allowed if the room has no active (PENDING or APPROVED) bookings.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD", "ADMIN");

		const { id, roomId } = await params;

		const room = await prisma.room.findUnique({
			where: { id: roomId },
			include: {
				property: { select: { id: true, landlordId: true } },
				bookings: {
					where: { status: { in: ["PENDING", "APPROVED"] } },
					select: { id: true },
				},
			},
		});

		if (!room) return notFound("Room not found");

		if (room.propertyId !== id) {
			return notFound("Room not found for this property");
		}

		// Landlords can only delete rooms on their own properties
		if (user.role === "LANDLORD" && room.property.landlordId !== user.userId) {
			return forbidden("You can only delete rooms on your own properties");
		}

		if (room.bookings.length > 0) {
			return badRequest(
				"Cannot delete a room with active bookings (PENDING or APPROVED)",
			);
		}

		await prisma.room.delete({ where: { id: roomId } });

		return success({ message: "Room deleted successfully" });
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords and admins can delete rooms")
				: unauthorized("You must be logged in to delete a room");
		}
		console.error("[Room DELETE Error]", error);
		return serverError("Failed to delete room");
	}
}
