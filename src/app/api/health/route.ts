export const dynamic = "force-dynamic"

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "(not set)"
  const pgUrl = process.env.POSTGRES_URL ?? "(not set)"

  let dbStatus = "untested"
  let dbError = ""

  try {
    const { prisma } = await import("@/lib/prisma")
    await prisma.$queryRaw`SELECT 1`
    dbStatus = "connected"
  } catch (e: unknown) {
    dbStatus = "error"
    dbError = e instanceof Error ? e.message : String(e)
  }

  return Response.json({
    dbUrlPrefix: dbUrl.slice(0, 40),
    pgUrlPrefix: pgUrl.slice(0, 40),
    dbStatus,
    dbError: dbError.slice(0, 200),
  })
}
