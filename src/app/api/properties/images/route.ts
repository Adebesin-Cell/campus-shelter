import { put } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import {
	badRequest,
	created,
	forbidden,
	serverError,
	unauthorized,
} from "@/lib/responses";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB raw; client compresses before sending

/**
 * POST /api/properties/images
 * Upload a property image to Vercel Blob.
 * Accepts multipart/form-data with a single "file" field.
 * Returns { url } — the permanent public URL to store in the DB.
 */
export async function POST(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "LANDLORD", "ADMIN");

		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file) return badRequest("No file provided");
		if (!ALLOWED_TYPES.includes(file.type))
			return badRequest("Invalid file type. Allowed: JPEG, PNG, WebP, AVIF");
		if (file.size > MAX_SIZE_BYTES)
			return badRequest("File too large. Maximum size is 10 MB");

		const ext = file.type.split("/")[1] ?? "jpg";
		const filename = `properties/${user.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

		const blob = await put(filename, file, {
			access: "public",
			contentType: file.type,
		});

		return created({ url: blob.url });
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only landlords and admins can upload property images")
				: unauthorized("You must be logged in to upload images");
		}
		console.error("[Property Image Upload Error]", error);
		return serverError("Failed to upload image");
	}
}
