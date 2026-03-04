# 🐳 Loco Docker Complete Guide
**All-in-one learning resource and reference for containerizing Loco**

---

## 📖 How to Use This Guide

- **New to Docker?** Read from the top, section by section
- **Just want to get started?** Jump to [Quick Start](#-quick-start--5-minutes)
- **Need a command?** Search for it with Ctrl+F
- **Troubleshooting?** Jump to [Troubleshooting](#-troubleshooting)
- **Understand concepts?** Read the concept sections marked with 📚

---

## ⚡ Quick Start (5 Minutes)

### Windows Users

```cmd
# 1. Create environment file
copy .env.production.example .env.production

# 2. Edit and add your OpenAI API key
notepad .env.production

# 3. Run setup
setup-docker.bat

# 4. Visit http://localhost:3000
```

### Mac/Linux Users

```bash
# 1. Create environment file
cp .env.production.example .env.production

# 2. Edit and add your OpenAI API key
nano .env.production

# 3. Run setup
bash setup-docker.sh

# 4. Visit http://localhost:3000
```

### Manual Setup (All Platforms)

```bash
docker compose up -d --build
sleep 20
docker compose ps  # Both should show "healthy"
```

---

## 📚 What Is Docker? (Learning)

### The Problem Docker Solves

**Before Docker:** You installed software on your computer manually
- PostgreSQL installation varies by OS
- Node.js versions conflict between projects
- "Works on my machine" but not yours
- Onboarding new developers took days

**After Docker:** Everything is containerized
- Same environment on every machine
- No conflicts between projects
- Reproducible setup in minutes
- Team members clone → `docker compose up -d` → working

### What's a Container?

A **container** is like a lightweight virtual machine:
- Contains your app + all its dependencies
- Isolated from other containers
- Can restart without affecting others
- Lightweight (unlike full VMs)

**Analogy:** Shipping containers for code
- Before: Ship apps in different formats (chaos!)
- After: Same container format everywhere (standardized!)

### What's Docker Compose?

**Docker Compose** defines multiple containers working together:
- App container (Next.js on port 3000)
- Database container (PostgreSQL on port 5432)
- Network connecting them
- Volumes for persistent data
- All defined in one `docker-compose.yml` file

---

## 🏗️ Loco's Architecture (Learning)

### Services

**Service 1: App (loco_app)**
- Image: Custom built from `Dockerfile`
- Based on: node:18-alpine
- Runs: Next.js application
- Port: 3000 (accessible at localhost:3000)
- Health: Checked via HTTP request
- Data: Stateless (no persistent data)

**Service 2: Database (loco_db)**
- Image: postgres:15 (official PostgreSQL)
- Runs: PostgreSQL database
- Port: 5432 (not directly exposed, internal only)
- Health: Checked via pg_isready command
- Data: Persistent via named volume `postgres_data`

### How They Communicate

```
Visual:
┌─────────────────────────────────────┐
│     Docker Network (loco_network)   │
│                                     │
│  App ←──────────────→ Database     │
│  localhost:3000      hostname: db  │
│                      port: 5432    │
│                                     │
└─────────────────────────────────────┘
```

**Key Concept:** Inside Docker, containers use **service names** as hostnames, not `localhost`!

Example connection string inside Docker:
```
WRONG:  postgresql://user:pass@localhost:5432/db
RIGHT:  postgresql://user:pass@db:5432/db
```

### Startup Sequence

1. **Docker starts both containers**
2. **App waits** - doesn't start accepting requests yet
3. **Database initializes** - PostgreSQL starts up
4. **Health check passes** - Database responds to `pg_isready`
5. **App starts** - Only NOW does app connect to database
6. **API ready** - Visit http://localhost:3000

**Why this order matters:** If app started before database was ready, it would crash trying to connect. That's why we use `depends_on: service_healthy`.

---

## 🔐 Secrets Management (Learning)

### The Problem

Never store sensitive data in code:
```javascript
// ❌ WRONG - Don't do this!
const apiKey = "sk-abc123def456";
const dbPassword = "my-secret-password";
```

Why?
- Code gets pushed to git
- Git history is permanent
- Anyone with access sees secrets
- Secrets can be exploited forever

### The Solution

Use environment files:

```env
# .env.production (NEVER commit this!)
OPENAI_API_KEY=sk-your-actual-key
POSTGRES_PASSWORD=secure-password
```

```bash
# .env.production.example (SAFE to commit)
OPENAI_API_KEY=sk-your-actual-key-here
POSTGRES_PASSWORD=secure-password
```

Then in `.gitignore`:
```
.env*  # Excludes all .env files
```

How Docker uses it:
```yaml
# docker-compose.yml
app:
  env_file: .env.production  # Loads variables into container
```

Result: Secrets stay off developers' machines, only in environment files.

---

## 💪 Health Checks (Learning)

### What They Do

Health checks verify that a service is ready **before** dependent services start.

**Without health checks:**
```
App starts → tries to connect to database → database still initializing → ❌ CRASH
```

**With health checks:**
```
App waits → health check verifies database ready → ✅ SAFE to start app
```

### Database Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U loco_user -d loco_db"]
  interval: 10s      # Check every 10 seconds
  timeout: 5s        # Wait max 5 seconds for answer
  retries: 5         # Fail after 5 misses
  start_period: 10s  # Give 10 seconds before first check
```

**What `pg_isready` does:**
- Connects to PostgreSQL
- Checks if it's accepting connections
- Returns success/failure

### App Health Check

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
  interval: 30s      # Check every 30 seconds
  timeout: 3s        # Wait max 3 seconds
  retries: 3         # Fail after 3 misses
  start_period: 40s  # Give 40 seconds before first check
```

**What it does:**
- Makes HTTP request to app
- If app responds: ✅ healthy
- If app doesn't respond: ❌ unhealthy

### Seeing Health Status

```bash
docker compose ps

# Output:
NAME       IMAGE              STATUS
loco_app   my-app:latest      Up (healthy)      ← Green light
loco_db    postgres:15        Up (healthy)      ← Green light
```

If you see `Up` but not `(healthy)`, wait 20 seconds and check again.

---

## 🔄 Restart Policies (Learning)

### What They Do

```yaml
restart: always  # If container crashes, restart it automatically
```

**Example:**
```
App crashes → Docker detects → Waits 1 second → Restarts app
App now runs again without human intervention
```

This makes the system **self-healing**.

### Testing It

```bash
# Kill the app container
docker kill loco_app

# Wait 5 seconds
sleep 5

# Check status
docker compose ps

# Should show: loco_app is "Up (healthy)" again
```

---

## 💾 Data Persistence (Learning)

### Without Persistence (❌ Bad)

```bash
docker compose down

# Database data is LOST
# New start will have empty database
```

### With Named Volume (✅ Good)

```yaml
volumes:
  postgres_data:  # This is the named volume
    driver: local
```

```bash
docker compose down  # WITHOUT -v flag

# Database data SURVIVES
# New start will have same data
```

### Full Reset (Delete Everything)

```bash
docker compose down -v  # WITH -v flag removes volumes

# Everything deleted
# Fresh start next time
```

---

## 📋 Essential Commands Reference

### Start/Stop

```bash
# Start services in background
docker compose up -d

# Start and rebuild images
docker compose up -d --build

# Stop services (keep data)
docker compose down

# Stop and delete everything
docker compose down -v

# View running services
docker compose ps

# Watch logs
docker compose logs -f

# Stop following logs
# Press Ctrl+C
```

### Database Operations

```bash
# Open Prisma Studio (GUI for database)
docker compose exec app npm run db:studio

# Create new migration
docker compose exec app npm run prisma:migrate:dev

# Deploy existing migrations
docker compose exec app npm run prisma:migrate:deploy

# Access PostgreSQL directly
docker compose exec db psql -U loco_user -d loco_db

# Run SQL in PostgreSQL
docker compose exec db psql -U loco_user -d loco_db -c "SELECT * FROM \"User\";"

# Backup database
docker compose exec db pg_dump -U loco_user loco_db > backup.sql

# Restore database
docker compose exec -T db psql -U loco_user loco_db < backup.sql
```

### Debugging

```bash
# Check app logs only
docker compose logs -f app

# Check database logs only
docker compose logs -f db

# See last 50 log lines
docker compose logs -n 50

# Shell access to app container
docker compose exec app bash

# Run command in app
docker compose exec app npm run build

# Check Docker resource usage
docker stats
```

### Advanced

```bash
# Rebuild specific service
docker compose up -d --build app

# Scale services (multiple instances)
docker compose up -d --scale app=3

# View detailed image info
docker images

# Clean up unused Docker resources
docker system prune -a

# See what's using disk space
docker system df
```

---

## 🔵 The Dockerfile Explained (Learning)

```dockerfile
# Build Stage - Prepares the app
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci                    # Install dependencies
COPY . .
RUN npm run build             # Build the Next.js app

# Runtime Stage - Runs the app
FROM node:18-alpine

WORKDIR /app
RUN apk add --no-cache wget   # Add wget for health checks

COPY package*.json ./
RUN npm ci --only=production  # Install only production deps

# Copy built app from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["npm", "start"]
```

### Why Multi-Stage?

**Stage 1 (Builder):** Creates the app - takes 200MB
**Stage 2 (Runtime):** Runs the app - takes 50MB

**Result:** Final image is smaller and faster to load!

---

## 🟡 The docker-compose.yml Explained (Learning)

```yaml
version: '3.9'

services:
  # Database Service
  db:
    image: postgres:15              # Use official PostgreSQL
    container_name: loco_db
    environment:                    # Configuration
      POSTGRES_USER: loco_user
      POSTGRES_PASSWORD: loco_password
      POSTGRES_DB: loco_db
    ports:
      - "5432:5432"                # Expose port
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Persistent storage
    healthcheck:                    # Verify readiness
      test: ["CMD-SHELL", "pg_isready -U loco_user -d loco_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: always                 # Auto-restart on crash
    networks:
      - loco_network               # Connect to network

  # App Service
  app:
    build:                          # Build from Dockerfile
      context: .
      dockerfile: Dockerfile
    container_name: loco_app
    ports:
      - "3000:3000"                # Map port
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://loco_user:loco_password@db:5432/loco_db
    env_file:
      - .env.production            # Load secrets
    depends_on:
      db:
        condition: service_healthy  # Wait for database
    healthcheck:                    # Verify readiness
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s
    restart: always                 # Auto-restart on crash
    networks:
      - loco_network   # Connect to network

volumes:
  postgres_data:                    # Named volume for persistence
    driver: local

networks:
  loco_network:                     # Shared network for communication
    driver: bridge
```

### Key Concepts

**Image vs Build:**
- `image: postgres:15` - Use existing image from Docker Hub
- `build: .` - Build custom image from Dockerfile

**Ports:**
- `"3000:3000"` = Host:Container
- Access from your machine: http://localhost:3000
- Inside Docker: use service name `app:3000`

**Environment:**
- `DATABASE_URL=postgresql://...@db:5432/...` 
- Note: `db` (service name), not `localhost`

**Depends On:**
- `depends_on: db: condition: service_healthy`
- App waits for database to be healthy before starting

**Volumes:**
- `postgres_data:/var/lib/postgresql/data`
- Data persists across container restarts

**Networks:**
- Allows services to communicate by name
- App reaches database via hostname `db:5432`

---

## 🧪 Determinism Test (Proof Your System Works)

This test proves your Docker setup is solid and reproducible.

```bash
# Step 1: Remove everything
docker compose down -v

# This removes:
# - All containers
# - All networks
# - All volumes (including database)

# Step 2: Rebuild from scratch
docker compose up -d --build

# Step 3: Wait for health checks
sleep 20

# Step 4: Verify both are healthy
docker compose ps

# Expected Output:
# NAME       IMAGE              STATUS
# loco_app   my-app:latest      Up (healthy)
# loco_db    postgres:15        Up (healthy)
```

**What This Proves:**
- ✅ Your setup is deterministic (works every time)
- ✅ Services start in correct order
- ✅ Health checks work
- ✅ Data persists properly
- ✅ New team members can clone and run this

**If it works:** Your Docker setup is production-ready! 🎉

---

## 🐛 Troubleshooting

### Problem: "Port 3000 already in use"

**Error:**
```
Error: Address already in use: bind [::]:3000
```

**Solution 1 - Kill existing process:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID 12345 /F

# Mac/Linux
lsof -i :3000
kill -9 12345
```

**Solution 2 - Use different port:**
```bash
docker compose up -d
# Visit: http://localhost:3001 (if you override port)
```

---

### Problem: "Services show 'Up' but not 'healthy'"

**Solution:**
```bash
# Wait 30 seconds (health check needs time)
sleep 30
docker compose ps

# If still not healthy, check logs
docker compose logs db
docker compose logs app

# If that doesn't work, full reset
docker compose down -v
docker compose up -d --build
sleep 30
docker compose ps
```

---

### Problem: "Database connection refused"

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causes:**
1. Using `localhost` instead of service name `db`
2. Database not healthy yet
3. DATABASE_URL has wrong values

**Solution:**
```bash
# Check what's configured
docker compose logs app | grep -i database

# Should show: DATABASE_URL=postgresql://...@db:5432/...
# If shows @localhost: FIX docker-compose.yml

# Check database is healthy
docker compose ps | grep db
# Should show: Up (healthy)

# If not healthy, check why
docker compose logs db
```

---

### Problem: "Docker Desktop won't start"

**Windows Solution:**
```bash
# Check if WSL 2 is installed
wsl --version

# If not installed, enable it
# Settings → Apps → Optional features
# Search for "Windows Subsystem for Linux"

# Restart computer and try again
```

---

### Problem: ".env.production accidentally committed"

**Solution:**
```bash
# Remove from git tracking (keep file locally)
git rm --cached .env.production

# Commit this change
git commit -m "Remove .env.production from tracking"

# Verify it's not tracked now
git status
```

---

### Problem: "Out of disk space"

**Solution:**
```bash
# Clean up Docker
docker system prune -a

# This removes:
# - Stopped containers
# - Unused images
# - Dangling volumes

# Check space cleared
docker system df
```

---

### Problem: "Containers keep crashing"

**Fix:**
```bash
# 1. Check why they're crashing
docker compose logs app
docker compose logs db

# 2. Common issues:
# - Missing OPENAI_API_KEY in .env.production
# - Database corruption
# - Out of memory

# 3. Full reset
docker compose down -v
# Edit .env.production if needed
docker compose up -d --build
docker compose ps
```

---

## 📚 Advanced Topics

### Using Prisma Migrations

Prisma ORM manages your database schema.

**Create migration locally:**
```bash
docker compose exec app npm run prisma:migrate:dev
# Gives you a prompt:
# ? Name of migration: add_posts_table
# Creates: prisma/migrations/timestamp_add_posts_table
```

**Deploy to container:**
```bash
docker compose exec app npm run prisma:migrate:deploy
```

**Modify schema:**
```bash
# Edit prisma/schema.prisma
# Add new fields, create new models

# Then run:
docker compose exec app npm run prisma:migrate:dev
```

**View database:**
```bash
docker compose exec app npm run db:studio
# Opens: http://localhost:5555
```

---

### Running Multiple Instances

Docker Compose can run multiple app instances:

```yaml
services:
  app:
    deploy:
      replicas: 3
```

Then scale commands:
```bash
docker compose up -d --scale app=5
docker compose ps
# Will show app_1, app_2, app_3, etc.
```

---

### Monitoring with Docker Stats

```bash
docker stats

# Output:
# CONTAINER    MEM USAGE    CPU %    NET I/O
# loco_app     150MiB       2.5%     1.2MB / 50MB
# loco_db      200MiB       1.8%     2.3MB / 100MB
```

Great for checking resource usage.

---

### Environment Variables During Run

Override at runtime:

```bash
docker compose run app npm run build
docker compose run db pg_dump -U loco_user loco_db
```

---

## 🌐 Production Deployment (Reference)

When deploying to cloud:

### Issues with Current Setup
- Environment file on disk (use secret management instead)
- Single database (use managed database)
- Single app instance (use load balancer)

### Production Improvements

```bash
# Use cloud-managed database
# AWS RDS, Google Cloud SQL, Azure Database

# Use cloud secret management
# AWS Secrets Manager, Azure Key Vault

# Use container orchestration
# Kubernetes, Docker Swarm, AWS ECS

# Add monitoring
# Prometheus + Grafana, CloudWatch
```

---

## 📊 File Structure After Setup

```
my-app/
├── Dockerfile                       # Build app image
├── docker-compose.yml              # Orchestration
├── .env.production                 # Your secrets (don't commit!)
├── .env.production.example         # Safe template
├── .dockerignore                   # Build optimization
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # Migration files
├── package.json                    # Dependencies + scripts
├── README.md                       # Updated with Docker docs
└── (all other Loco files)
```

---

## ✅ Verification Checklist

Before considering your setup complete:

- [ ] Docker Desktop installed and running
- [ ] `.env.production` created with OPENAI_API_KEY set
- [ ] Ran: `docker compose up -d --build`
- [ ] Ran: `sleep 20` to wait for health checks
- [ ] Ran: `docker compose ps` and both show "healthy"
- [ ] Visited `http://localhost:3000` and saw the app
- [ ] Spoke a question and got a response
- [ ] Ran determinism test: `docker compose down -v && docker compose up -d --build`

---

## 🎓 Learning Path

### Week 1: Get It Working
1. Run `docker compose up -d --build`
2. Visit http://localhost:3000
3. Test the app works
4. Read "Concepts" sections above

### Week 2: Understand Concepts
1. Read "What Is Docker?" section
2. Read "Loco's Architecture" section
3. Read "Health Checks" section
4. Read "Restart Policies" section

### Week 3: Advanced
1. Create database migrations with Prisma
2. Experiment with `docker compose` commands
3. Read "Production Deployment" section
4. Plan for cloud deployment

### Week 4: Master It
1. Teach someone else how it works
2. Deploy to a cloud platform
3. Set up monitoring and backups
4. Optimize for production

---

## 🎯 Quick Decision Tree

**What should I do?**

```
Unsure what to do?
├─ Want to start? → Read "Quick Start" section
├─ Something broken? → Read "Troubleshooting" section
├─ Need a command? → Use Ctrl+F to search
├─ Want to learn? → Read "What Is Docker?" section
├─ Need to verify? → Run "Determinism Test"
└─ Going to production? → Read "Production Deployment"
```

---

## 📞 Need Help?

### Check These First
1. Search this document with Ctrl+F
2. Run: `docker compose logs` to see errors
3. Try: `docker compose down -v && docker compose up -d --build`

### External Resources
- [Docker Official Docs](https://docs.docker.com/)
- [Docker Compose Spec](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Prisma ORM](https://www.prisma.io/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## 🎉 Congratulations!

You now understand:
✅ What Docker is and why it matters
✅ How to build and run containerized apps
✅ How services communicate
✅ How to manage secrets securely
✅ How health checks work
✅ How restart policies keep systems reliable
✅ How to persist data
✅ How to troubleshoot problems

**You have production-grade containerization!** 🚀

---

## 📋 Cheat Sheet (Copy/Paste)

```bash
# START
docker compose up -d --build

# CHECK
docker compose ps

# LOGS
docker compose logs -f app
docker compose logs -f db

# STOP
docker compose down

# RESET
docker compose down -v
docker compose up -d --build

# DATABASE
docker compose exec app npm run db:studio
docker compose exec db psql -U loco_user -d loco_db

# MIGRATIONS
docker compose exec app npm run prisma:migrate:dev
docker compose exec app npm run prisma:migrate:deploy

# SHELL
docker compose exec app bash
docker compose exec db bash
```

---

**Made for Loco - AI Voice Coding Assistant**
**All-in-One Docker Learning + Reference Guide**

Version: 1.0 | Last Updated: March 2026 | Ready for Production ✅
