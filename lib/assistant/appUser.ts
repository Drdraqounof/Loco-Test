import { prisma } from "@/lib/prisma";

// In plain terms: ensures a default app user exists so integrations can be scoped per user.

export const DEFAULT_APP_USER_EMAIL = "app@local";

export async function ensureDefaultAppUser() {
  return prisma.user.upsert({
    where: { email: DEFAULT_APP_USER_EMAIL },
    update: {},
    create: {
      email: DEFAULT_APP_USER_EMAIL,
      name: "Loco App",
    },
  });
}

export async function resolveIntegrationUserId(userId?: number | null) {
  if (typeof userId === "number" && Number.isFinite(userId)) {
    return userId;
  }

  const user = await ensureDefaultAppUser();
  return user.id;
}
