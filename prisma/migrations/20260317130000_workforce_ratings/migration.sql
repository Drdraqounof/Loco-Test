-- CreateTable
CREATE TABLE "WorkforceMember" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkforceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceCompetency" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkforceCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceRubricLevel" (
    "id" SERIAL NOT NULL,
    "competencyId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkforceRubricLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceAssessment" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "competencyId" INTEGER NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "selfScore" INTEGER,
    "reflection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkforceAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceEvidenceLink" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkforceEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkforceMember_email_key" ON "WorkforceMember"("email");

-- CreateIndex
CREATE INDEX "WorkforceMember_name_idx" ON "WorkforceMember"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkforceCompetency_code_key" ON "WorkforceCompetency"("code");

-- CreateIndex
CREATE INDEX "WorkforceCompetency_code_title_idx" ON "WorkforceCompetency"("code", "title");

-- CreateIndex
CREATE UNIQUE INDEX "WorkforceRubricLevel_competencyId_score_key" ON "WorkforceRubricLevel"("competencyId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "WorkforceRubricLevel_competencyId_sortOrder_key" ON "WorkforceRubricLevel"("competencyId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkforceRubricLevel_competencyId_sortOrder_idx" ON "WorkforceRubricLevel"("competencyId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkforceAssessment_memberId_assessmentDate_idx" ON "WorkforceAssessment"("memberId", "assessmentDate");

-- CreateIndex
CREATE INDEX "WorkforceAssessment_competencyId_assessmentDate_idx" ON "WorkforceAssessment"("competencyId", "assessmentDate");

-- CreateIndex
CREATE INDEX "WorkforceEvidenceLink_assessmentId_idx" ON "WorkforceEvidenceLink"("assessmentId");

-- AddForeignKey
ALTER TABLE "WorkforceRubricLevel" ADD CONSTRAINT "WorkforceRubricLevel_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "WorkforceCompetency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceAssessment" ADD CONSTRAINT "WorkforceAssessment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkforceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceAssessment" ADD CONSTRAINT "WorkforceAssessment_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "WorkforceCompetency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceEvidenceLink" ADD CONSTRAINT "WorkforceEvidenceLink_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "WorkforceAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed rubric competencies.
INSERT INTO "WorkforceCompetency" ("code", "title", "description", "createdAt", "updatedAt") VALUES
('LP.1.1', 'Show up and show out', 'Task focus, planning, time management, deadlines, and productivity.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.2', 'Set and meet goals', 'Goal setting, action planning, revising goals, and identifying needed resources.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.3', 'Collaborate and work as a team', 'Creating a positive work environment, sharing feedback, and using empathy in teamwork.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.4', 'Communicate effectively', 'Intentional communication, active listening, and adjusting verbal and non-verbal communication.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.5', 'Resolve Disagreements', 'Conflict resolution, staying calm, listening, and working toward constructive solutions.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.6', 'Demonstrate Flexibility and Adaptability', 'Monitoring changing conditions, problem solving, and adjusting plans or mindset.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.7', 'Make Informed Decisions', 'Using values and goals to make decisions, consulting stakeholders, and taking responsibility.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.8', 'Seek Support and Feedback', 'Asking for support appropriately, requesting feedback, and applying it.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.9', 'Demonstrate Growth Mindset', 'Taking on challenges, learning from failure, and reflecting on improvement.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('LP.1.10', 'Continuous Learning', 'Finding resources, identifying growth areas, and reflecting for improvement.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed rubric levels using the Launchpad-style 6/8/10/12 scale.
INSERT INTO "WorkforceRubricLevel" ("competencyId", "score", "sortOrder", "summary")
SELECT c.id, v.score, v.sort_order, v.summary
FROM "WorkforceCompetency" c
JOIN (
    VALUES
    ('LP.1.1', 6, 1, $$With support, I can stay on task.

With support, I can create a simple plan for a small task and identify the most important steps.

I can set a basic deadline for myself for a single task (e.g., by 2pm, next Sunday, in October).

With support, I can use work time efficiently.$$),
    ('LP.1.1', 8, 2, $$I can stay on task and engaged.

I can create a work plan, prioritize tasks based on importance and deadlines, and use a simple list or tool (e.g., calendar, Notes) to monitor my progress.

I can set deadlines for short-term tasks with different time frames (e.g., one by 2pm today, another by next Sunday).

I can use work time efficiently.$$),
    ('LP.1.1', 10, 3, $$I can stay on task and engaged and often act as a leader (e.g., volunteering to represent Launchpad at events, offering support) among my peers.

I can create a work plan, prioritize tasks based on importance and deadlines, use advanced tools (e.g., Beacon, Asana, Click Up) to monitor my progress, and ensure I have the tools I need to successfully complete my work.

I can set deadlines and checkpoints for long-term tasks (e.g., research by next Sunday, draft by the end of the month).

I can consistently use work time efficiently and use productivity tools to support my work (e.g., Google Suite, Grammarly, Zoom).$$),
    ('LP.1.1', 12, 4, $$I can consistently stay on task and engaged and act as a leader (e.g., volunteering to represent Launchpad at events, offering support) among my peers, including encouraging others to go above and beyond the expectations for the day, like I do.

I can create a comprehensive work plan, prioritize tasks based on importance and deadlines, use advanced tools (e.g., Beacon, Asana, Click Up) to monitor my progress, and ensure I have the tools I need to successfully complete my work.

I can set detailed and realistic deadlines and checkpoints for complex tasks involving multiple steps (e.g., planning phase by October, implementation by December) and adjust as needed.

I can consistently use work time efficiently and use productivity tools to support my work (e.g., Google Suite, Grammarly, Zoom).$$),

    ('LP.1.2', 6, 1, $$With support, I can set a goal.$$),
    ('LP.1.2', 8, 2, $$I can set a measurable goal (e.g. SMART goal) and create an action plan.

I can revise my goal if I am struggling to reach it.

I can identify materials (e.g., laptop, login credentials) I need to achieve my goal.$$),
    ('LP.1.2', 10, 3, $$I can independently set measurable goals (e.g. SMART Goals), create an action plan, identify possible barriers, and seek support to overcome them.

I can reflect on my progress and, when necessary, revise my goals.

I can identify and implement resources (e.g., technology, expertise, materials, tools) I need to achieve my goal.$$),
    ('LP.1.2', 12, 4, $$I can independently set measurable goals (e.g. SMART Goals), create an action plan, plan for possible barriers, and seek support to overcome them, when necessary.

I can regularly and independently reflect on my progress and, when necessary, revise my goals.

I can identify, gather, and implement the most critical resources (e.g., technology, expertise, materials, tools) I need to achieve my goal.$$),

    ('LP.1.3', 6, 1, $$With support, I can try to create a positive work environment by exploring how my strengths can be used to build relationships and by learning how to follow community agreements.

I can ask my team for feedback.$$),
    ('LP.1.3', 8, 2, $$I can work to create a positive work environment by using my strengths to build relationships and by occasionally following community agreements.

I can seek and share feedback from different people (e.g., teammates, mentors, teachers, supervisors) on a team project.$$),
    ('LP.1.3', 10, 3, $$I can create a positive work environment by using my strengths and talents to build relationships and by consistently following community agreements.

I can consistently seek and share feedback from different people (e.g., teammates, mentors, teachers, supervisors) on a team project and, with my team, determine which feedback will strengthen our work.

I can practice empathy to understand the perspectives and experiences of others.$$),
    ('LP.1.3', 12, 4, $$I can maintain a positive work environment by using the strengths and talents of my team to help build strong relationships and hold ourselves accountable to our community agreements.

I can actively seek and share feedback from different people (e.g., teammates, mentors, teachers, supervisors) on a team project and, with my team, determine which feedback will strengthen our work together.

I can practice empathy to understand the perspectives and experiences of others.

I can lead by example through modeling high-level collaboration and teamwork skills.$$),

    ('LP.1.4', 6, 1, $$With support, I can communicate with intention (e.g., phone call vs. email, speaking loudly enough, proofreading).

I can demonstrate basic listening skills (e.g., looking at the speaker, nodding when I agree).$$),
    ('LP.1.4', 8, 2, $$I can communicate with intention (e.g., phone call vs. email, speaking loudly enough, proofreading).

I can demonstrate active listening skills (e.g., being fully present, asking open-ended questions, withholding advice).

I can identify a few non-verbal cues (e.g., eye contact, gestures, posture) that will help me communicate my message.$$),
    ('LP.1.4', 10, 3, $$I can communicate with intention by considering context, audience, timing, urgency, seriousness, and purpose.

I can demonstrate active listening skills (e.g., being fully present, asking open-ended questions, withholding advice) with a wide variety of people (e.g, family, peers, Launchpad staff, internship hosts).

I can notice and adjust my non-verbal cues (e.g., eye contact, gestures, posture) in order to communicate my message.$$),
    ('LP.1.4', 12, 4, $$I can consistently communicate with intention by considering context, audience, timing, urgency, seriousness, purpose, and cultural differences.

I can consistently demonstrate active listening (e.g., being fully present, asking open-ended questions, withholding advice) to a wide variety of people (e.g, family, peers, Launchpad staff, internship hosts).

I can consistently notice and adjust my non-verbal cues (e.g., eye contact, gestures, posture) in order to successfully communicate my message.

I can notice others' non-verbal cues and tone and adjust how I communicate accordingly.$$),

    ('LP.1.5', 6, 1, $$I can listen to others during a disagreement or conflict.

I can identify at least one way to stay calm in a disagreement or conflict.$$),
    ('LP.1.5', 8, 2, $$I can listen to others, seek the root of the problem, and not make assumptions about how others are feeling in a disagreement or conflict.

I can create a safety plan so I can stay calm in a disagreement or conflict.

I can apply conflict resolution strategies (e.g., focus only on the current problem, compromise) in professional settings.$$),
    ('LP.1.5', 10, 3, $$I can actively listen, seek the root of the problem as well as common ground, observe nonverbal cues (e.g., facial expressions, gestures, tone of voice) and challenge myself to understand others' perspectives without making assumptions during a disagreement or conflict.

I can use my safety plan so I can stay calm in a disagreement or conflict and to engage in a restorative, constructive conflict resolution process.

I can consistently apply conflict resolution strategies (e.g., focus only on the current problem, compromise) in professional settings.$$),
    ('LP.1.5', 12, 4, $$I can consistently actively listen, seek the root of the problem as well as common ground, observe nonverbal cues (e.g., facial expressions, gestures, tone of voice) and challenge myself to understand others' perspectives without making assumptions during a disagreement or conflict.

I can consistently use my safety plan so I can stay calm in a disagreement or conflict, engage in a restorative and constructive resolution process, and encourage others to do the same.

I can strategically apply conflict resolution strategies (e.g., focus only on the current problem, compromise) in professional settings.

I can make conflict resolution suggestions that are accepted by my peers.$$),

    ('LP.1.6', 6, 1, $$With support, I can monitor the circumstances around me to understand if I have to make a change.

With support, I can problem solve for changes in my plan, project and/or mindset and pivot accordingly.$$),
    ('LP.1.6', 8, 2, $$I can monitor the circumstances around me to anticipate when I may be required to adjust my plan, project, and/or mindset.

I can problem solve for changes in my plan, project and/or mindset.$$),
    ('LP.1.6', 10, 3, $$I can monitor the circumstances around me to anticipate when I may be required to change my plan, project and/or mindset.

I can problem solve for changes in my plan, project and/or mindset and pivot accordingly.$$),
    ('LP.1.6', 12, 4, $$I can consistently monitor the circumstances around me to anticipate when I may be required to change my plan, project and/or mindset.

I can creatively problem solve for changes in my plan, project and/or mindset, pivot accordingly, and reflect on the outcome.$$),

    ('LP.1.7', 6, 1, $$With support, I can consider my values (e.g., connection, independence, community) and goals when I have to make a decision.

With support, I can recognize who might be impacted by my decisions and ask for advice about my options.$$),
    ('LP.1.7', 8, 2, $$I can consider my values (e.g., connection, independence, community) and goals when I have to make a decision.

I can recognize when I need to consult key stakeholders or other people in order to make a decision and weigh the pros and cons of my options.

I can sometimes take responsibility for my decisions.$$),
    ('LP.1.7', 10, 3, $$I can integrate my values (e.g., connection, independence, community) and goals into my decision-making process.

I can recognize when I need to consult key stakeholders or other people in order to make a decision and carefully weigh the pros and cons of my options.

I can take responsibility for my decisions.$$),
    ('LP.1.7', 12, 4, $$I can integrate my values (e.g., connection, independence, community) and goals into my decision-making process and evaluate how well the outcome aligned with my values and goals.

I can consistently recognize when I need to consult key stakeholders or other people in order to make a decision, carefully weigh the pros and cons of my options, and make my decision in a timely manner.

I can take responsibility for my decisions and encourage others to do the same.

I can discuss how my decision-making history reflects my ability to strategically navigate challenges, resulting in favorable outcomes.$$),

    ('LP.1.8', 6, 1, $$I can seek support when I am confused or stuck.

I can sometimes effectively ask for support (e.g., request a meeting, speak with my supervisors, ask a peer).$$),
    ('LP.1.8', 8, 2, $$I can seek support after I have first tried to solve the problem on my own.

I can ask for support (e.g., request a meeting, speak with my supervisors, ask a peer).

I can ask for and implement feedback.$$),
    ('LP.1.8', 10, 3, $$I can identify what I need support with, why I need the support, explain what I have already attempted on my own, and what kind of support I need.

I can ask for support (e.g., request a meeting, speak with my supervisors, ask a peer) in a timely manner.

I can ask for feedback in a timely manner, decide what feedback I will implement, and take the appropriate steps to implement it.$$),
    ('LP.1.8', 12, 4, $$I can consistently articulate what I need support with, why I need the support, what I have already attempted on my own, what kind of support I need, and who can support me.

I can ask for targeted support (e.g., request a meeting, speak with my supervisors, ask a peer) in a timely manner.

I can actively seek out feedback in a timely manner, decide what feedback I will implement, take appropriate steps to implement it, and express gratitude to those who supported me.$$),

    ('LP.1.9', 6, 1, $$I can accept a challenge when I'm confident I'll be successful.

I can explain why my efforts were or weren't successful.$$),
    ('LP.1.9', 8, 2, $$I can accept a challenge, even if I might fail.

I can discuss why my efforts were or weren't successful.$$),
    ('LP.1.9', 10, 3, $$I can seek out challenges and am becoming comfortable with failing in order to grow.

I can reflect on my efforts and explain how my successes and failures can be stepping stones toward improvement in future endeavors.$$),
    ('LP.1.9', 12, 4, $$I can regularly seek out challenges and am mostly comfortable failing in order to grow.

I can regularly reflect on my efforts, explain how my successes and failures can be stepping stones toward improvement in future endeavors, and apply that learning to future opportunities.$$),

    ('LP.1.10', 6, 1, $$I can take initiative to explore topics of interest and seek out resources independently.

With support, I can find, and use available resources, such as teachers, books, and the internet, to help me solve problems or complete tasks.

I can reflect on what I did well and what I could improve after completing a task, activity, or project.$$),
    ('LP.1.10', 8, 2, $$I can consult with people I trust to help me identify both professional skills I need to learn for my career and personal interests I want to pursue, and find resources to support my learning.

I can find and utilize a variety of resources, including community members and online tools, to address challenges and achieve my goals.

I can reflect on my academic and workplace experiences, determine my strengths and weaknesses, and identify specific strategies for improvement based on workplace feedback (e.g., performance reviews).$$),
    ('LP.1.10', 10, 3, $$I can identify gaps in my knowledge and/or new things I want to learn and find appropriate resources, such as books, online materials, or experts, to address them.

I can efficiently identify, evaluate, and leverage diverse resources, including academic research, professional networks, and technology, to overcome complex problems, achieve my goals, and advance my projects.

I can regularly reflect on my academic and workplace experiences, analyze my strengths and weaknesses, and develop actionable plans for continuous improvement based on workplace feedback (e.g., performance reviews).$$),
    ('LP.1.10', 12, 4, $$I can proactively seek out feedback on my areas for growth and take advantage of professional development opportunities, including workshops, courses, and networking, to continuously improve my skills and knowledge.

I can strategically seek out and mobilize a wide range of resources, such as industry contacts, advanced tools, and innovative solutions, to effectively navigate and resolve professional challenges.

I can engage in continuous self-reflection to evaluate my academic and professional practices, seek feedback from peers and supervisors, and implement changes to enhance my performance and growth.$$)
) AS v(code, score, sort_order, summary)
ON c.code = v.code;
