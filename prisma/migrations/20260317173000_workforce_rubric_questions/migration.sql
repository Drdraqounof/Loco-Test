-- CreateTable
CREATE TABLE "WorkforceArea" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkforceArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkforceArea_code_key" ON "WorkforceArea"("code");

-- CreateIndex
CREATE INDEX "WorkforceArea_code_title_idx" ON "WorkforceArea"("code", "title");

-- AlterTable
ALTER TABLE "WorkforceCompetency"
ADD COLUMN     "areaId" INTEGER,
ADD COLUMN     "itemType" TEXT NOT NULL DEFAULT 'skill',
ADD COLUMN     "parentId" INTEGER,
ADD COLUMN     "question" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "WorkforceCompetency_areaId_itemType_sortOrder_idx" ON "WorkforceCompetency"("areaId", "itemType", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkforceCompetency_parentId_sortOrder_idx" ON "WorkforceCompetency"("parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "WorkforceCompetency" ADD CONSTRAINT "WorkforceCompetency_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "WorkforceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceCompetency" ADD CONSTRAINT "WorkforceCompetency_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkforceCompetency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed top-level areas.
INSERT INTO "WorkforceArea" ("code", "title", "description", "createdAt", "updatedAt") VALUES
('WR', 'Workplace Readiness', 'Skills related to professional readiness, career preparation, and personal success in work settings.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('CCC', 'Critical Inquiry, Creation, and Communication', 'Skills related to research, presentation, technology projects, and inclusive communication.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('TS', 'Technical Skills', 'Skills related to programming, frontend, backend, DevOps, and AI implementation.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed competencies.
INSERT INTO "WorkforceCompetency" ("code", "title", "itemType", "description", "sortOrder", "areaId", "createdAt", "updatedAt")
SELECT v.code, v.title, 'competency', v.description, v.sort_order, a.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkforceArea" a
JOIN (
    VALUES
    ('WR', 'WR.2', 'Create a Standout Resume', 'I can create a polished, well-organized resume that is tailored to the job, highlights relevant achievements, and maintains clear, error-free language.', 2),
    ('WR', 'WR.3', 'Build Your LinkedIn Profile', 'I can create a LinkedIn profile that is professionally polished, strategically optimized to highlight key skills and achievements, and effectively showcases my unique value to potential employers.', 3),
    ('WR', 'WR.4', 'Navigate Interviews', 'I can effectively articulate my experiences and skills in a behavioral interview using the STAR method.', 4),
    ('WR', 'WR.5', 'Set and Achieve Financial Goals', 'I can learn to budget, save, invest, and utilize other key financial concepts.', 5),
    ('CCC', 'CCC.1', 'Develop Technology Solutions', 'I can plan, create, and implement a technology-related project that has a positive impact on an authentic audience.', 1),
    ('CCC', 'CCC.2', 'Integrate DEI Practices', 'I can apply principles of diversity, equity, and inclusion to multiple aspects of my life.', 2),
    ('CCC', 'CCC.3', 'Conduct Research', 'I can frame and advance an inquiry to investigate topics, build knowledge, and analyze and integrate information.', 3),
    ('CCC', 'CCC.4', 'Present to an Audience', 'I can give purposeful and effective presentations in formal settings, making strategic and appropriate decisions about content, language use, and style based on the audience, venue, and topic.', 4),
    ('TS', 'TS.1', 'Core Programming', 'I can apply core programming principles.', 1),
    ('TS', 'TS.2', 'Front-End', 'I can create a front-end to an application.', 2),
    ('TS', 'TS.3', 'Back-End (Web Server Services)', 'I can utilize web server services when creating a back-end.', 3),
    ('TS', 'TS.4', 'Back-End (Databases)', 'I can utilize databases when creating a back-end.', 4),
    ('TS', 'TS.5', 'DevOps', 'I can apply best DevOps practices.', 5),
    ('TS', 'TS.6', 'Artificial Intelligence', 'I can effectively use Artificial Intelligence tools.', 6)
) AS v(area_code, code, title, description, sort_order)
ON a.code = v.area_code;

-- Seed standalone workplace readiness skills that are not nested under a separate competency row.
INSERT INTO "WorkforceCompetency" ("code", "title", "itemType", "question", "description", "sortOrder", "areaId", "createdAt", "updatedAt")
SELECT v.code, v.title, 'skill', v.question, NULL, v.sort_order, a.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkforceArea" a
JOIN (
    VALUES
    ('WR', 'WR.1.1', 'Show up and show out', 'How well can I set myself up for success in class, projects, work, or other situations?', 11),
    ('WR', 'WR.1.2', 'Set and meet goals', 'How well can I set goals and reflect on the results?', 12),
    ('WR', 'WR.1.3', 'Collaborate and work as a team', 'How well can I effectively work with diverse teams to create high-quality products?', 13),
    ('WR', 'WR.1.4', 'Communicate effectively', 'How well can I communicate with others?', 14),
    ('WR', 'WR.1.5', 'Resolve disagreements', 'How well can I apply conflict resolution strategies to professional and social settings?', 15),
    ('WR', 'WR.1.6', 'Demonstrate flexibility and adaptability', 'How well can I monitor circumstances around me in order to know if I need to change my plan, project, or mindset?', 16),
    ('WR', 'WR.1.7', 'Make informed decisions', 'How well can I make decisions and take responsibility for the outcome?', 17),
    ('WR', 'WR.1.8', 'Seek support and feedback', 'How well can I identify what I need support with, find people to support me, and seek feedback?', 18),
    ('WR', 'WR.1.9', 'Demonstrate growth mindset', 'How well can I seek challenges, learn from failure, and reflect on my efforts?', 19),
    ('WR', 'WR.1.10', 'Commit to continuous learning', 'How well can I engage in ongoing personal and professional development?', 20)
) AS v(area_code, code, title, question, sort_order)
ON a.code = v.area_code;

-- Seed nested skill rows under competencies.
INSERT INTO "WorkforceCompetency" (
    "code",
    "title",
    "itemType",
    "question",
    "sortOrder",
    "areaId",
    "parentId",
    "createdAt",
    "updatedAt"
)
SELECT v.code, v.title, 'skill', v.question, v.sort_order, area.id, parent.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    VALUES
    ('WR', 'WR.2', 'WR.2.1', 'Format effectively', 'How well can I format my resume?', 1),
    ('WR', 'WR.2', 'WR.2.2', 'Elevate and optimize content', 'How well can I tailor my resume?', 2),
    ('WR', 'WR.2', 'WR.2.3', 'Showcase projects and technical skills', 'How well can I communicate my projects and skills?', 3),
    ('WR', 'WR.2', 'WR.2.4', 'Proofread and polish', 'How well can I ensure my resume is ready to be sent out to employers?', 4),
    ('WR', 'WR.3', 'WR.3.1', 'Select a profile picture', 'How well can I select an appropriate profile picture?', 1),
    ('WR', 'WR.3', 'WR.3.2', 'Compose a headline', 'How well can I compose a headline?', 2),
    ('WR', 'WR.3', 'WR.3.3', 'Compose a summary', 'How well can I compose a summary?', 3),
    ('WR', 'WR.3', 'WR.3.4', 'Communicate experiences and skills', 'How well can I communicate my key experiences and skills?', 4),
    ('WR', 'WR.3', 'WR.3.5', 'Connections', 'How well can I manage my connections?', 5),
    ('WR', 'WR.3', 'WR.3.6', 'Create engaging posts', 'How well can I create engaging posts?', 6),
    ('WR', 'WR.3', 'WR.3.7', 'Seek relevant endorsements', 'How well can I acquire relevant endorsements?', 7),
    ('WR', 'WR.4', 'WR.4.1', 'Describe the situation or task', 'How well can I describe the situation or task?', 1),
    ('WR', 'WR.4', 'WR.4.2', 'Describe your role', 'How well can I describe my role?', 2),
    ('WR', 'WR.4', 'WR.4.3', 'Describe your actions', 'How well can I describe my actions?', 3),
    ('WR', 'WR.4', 'WR.4.4', 'Describe the results', 'How well can I describe the results?', 4),
    ('WR', 'WR.4', 'WR.4.5', 'Communicate effectively', 'How well can I communicate my ideas during the interview?', 5),
    ('WR', 'WR.4', 'WR.4.6', 'Demonstrate contextual awareness', 'How well can I demonstrate contextual awareness during the interview?', 6),
    ('WR', 'WR.5', 'WR.5.1', 'Manage basic banking tasks', 'How well can I manage basic banking tasks?', 1),
    ('WR', 'WR.5', 'WR.5.2', 'Make informed financial decisions', 'How well can I make informed financial decisions?', 2),
    ('WR', 'WR.5', 'WR.5.3', 'Develop tax knowledge and skills', 'How well can I develop tax knowledge and skills?', 3),
    ('WR', 'WR.5', 'WR.5.4', 'Negotiate compensation', 'How well can I negotiate compensation?', 4),
    ('WR', 'WR.5', 'WR.5.5', 'Understand workplace benefits', 'How well can I understand workplace benefits?', 5),
    ('WR', 'WR.5', 'WR.5.6', 'Manage income streams', 'How well can I manage income streams?', 6),
    ('WR', 'WR.5', 'WR.5.7', 'Maintain healthy credit habits', 'How well can I maintain healthy credit habits?', 7),
    ('WR', 'WR.5', 'WR.5.8', 'Analyze socioeconomic context', 'How well can I analyze my socioeconomic context?', 8),

    ('CCC', 'CCC.1', 'CCC.1.1', 'Understand and identify a problem', 'How well can I create a project plan?', 1),
    ('CCC', 'CCC.1', 'CCC.1.2', 'Identify and plan a solution', 'How well do I follow guidelines to create a high quality product?', 2),
    ('CCC', 'CCC.1', 'CCC.1.3', 'Implement a solution', 'How well do I create a product that solves a real-world problem and impacts an authentic audience?', 3),
    ('CCC', 'CCC.1', 'CCC.1.4', 'Test and improve a solution', 'How well do I use technology to build knowledge and demonstrate my learning?', 4),
    ('CCC', 'CCC.1', 'CCC.1.5', 'Document and communicate a solution', 'How well do I reflect on my work and on my impact?', 5),
    ('CCC', 'CCC.2', 'CCC.2.1', 'Know myself', 'How well can I explain aspects of my identity, confront my biases, and model self-care?', 1),
    ('CCC', 'CCC.2', 'CCC.2.2', 'Understand DEI principles in professional environments', 'How well can I demonstrate understanding of DEI principles in professional environments?', 2),
    ('CCC', 'CCC.2', 'CCC.2.3', 'Demonstrate allyship and advocacy', 'How well can I act as an ally and advocate against discrimination?', 3),
    ('CCC', 'CCC.2', 'CCC.2.4', 'Engage in cross-cultural communication', 'How well can I communicate across difference?', 4),
    ('CCC', 'CCC.3', 'CCC.3.1', 'Construct a research question', 'How well do I construct my primary question?', 1),
    ('CCC', 'CCC.3', 'CCC.3.2', 'Identify and select credible, diverse sources to gather evidence', 'How well can I identify and select credible, diverse sources?', 2),
    ('CCC', 'CCC.3', 'CCC.3.3', 'Use systems to gather and organize information', 'How well do I organize information from my sources?', 3),
    ('CCC', 'CCC.3', 'CCC.3.4', 'Evaluate and synthesize findings', 'How well can I evaluate and synthesize my findings?', 4),
    ('CCC', 'CCC.4', 'CCC.4.1', 'Introduce presentation', 'How well do I introduce my presentation?', 1),
    ('CCC', 'CCC.4', 'CCC.4.2', 'Present findings and supporting evidence', 'How well do I organize, present, and support my ideas?', 2),
    ('CCC', 'CCC.4', 'CCC.4.3', 'Customize the presentation for the specific purpose, context, and audience', 'How effectively do I customize my presentation for my specific purpose, context, and audience?', 3),
    ('CCC', 'CCC.4', 'CCC.4.4', 'Use presentation aids', 'How effectively do I use different media to communicate my ideas?', 4),
    ('CCC', 'CCC.4', 'CCC.4.5', 'Use language and body movement effectively', 'How well do I use my words, voice, and body language to engage my audience?', 5),
    ('CCC', 'CCC.4', 'CCC.4.6', 'Give an effective conclusion', 'How well do I conclude my presentation?', 6),

    ('TS', 'TS.1', 'TS.1.1', 'Create and manipulate variables', 'I can store values as variables and promptly use them to output or change information.', 1),
    ('TS', 'TS.1', 'TS.1.2', 'Understand statements', 'I can create statements to programmatically perform actions and tasks in a logical flow that follows order of operations.', 2),
    ('TS', 'TS.1', 'TS.1.3', 'Utilize conditionals', 'I can use conditionals to check for and parse through information to determine the output of my program.', 3),
    ('TS', 'TS.1', 'TS.1.4', 'Optimize statements', 'I can use loops and user-defined functions to make my program efficient and concise.', 4),
    ('TS', 'TS.2', 'TS.2.1', 'Design a user experience', 'I can design a user experience that meets the needs of a specific audience.', 1),
    ('TS', 'TS.2', 'TS.2.2', 'Create a wireframe', 'I can plan and sketch the layout, functionality, and user flow of a product using wireframes.', 2),
    ('TS', 'TS.2', 'TS.2.3', 'Build a front-end', 'I can create an interactive product, including building reusable components and managing how my product responds to user input.', 3),
    ('TS', 'TS.2', 'TS.2.4', 'Utilize front-end tools', 'I can choose and use the right tools to build and share my product with others.', 4),
    ('TS', 'TS.3', 'TS.3.1', 'Consume application programming interfaces', 'I can understand APIs, make calls, and parse response data.', 1),
    ('TS', 'TS.3', 'TS.3.2', 'Handle web servers', 'I can handle request and response data, file routing, authentication, and middleware.', 2),
    ('TS', 'TS.3', 'TS.3.3', 'Configure servers', 'I can configure ORM or ODM tools for databases and install libraries with package managers.', 3),
    ('TS', 'TS.3', 'TS.3.4', 'Design systems and architecture', 'I can create logical system architecture or data flow diagrams and write CSR and SSR components.', 4),
    ('TS', 'TS.4', 'TS.4.1', 'Create a data structure', 'I can use programming techniques to create and store user information into a structure with proper syntax.', 1),
    ('TS', 'TS.4', 'TS.4.2', 'Navigate data structures', 'I can use queries and other programming techniques to parse through, update, and retrieve specific information.', 2),
    ('TS', 'TS.4', 'TS.4.3', 'Understand data models', 'I can design, create, and utilize complex data models to organize a variety of information using multiple data structures.', 3),
    ('TS', 'TS.5', 'TS.5.1', 'Deploy and automate software', 'I can deploy and automate software using Docker and configure containers for network connectivity.', 1),
    ('TS', 'TS.5', 'TS.5.2', 'Develop in the cloud', 'I can create and configure cloud-connected containers and services.', 2),
    ('TS', 'TS.5', 'TS.5.3', 'Work in a collaborative development environment', 'I can resolve team conflicts, manage schedules and tasks, and use Git collaboratively with best practices.', 3),
    ('TS', 'TS.6', 'TS.6.1', 'Prompt effectively', 'I can craft specific and targeted prompts for machines to follow in order to generate my desired response.', 1),
    ('TS', 'TS.6', 'TS.6.2', 'Use AI responsibly', 'I can consider bias, ethics, security, and data privacy when using and building AI systems.', 2),
    ('TS', 'TS.6', 'TS.6.3', 'Integrate AI tools', 'I can use APIs and open-source AI models to create AI-powered solutions.', 3),
    ('TS', 'TS.6', 'TS.6.4', 'Customize AI models', 'I can implement RAG and private data sets to securely train and optimize AI models according to project guidelines.', 4)
) AS v(area_code, parent_code, code, title, question, sort_order)
JOIN "WorkforceArea" area ON area.code = v.area_code
JOIN "WorkforceCompetency" parent ON parent.code = v.parent_code;
