/**
 * One-time script: mark all existing users as emailVerified = true.
 * Run after deploying the emailVerified schema change:
 *   npx prisma db push && node scripts/mark-existing-users-verified.mjs
 */
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
	const result = await prisma.user.updateMany({
		where: { emailVerified: false },
		data: { emailVerified: true },
	});
	console.log(
		`[Migration] Marked ${result.count} existing users as emailVerified=true`,
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
