import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthError, requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	badRequest,
	forbidden,
	serverError,
	success,
	unauthorized,
} from "@/lib/responses";

const SETTING_KEY = "futa_gates";

const gateSchema = z.object({
	id: z.enum(["south", "north", "west"]),
	name: z.string().min(1),
	label: z.string().min(1),
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
});

const updateSchema = z.object({
	gates: z.array(gateSchema).min(1).max(10),
});

const DEFAULT_GATES = [
	{
		id: "south",
		name: "FUTA South Gate",
		label: "South Gate",
		lat: 7.2982,
		lng: 5.1385,
	},
	{
		id: "north",
		name: "FUTA North Gate",
		label: "North Gate",
		lat: 7.3112,
		lng: 5.1388,
	},
	{
		id: "west",
		name: "FUTA West Gate",
		label: "West Gate",
		lat: 7.3042,
		lng: 5.1272,
	},
];

/**
 * GET /api/settings/futa-gates
 * Public — returns the current FUTA gate coordinates.
 * Falls back to defaults if not yet configured.
 */
export async function GET() {
	try {
		const setting = await prisma.appSetting.findUnique({
			where: { key: SETTING_KEY },
		});

		const gates = setting
			? (setting.value as typeof DEFAULT_GATES)
			: DEFAULT_GATES;
		return success({ gates });
	} catch (error) {
		console.error("[FutaGates GET Error]", error);
		return serverError("Failed to fetch FUTA gate settings");
	}
}

/**
 * PATCH /api/settings/futa-gates
 * Admin only — upserts gate coordinates.
 */
export async function PATCH(request: NextRequest) {
	try {
		const user = requireAuth(request);
		requireRole(user, "ADMIN");

		const body = await request.json();
		const parsed = updateSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest(
				"Validation failed",
				parsed.error.flatten().fieldErrors,
			);
		}

		const setting = await prisma.appSetting.upsert({
			where: { key: SETTING_KEY },
			update: { value: parsed.data.gates as any },
			create: { key: SETTING_KEY, value: parsed.data.gates as any },
		});

		return success({ gates: setting.value });
	} catch (error) {
		if (error instanceof AuthError) {
			return error.message === "Forbidden"
				? forbidden("Only admins can update gate settings")
				: unauthorized("You must be logged in");
		}
		console.error("[FutaGates PATCH Error]", error);
		return serverError("Failed to update FUTA gate settings");
	}
}
