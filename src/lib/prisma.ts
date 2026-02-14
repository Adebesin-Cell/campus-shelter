import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const prismaClientSingleton = () => {
	const adapter = new PrismaPg({
		connectionString: env.DATABASE_URL,
	});

	return new PrismaClient({
		adapter,
		transactionOptions: {
			maxWait: 30000,
			timeout: 30000,
		},
	});
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

export { prisma }
