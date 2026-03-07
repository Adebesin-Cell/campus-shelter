import { prisma } from "@/lib/prisma";
import { serverError, success } from "@/lib/responses";

/**
 * GET /api/properties/locations
 * Returns distinct location values from approved properties.
 */
export async function GET() {
	try {
		const rows = await prisma.property.findMany({
			where: { status: "APPROVED" },
			select: { location: true },
			distinct: ["location"],
			orderBy: { location: "asc" },
		});

		const locations = rows.map((r) => r.location);
		return success({ locations });
	} catch (error) {
		console.error("[Locations GET Error]", error);
		return serverError("Failed to fetch locations");
	}
}
