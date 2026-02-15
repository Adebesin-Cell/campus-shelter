import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
 * Files are stored in public/uploads/ (can be swapped to S3/Cloudinary).
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

		// Create uploads directory if it doesn't exist
		const uploadsDir = join(process.cwd(), "public", "uploads");
		await mkdir(uploadsDir, { recursive: true });

		// Generate unique filename
		const ext = file.name.split(".").pop() || "bin";
		const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
		const filepath = join(uploadsDir, filename);

		// Write file to disk
		const bytes = await file.arrayBuffer();
		await writeFile(filepath, Buffer.from(bytes));

		const fileUrl = `/uploads/${filename}`;

		// Store in database
		const document = await prisma.document.create({
			data: {
				userId: user.userId,
				type,
				fileUrl,
			},
		});

		return created(document);
	} catch (error) {
		if (error instanceof AuthError) return unauthorized();
		console.error("[Document Upload Error]", error);
		return serverError("Failed to upload document");
	}
}
