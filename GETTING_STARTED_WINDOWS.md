# 🚀 Getting Started with Loco Docker (Windows)

This is a step-by-step guide for Windows users. If you're on Mac/Linux, see the bottom of this file.

---

## Prerequisites

### 1. Install Docker Desktop for Windows

1. Download from: https://www.docker.com/products/docker-desktop/
2. Run the installer and follow the prompts
3. **Important**: During setup, check these options:
   - ✅ "Install required Windows components for WSL 2"
   - ✅ "Add Docker to PATH"
4. Restart your computer
5. Verify installation:
   ```cmd
   docker --version
   docker compose --version
   ```

### 2. Configure OpenAI API Key

Get your API key from: https://platform.openai.com/account/api-keys

---

## Setup (5 Minutes)

### Step 1: Navigate to Project

Open Command Prompt or PowerShell:

```cmd
cd C:\Projects\loco\my-app
```

### Step 2: Create Configuration File

Copy the example file:

```cmd
copy .env.production.example .env.production
```

### Step 3: Add Your API Key

Open the file in Notepad:

```cmd
notepad .env.production
```

Add your OpenAI API key. The file should look like:

```env
OPENAI_API_KEY=sk-your-actual-key-here
POSTGRES_USER=loco_user
POSTGRES_PASSWORD=loco_password
POSTGRES_DB=loco_db
```

Save and close (Ctrl+S, then close the window).

### Step 4: Run Setup Script

```cmd
setup-docker.bat
```

This script will:
- Check if Docker is installed
- Build the Docker images
- Start both services
- Wait for health checks
- Run database migrations
- Show you the status

**Wait for the message: "✅ Setup complete!"**

### Step 5: Visit Your App

Open your browser and go to:

```
http://localhost:3000
```

**You're done!** 🎉

---

## Verify Everything Works

### Check Services Status

```cmd
docker compose ps
```

Expected output:
```
NAME                IMAGE                     STATUS
loco_app            my-app:latest             Up (healthy)
loco_db             postgres:15               Up (healthy)
```

Both should show **"Up (healthy)"** - if not, see Troubleshooting below.

### Test the App

1. Visit http://localhost:3000
2. Click the microphone icon
3. Speak a coding question: "Build me a React button"
4. Listen for AI response

---

## Daily Commands

### Start Work

```cmd
docker compose up -d
```

Wait a few seconds, then visit http://localhost:3000

### Stop Work

```cmd
docker compose down
```

(Your data is saved! Starting again will restore everything)

### Check Status

```cmd
docker compose ps
```

### View Logs

```cmd
docker compose logs -f
```

Press Ctrl+C to stop watching logs.

### Full Reset (Delete database)

```cmd
docker compose down -v
docker compose up -d --build
```

This removes all data and rebuilds from scratch.

---

## Common Tasks

### Access Database GUI

```cmd
docker compose exec app npm run db:studio
```

Opens at: http://localhost:5555

### Run Database Migrations

```cmd
docker compose exec app npm run prisma:migrate:dev
```

Then give the migration a name when prompted.

### Execute SQL Commands

```cmd
docker compose exec db psql -U loco_user -d loco_db
```

Then type SQL, e.g.:
```sql
SELECT * FROM "User";
\q   (to exit)
```

### Rebuild Everything

```cmd
docker compose up -d --build
```

### Get a Shell Inside App

```cmd
docker compose exec app bash
```

Then you can run npm commands directly:
```bash
npm run build
npm run lint
exit
```

---

## Troubleshooting

### Docker Desktop Won't Start

**Problem**: Docker Desktop crashes or won't open

**Solution**:
1. Check if WSL 2 is installed: `wsl --version`
2. Update Windows: Settings → Update & Security
3. Restart computer
4. Reinstall Docker Desktop

### Port 3000 Already in Use

**Problem**:
```
Error: Address already in use: bind [::]:3000
```

**Solution**:
```cmd
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with the number shown)
taskkill /PID 12345 /F

# Then restart
docker compose up -d
```

Or use a different port:
```cmd
docker compose up -d
```

Then visit: http://localhost:3001

### Services Won't Become Healthy

**Problem**:
```cmd
docker compose ps
# Shows "Up" but not "healthy"
```

**Solution**:
```cmd
# Check logs
docker compose logs

# Wait longer (up to 60 seconds)
# If still not healthy:

docker compose down
docker compose up -d --build

# Wait 30 seconds
# Check again:
docker compose ps
```

