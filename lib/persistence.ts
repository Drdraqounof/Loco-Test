import { Prisma } from "@prisma/client";

export function isPersistenceUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1002";
  }

  return error instanceof Error && /can't reach database server|error in postgresql connection|closed/i.test(error.message);
}