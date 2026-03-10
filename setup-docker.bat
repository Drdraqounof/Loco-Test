@echo off
REM Loco Docker Setup Script for Windows
REM Initializes the complete stack and lets the app container run migrations on startup

setlocal enabledelayedexpansion

echo.
echo 🚀 Starting Loco Docker Setup...
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    echo    Visit: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✅ Docker is installed
echo.

REM Step 1: Create .env.production if it doesn't exist
if not exist ".env.production" (
    echo 📝 Creating .env.production from template...
    copy .env.production.example .env.production >nul
    echo.
    echo ⚠️  IMPORTANT: Edit .env.production and add your OPENAI_API_KEY
    echo    Run: notepad .env.production
    echo.
    pause
    exit /b 1
) else (
    echo ✅ .env.production exists
)

REM Step 2: Verify .env.production has OPENAI_API_KEY
findstr /M "OPENAI_API_KEY=sk-" .env.production >nul
if errorlevel 1 (
    echo ❌ OPENAI_API_KEY not configured in .env.production
    echo    Edit .env.production and add your API key
    echo.
    pause
    exit /b 1
)

echo ✅ Environment variables configured
echo.

REM Step 3: Build and start containers
echo 🐳 Building Docker images and starting containers...
docker compose up -d --build

if errorlevel 1 (
    echo ❌ Failed to start Docker Compose
    echo    Run: docker compose logs to see what's wrong
    pause
    exit /b 1
)

REM Step 4: Wait for services to be healthy
echo.
echo ⏳ Waiting for services to be healthy (max 60 seconds)...

setlocal enabledelayedexpansion
set TIMEOUT=60

:wait_loop
if !TIMEOUT! leq 0 (
    echo ⚠️  Services did not become healthy within 60 seconds
    echo    Run: docker compose logs to see what's wrong
    echo.
    pause
    exit /b 1
)

docker compose ps | findstr /I "healthy" >nul
if errorlevel 1 (
    set /a TIMEOUT=!TIMEOUT! - 1
    echo    Waiting... (!TIMEOUT! seconds remaining)
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

echo ✅ Services are healthy!
echo.

REM Step 5: Show status
echo 📊 Service Status:
docker compose ps
echo.

echo.
echo ✅ Setup complete!
echo.
echo 🌐 Visit: http://localhost:3000
echo 🗄️  Prisma migrations were applied automatically during app startup.
echo.
echo 📚 Useful commands:
echo    docker compose logs -f          : View logs
echo    docker compose down              : Stop services
echo    docker compose ps                : Check status
echo    docker compose exec app sh       : Shell access to app
echo.
pause
