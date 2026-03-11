import { put } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	created,
	serverError,
	unauthorized,
} from "@/lib/responses";

/**
 * POST /api/documents/upload
 * Upload a document. Accepts multipart/form-data with:
 * - file: the file to upload
 * - type: document type string (e.g. "ID", "LEASE", "TRANSCRIPT")
 *
 * Files are stored in Vercel Blob Storage.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);

		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const type = formData.get("type") as string | null;

		if (!file) return badRequest("File is required");
		if (!type) return badRequest("Document type is required");

		// Validate file size (max 10MB)
		const MAX_SIZE = 10 * 1024 * 1024;
		if (file.size > MAX_SIZE) {
			return badRequest("File size must not exceed 10MB");
		}

		// Validate file type
		const ALLOWED_TYPES = [
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/avif",
			"application/pdf",
		];
		if (!ALLOWED_TYPES.includes(file.type)) {
			return badRequest(
				"Invalid file type. Allowed: JPEG, PNG, WebP, AVIF, PDF",
			);
		}

		// Upload to Vercel Blob Storage
		const ext = file.name.split(".").pop() || "bin";
		const filename = `${type.toLowerCase()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

		const blob = await put(filename, file, {
			access: "public",
			contentType: file.type,
		});

		const fileUrl = blob.url;

		// Store in database
		let targetUserId = user.userId;
		const requestedTargetId = formData.get("targetUserId") as string | null;

		if (user.role === "ADMIN" && requestedTargetId) {
			targetUserId = requestedTargetId;
		}

		const document = await prisma.document.create({
			data: {
				userId: targetUserId,
				type,
				fileUrl,
			},
		});

		return created({ ...document, url: fileUrl });
	} catch (error) {
		if (error instanceof AuthError) return unauthorized();
		console.error("[Document Upload Error]", error);
		return serverError("Failed to upload document");
	}
}
