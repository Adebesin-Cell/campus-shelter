import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	created,
	getPagination,
	notFound,
	paginated,
	serverError,
	unauthorized,
} from "@/lib/responses";
import { sendMessageSchema } from "@/lib/validations";

/**
 * GET /api/messages
 * Get messages for the authenticated user.
 * Optional query param: userId (conversation partner).
 */
export async function GET(request: NextRequest) {
	try {
		const user = requireAuth(request);
		const { searchParams } = request.nextUrl;
		const { page, limit, skip } = getPagination(searchParams);

		const partnerId = searchParams.get("userId");

		const where = partnerId
			? {
					OR: [
						{ senderId: user.userId, receiverId: partnerId },
						{ senderId: partnerId, receiverId: user.userId },
					],
				}
			: {
					OR: [{ senderId: user.userId }, { receiverId: user.userId }],
				};

		const [messages, total] = await Promise.all([
			prisma.message.findMany({
				where,
				include: {
					sender: { select: { id: true, name: true } },
					receiver: { select: { id: true, name: true } },
				},
				orderBy: { createdAt: "desc" },
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
		if (error instanceof AuthError) return unauthorized();
		console.error("[Messages GET Error]", error);
		return serverError("Failed to fetch messages");
	}
}

/**
 * POST /api/messages
 * Send a message to another user.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);

		const body = await request.json();
		const parsed = sendMessageSchema.safeParse(body);

		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const { receiverId, propertyId, content } = parsed.data;

		// Can't message yourself
		if (receiverId === user.userId) {
			return badRequest("You cannot send a message to yourself");
		}

		// Verify receiver exists
		const receiver = await prisma.user.findUnique({
			where: { id: receiverId },
		});
		if (!receiver) return notFound("Receiver not found");

		const message = await prisma.message.create({
			data: {
				senderId: user.userId,
				receiverId,
				propertyId: propertyId || null,
				content,
			},
			include: {
				sender: { select: { id: true, name: true } },
				receiver: { select: { id: true, name: true } },
			},
		});

		return created(message);
	} catch (error) {
		if (error instanceof AuthError) return unauthorized();
		console.error("[Messages POST Error]", error);
		return serverError("Failed to send message");
	}
}
