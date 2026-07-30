import { prisma } from "@/lib/prisma";

// In plain terms: service boundary for the workforce/rubric domain so it stays separate from chat orchestration.

export async function listWorkforceMembers() {
  return prisma.workforceMember.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getWorkforceMember(id: number) {
  return prisma.workforceMember.findUnique({
    where: { id },
    include: {
      assessments: {
        include: {
          competency: true,
          evidenceLinks: true,
        },
        orderBy: { assessmentDate: "desc" },
      },
    },
  });
}

export async function listWorkforceAreas() {
  return prisma.workforceArea.findMany({
    orderBy: { code: "asc" },
    include: {
      competencies: {
        orderBy: { sortOrder: "asc" },
        include: {
          rubricLevels: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
}

export async function listWorkforceAssessments(memberId?: number) {
  return prisma.workforceAssessment.findMany({
    where: memberId ? { memberId } : undefined,
    include: {
      member: true,
      competency: true,
      evidenceLinks: true,
    },
    orderBy: { assessmentDate: "desc" },
  });
}