### Database Connection Error

**Problem**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**:
```cmd
# Check database is running
docker compose ps db

# If not running, start it:
docker compose up -d

# If showing unhealthy:
docker compose logs db
```

### Out of Disk Space

**Problem**:
```
Error: no space left on device
```

**Solution**:
```cmd
# Clean up Docker
docker system prune -a

# This removes:
# - Stopped containers
# - Unused images
# - Unused volumes
```

### .env.production Accidentally Committed

**Problem**:
```cmd
git status
# Shows .env.production as modified
```

**Solution**:
```cmd
# Remove from git tracking (keep file locally)
git rm --cached .env.production

# Commit the change
git commit -m "Remove .env.production from tracking"

# Verify:
git status
# .env.production should NOT appear now
```

### Permission Denied on `.env.production`

**Problem**: Can't edit .env.production

**Solution**:
```cmd
# Use PowerShell instead of Command Prompt
# Or use Developer Command Prompt (right-click → Run as Administrator)
```

### Containers Keep Crashing

**Problem**:
```cmd
docker compose ps
# Shows "Exited (1)" or "Restarting"
```

**Solution**:
```cmd
# Check logs
docker compose logs app
docker compose logs db

# Common causes:
# 1. Missing OPENAI_API_KEY in .env.production
# 2. Database not initialized
# 3. Out of memory

# Fix:
docker compose down -v
# Edit .env.production
docker compose up -d --build
sleep 20
docker compose ps
```

---

## Understanding the Files

### docker-compose.yml
Defines the two services (app + database) and how they communicate.

### Dockerfile
Builds the Next.js app into a Docker image.

### .env.production
Contains your secrets (API keys, passwords). **Never commit this!**

### .env.production.example
Safe template that shows what variables are needed. Safe to commit.

### DOCKER_QUICK_REFERENCE.md
Cheat sheet of useful commands.

### DOCKER_SETUP.md
Deep dive into how everything works (800+ lines).

### prisma/schema.prisma
Database schema definition.

---

## Next Steps

1. ✅ Run `setup-docker.bat` 
2. ✅ Visit http://localhost:3000
3. ✅ Test by speaking a question
4. ✅ Check status: `docker compose ps`
5. ✅ Read DOCKER_QUICK_REFERENCE.md for more commands
6. ✅ Explore the app and customize as needed

---

## Testing Determinism (Advanced)

Prove your system works from scratch:

```cmd
# Step 1: Complete reset
docker compose down -v

# Step 2: Rebuild
docker compose up -d --build

# Step 3: Wait
timeout /t 20

# Step 4: Check (both should be healthy)
docker compose ps
```

If both show "healthy", your setup is **deterministic** and production-ready! 🎉

---

## For Mac/Linux Users

### Mac Setup

```bash
# Copy configuration
cp .env.production.example .env.production

# Edit with your favorite editor
nano .env.production

# Run automated setup
bash setup-docker.sh

# Or manual setup:
docker compose up -d --build
sleep 20
docker compose exec app npm run prisma:migrate:deploy
```

### Linux Setup

Same as Mac, but you might need `sudo`:

```bash
# Either prefix commands with sudo
sudo docker compose up -d --build

# Or add user to docker group (one time):
sudo usermod -aG docker $USER
newgrp docker

# Then use docker without sudo
docker compose up -d --build
```

---

## Questions?

1. **Setup issues?** Read the Troubleshooting section above
2. **Docker basics?** Read [DOCKER_QUICK_REFERENCE.md](./DOCKER_QUICK_REFERENCE.md)
3. **Deep dive?** Read [DOCKER_SETUP.md](./DOCKER_SETUP.md)
4. **Verification?** Use [DOCKER_CHECKLIST.md](./DOCKER_CHECKLIST.md)
5. **Docker docs?** Visit https://docs.docker.com

---

## Summary

You now have:
- ✅ Next.js app running in Docker
- ✅ PostgreSQL database with persistent storage
- ✅ Both services healthchecked and auto-restarting
- ✅ Professional DevOps setup matching industry standards
- ✅ Documentation for your team

**Enjoy your containerized app!** 🐳

---

**Made for BrightPath's AI Voice Tutoring Platform**

Questions? Check the DOCKER_* files in your project!
