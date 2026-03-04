#!/bin/bash

# Loco Docker Setup Script
# Initializes the complete stack with database migrations

set -e  # Exit on any error

echo "🚀 Starting Loco Docker Setup..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   Visit: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi

echo "✅ Docker is installed"
echo ""

# Step 1: Create .env.production if it doesn't exist
if [ ! -f ".env.production" ]; then
    echo "📝 Creating .env.production from template..."
    cp .env.production.example .env.production
    echo "⚠️  IMPORTANT: Edit .env.production and add your OPENAI_API_KEY"
    echo "   Run: $EDITOR .env.production"
    exit 1
else
    echo "✅ .env.production exists"
fi

# Step 2: Verify .env.production has OPENAI_API_KEY
if ! grep -q "OPENAI_API_KEY=sk-" .env.production; then
    echo "❌ OPENAI_API_KEY not configured in .env.production"
    echo "   Edit .env.production and add your API key"
    exit 1
fi

echo "✅ Environment variables configured"
echo ""

# Step 3: Build and start containers
echo "🐳 Building Docker images and starting containers..."
docker compose up -d --build

# Step 4: Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy (max 60 seconds)..."
TIMEOUT=60
while [ $TIMEOUT -gt 0 ]; do
    RESULT=$(docker compose ps --format "json" 2>/dev/null || echo "[]")
    
    if echo "$RESULT" | grep -q "healthy"; then
        echo "✅ Services are healthy!"
        break
    fi
    
    TIMEOUT=$((TIMEOUT - 1))
    echo "   Waiting... ($TIMEOUT seconds remaining)"
    sleep 1
done

if [ $TIMEOUT -eq 0 ]; then
    echo "⚠️  Services did not become healthy within 60 seconds"
    echo "   Run: docker compose logs to see what's wrong"
    exit 1
fi

echo ""

# Step 5: Show status
echo "📊 Service Status:"
docker compose ps

echo ""

# Step 6: Run Prisma migrations
echo "🗄️  Running database migrations..."
docker compose exec -T app npm run prisma:migrate:deploy || true

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Visit: http://localhost:3000"
echo ""
echo "📚 Useful commands:"
echo "   docker compose logs -f          # View logs"
echo "   docker compose down              # Stop services"
echo "   docker compose ps                # Check status"
echo "   docker compose exec app bash     # Shell access to app"
echo ""
