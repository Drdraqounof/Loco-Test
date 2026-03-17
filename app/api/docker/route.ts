/**
 * API Route: /api/docker
 * Comprehensive Docker information and setup guide for Loco
 * Access at: http://localhost:3000/api/docker
 * Returns: JSON with all Docker concepts, commands, and troubleshooting
 */

import { NextResponse } from 'next/server';


// In plain terms: this route gives Docker setup help and environment information for the app.
export async function GET() {
  const dockerGuide = {
    title: "🐳 Loco Docker Complete Guide",
    subtitle: "All Docker information for containerization and orchestration",
    version: "1.0",
    lastUpdated: "March 2026",

    quickStart: {
      windows: `
# Windows Users - 5 Minutes
copy .env.production.example .env.production
notepad .env.production  # Add your OPENAI_API_KEY
setup-docker.bat
# Visit: http://localhost:3000
      `,
      macLinux: `
# Mac/Linux Users - 5 Minutes
cp .env.production.example .env.production
nano .env.production  # Add your OPENAI_API_KEY
bash setup-docker.sh
# Visit: http://localhost:3000
      `,
      manual: `
# All Platforms - Manual
docker compose up -d --build
sleep 20
docker compose ps  # Both should show "healthy"
      `,
    },

    concepts: {
      "What is Docker?": {
        problem: "Before Docker: Manual installations, version conflicts, 'works on my machine' issues",
        solution: "After Docker: Containerized everything, same environment everywhere, reproducible setup",
        analogy: "Like shipping containers for code - standardized format, works on any platform",
      },
      "What is a Container?": {
        definition: "Lightweight isolated environment containing your app and all dependencies",
        benefits: ["No conflicts with other projects", "Restart without affecting others", "Reproducible on every machine"],
        comparison: "Like a lightweight virtual machine but much faster",
      },
      "What is Docker Compose?": {
        purpose: "Defines multiple containers working together",
        includes: ["App container (Next.js on port 3000)", "Database container (PostgreSQL on port 5432)", "Network connecting them", "Volumes for persistent data"],
        file: "docker-compose.yml",
      },
      "Loco Architecture": {
        services: {
          app: {
            name: "loco_app",
            image: "Custom built from Dockerfile",
            basedOn: "node:18-alpine",
            runs: "Next.js application",
            port: 3000,
            health: "Checked via HTTP request",
          },
          database: {
            name: "loco_db",
            image: "postgres:15",
            runs: "PostgreSQL database",
            port: 5432,
            health: "Checked via pg_isready",
            data: "Persistent via named volume postgres_data",
          },
        },
        communication: {
          inside_docker: "Use service name: postgresql://user:pass@db:5432/db",
          outside_docker: "Use localhost: postgresql://user:pass@localhost:5432/db",
          note: "Inside Docker, containers use service names as hostnames, NOT localhost",
        },
      },
      "Secrets Management": {
        wrong: {
          example: "const apiKey = 'sk-abc123';  // ❌ NEVER DO THIS",
          problems: ["Code gets pushed to git", "Git history is permanent", "Anyone with access sees secrets"],
        },
        right: {
          example: "Environment files: .env.production (never commit)",
          process: [".env.production (keep locally)", ".env.production.example (safe template)", ".gitignore excludes .env*"],
          benefit: "Secrets stay off developers machines",
        },
      },
      "Health Checks": {
        purpose: "Verify service is ready before dependent services start",
        without: "App starts → tries to connect → database initializing → ❌ CRASH",
        with: "App waits → health check passes → ✅ SAFE to start app",
        database: "Uses pg_isready to check PostgreSQL availability",
        app: "Makes HTTP request to verify app is responding",
      },
      "Restart Policies": {
        what: "If container crashes, Docker automatically restarts it",
        configuration: "restart: always",
        benefit: "System is self-healing - no human intervention needed",
        test: "docker kill loco_app → wait 5 seconds → docker compose ps → app is back up",
      },
      "Data Persistence": {
        without: "docker compose down → database data is LOST",
        with_compose_down: "docker compose down (no -v) → data SURVIVES",
        with_compose_down_v: "docker compose down -v (with -v) → everything is DELETED",
        mechanism: "Named volume postgres_data stores database files on host",
      },
    },

    commands: {
      startStop: {
        "Start services": "docker compose up -d",
        "Start and rebuild": "docker compose up -d --build",
        "Stop services (keep data)": "docker compose down",
        "Stop and delete everything": "docker compose down -v",
        "View running services": "docker compose ps",
        "Watch logs": "docker compose logs -f",
      },
      database: {
        "Open database GUI": "docker compose exec app npm run db:studio",
        "Create migration": "docker compose exec app npm run prisma:migrate:dev",
        "Deploy migrations": "docker compose exec app npm run prisma:migrate:deploy",
        "PostgreSQL shell": "docker compose exec db psql -U loco_user -d loco_db",
        "Run SQL command": 'docker compose exec db psql -U loco_user -d loco_db -c "SELECT * FROM \\"User\\";"',
        "Backup database": "docker compose exec db pg_dump -U loco_user loco_db > backup.sql",
        "Restore database": "docker compose exec -T db psql -U loco_user loco_db < backup.sql",
      },
      debugging: {
        "App logs only": "docker compose logs -f app",
        "Database logs only": "docker compose logs -f db",
        "Last 50 lines": "docker compose logs -n 50",
        "Shell access to app": "docker compose exec app bash",
        "Run command in app": "docker compose exec app npm run build",
        "Resource usage": "docker stats",
      },
      advanced: {
        "Rebuild specific service": "docker compose up -d --build app",
        "Scale services": "docker compose up -d --scale app=3",
        "View images": "docker images",
        "Clean Docker": "docker system prune -a",
        "Check disk usage": "docker system df",
      },
    },

    dockerfile: {
      explanation: "Multi-stage Docker build for optimizing image size",
      buildStage: {
        purpose: "Prepares the app",
        steps: ["FROM node:18-alpine", "Install dependencies", "Build Next.js app"],
        result: "200MB intermediate image (not used in final)",
      },
      runtimeStage: {
        purpose: "Runs the app",
        steps: ["FROM node:18-alpine", "Copy built app from builder", "Install only production deps"],
        result: "50MB final image (what actually runs)",
      },
      benefit: "Final image is 4x smaller and faster to load",
    },

    dockerCompose: {
      explanation: "Defines services, networks, volumes, and how they work together",
      dbService: {
        image: "postgres:15",
        environment: ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"],
        volume: "postgres_data:/var/lib/postgresql/data (persistent storage)",
        healthcheck: "pg_isready -U loco_user -d loco_db",
        restart: "always",
      },
      appService: {
        build: "Dockerfile in current directory",
        ports: "3000:3000 (maps host:container)",
        environment: "DATABASE_URL=postgresql://...@db:5432/loco_db (note: db, not localhost)",
        envFile: ".env.production (loads OpenAI API key and secrets)",
        dependsOn: "db:condition: service_healthy (waits for DB to be ready)",
        healthcheck: "wget to verify HTTP response",
        restart: "always",
      },
      volumes: {
        namedVolume: "postgres_data (persists database files)",
        mount: "Service directory: /var/lib/postgresql/data",
        persistence: "Survives docker compose down, deleted with docker compose down -v",
      },
      network: {
        name: "loco_network (bridge driver)",
        purpose: "Allows services to communicate by hostname",
        access: "App reaches database via hostname 'db:5432', not 'localhost:5432'",
      },
    },

    determinismTest: {
      description: "Proves your Docker setup works from scratch every time",
      step1: "docker compose down -v (removes containers, networks, volumes)",
      step2: "docker compose up -d --build (rebuilds images and starts fresh)",
      step3: "sleep 20 (wait for health checks)",
      step4: "docker compose ps (verify both services are healthy)",
      expectedOutput: {
        loco_app: "Up (healthy)",
        loco_db: "Up (healthy)",
      },
      whatItProves: [
        "Setup is deterministic (works every time)",
        "Services start in correct order",
        "Health checks work properly",
        "Data persistence works",
        "New team members can clone and run",
      ],
      success: "If both are healthy → your Docker setup is production-ready! 🎉",
    },

    troubleshooting: {
      "Port 3000 already in use": {
        error: "Error: Address already in use: bind [::]:3000",
        solution: [
          "Windows: netstat -ano | findstr :3000 → taskkill /PID 12345 /F",
          "Mac/Linux: lsof -i :3000 → kill -9 12345",
          "Or use different port by mapping in docker-compose.yml",
        ],
      },
      "Services show healthy but app doesn't respond": {
        cause: "Health checks may need more time",
        solution: ["Wait 30 seconds", "Check logs: docker compose logs", "Full reset: docker compose down -v && docker compose up -d --build"],
      },
      "Database connection refused": {
        error: "Error: connect ECONNREFUSED 127.0.0.1:5432",
        causes: ["Using localhost instead of db service name", "Database not healthy yet", "Wrong connection string"],
        solution: ["Check DATABASE_URL uses 'db' not 'localhost'", "Wait for db to be healthy", "View logs: docker compose logs db"],
      },
      "Docker Desktop won't start": {
        cause: "WSL 2 (Windows Subsystem for Linux) not installed",
        solution: ["Check: wsl --version", "Settings → Apps → Optional features → Install WSL 2", "Restart computer"],
      },
      ".env.production committed to git": {
        problem: "Secrets exposed in version control",
        solution: ["git rm --cached .env.production", "git commit -m 'Remove .env.production'", "Verify: git status shows it untracked"],
      },
      "Out of disk space": {
        solution: ["docker system prune -a (removes dangling images/containers)", "docker system df (check space used)"],
      },
      "Containers keep crashing": {
        debug: "docker compose logs app → check error messages",
        commonCauses: ["Missing OPENAI_API_KEY in .env.production", "Database corruption", "Out of memory"],
        fix: ["Edit .env.production", "docker compose down -v", "docker compose up -d --build"],
      },
    },

    advancedTopics: {
      "Prisma Migrations": {
        createLocal: "docker compose exec app npm run prisma:migrate:dev",
        deployContainer: "docker compose exec app npm run prisma:migrate:deploy",
        viewDatabase: "docker compose exec app npm run db:studio",
        workflow: "Edit prisma/schema.prisma → run migrate:dev → migrations created → deploy:deploy to apply",
      },
      "Multiple App Instances": {
        configuration: "Add to docker-compose.yml: deploy: replicas: 3",
        command: "docker compose up -d --scale app=5",
        result: "Runs 5 copies of app service for load balancing",
      },
      "Docker Stats": {
        command: "docker stats",
        shows: ["CONTAINER name", "Memory usage", "CPU percentage", "Network I/O"],
        useful: "Monitor resource usage of running services",
      },
      "Environment Variables at Runtime": {
        command: "docker compose run app npm run build",
        use: "Override environment or run one-off commands in container",
      },
    },

    production: {
      currentLimitations: [
        "Environment file on disk (should use secret management)",
        "Single database (should use managed database)",
        "Single app instance (should use load balancer and orchestration)",
        "No monitoring (should add Prometheus, CloudWatch, etc.)",
      ],
      improvements: {
        database: "Use AWS RDS, Google Cloud SQL, or Azure Database for PostgreSQL",
        secrets: "Use AWS Secrets Manager, Azure Key Vault, or Hashicorp Vault",
        orchestration: "Use Kubernetes, Docker Swarm, or AWS ECS",
        monitoring: "Add Prometheus + Grafana, CloudWatch, or DataDog",
      },
    },

    fileStructure: {
      "Dockerfile": "Builds app image from Next.js source",
      "docker-compose.yml": "Orchestrates app + database services",
      ".env.production": "Your secrets (API key, passwords) - DON'T COMMIT",
      ".env.production.example": "Safe template showing what variables are needed",
      ".dockerignore": "Optimizes build by excluding unnecessary files",
      "prisma/schema.prisma": "Database schema definition",
      "prisma/migrations/": "Migration files for database changes",
      "package.json": "Dependencies and script commands",
    },

    verification: [
      "Docker Desktop installed and running",
      ".env.production created with OPENAI_API_KEY set",
      "Ran: docker compose up -d --build",
      "Ran: sleep 20 (waited for health checks)",
      "Ran: docker compose ps (both show healthy)",
      "Visited: http://localhost:3000 and saw app",
      "Spoke a question and got response",
      "Ran determinism test: docker compose down -v && docker compose up -d --build",
    ],

    learningPath: {
      week1: ["Run docker compose up -d --build", "Visit http://localhost:3000", "Test app works", "Read Concepts sections"],
      week2: ["Read What Is Docker section", "Read Architecture section", "Read Health Checks section", "Read Restart Policies section"],
      week3: ["Create database migrations", "Experiment with docker compose commands", "Read Production section", "Plan cloud deployment"],
      week4: ["Teach someone else", "Deploy to cloud platform", "Set up monitoring", "Optimize for production"],
    },

    cheatSheet: {
      "Start": "docker compose up -d --build",
      "Check": "docker compose ps",
      "Logs": "docker compose logs -f app",
      "Stop": "docker compose down",
      "Reset": "docker compose down -v && docker compose up -d --build",
      "Database": "docker compose exec app npm run db:studio",
      "Migrate": "docker compose exec app npm run prisma:migrate:dev",
      "Shell": "docker compose exec app bash",
    },
  };

  return NextResponse.json(dockerGuide, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * USAGE:
 * 
 * Fetch the Docker guide in your app:
 * 
 * const response = await fetch('/api/docker');
 * const dockerGuide = await response.json();
 * 
 * Access specific information:
 * dockerGuide.quickStart.windows
 * dockerGuide.commands.startStop
 * dockerGuide.troubleshooting['Port 3000 already in use']
 * 
 * This route serves as:
 * - API documentation
 * - In-app help system
 * - Reference guide
 * - Learning resource
 */
