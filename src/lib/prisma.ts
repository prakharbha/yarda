import { PrismaClient } from "@/generated/prisma/client"
import { withAccelerate } from "@prisma/extension-accelerate"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? ""

  // Vercel Prisma Postgres: DATABASE_URL is the Accelerate URL (prisma+postgres://...)
  if (dbUrl.startsWith("prisma")) {
    return new PrismaClient({ accelerateUrl: dbUrl })
      .$extends(withAccelerate()) as unknown as PrismaClient
  }

  // Local dev: direct postgres URL, use PrismaPg adapter
  const connectionString = process.env.POSTGRES_URL ?? dbUrl
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
