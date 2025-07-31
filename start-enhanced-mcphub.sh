#!/bin/bash

# Enhanced MCPHub Startup Script
# Handles enhanced embedding service + MCPHub startup

set -e

PROJECT_DIR="/home/bobby/projects/mcphub"
EMBEDDING_SERVICE_PORT=8000
MCPHUB_PORT=3000

cd "$PROJECT_DIR"

echo "🚀 Enhanced MCPHub Startup"
echo "=========================="
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    echo "⏳ Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        
        printf "   Attempt %d/%d...\r" $attempt $max_attempts
        sleep 2
        ((attempt++))
    done
    
    echo "❌ $service_name failed to start within timeout"
    return 1
}

# Check if embedding service is already running
if check_port $EMBEDDING_SERVICE_PORT; then
    echo "📡 Enhanced embedding service already running on port $EMBEDDING_SERVICE_PORT"
    
    # Test if it's responding correctly
    if curl -s "http://localhost:$EMBEDDING_SERVICE_PORT/health" | grep -q "healthy"; then
        echo "✅ Embedding service health check passed"
    else
        echo "⚠️  Embedding service is running but may not be healthy"
        echo "   Consider restarting it manually"
    fi
else
    echo "🚀 Starting enhanced embedding service..."
    
    # Check if virtual environment exists
    if [ ! -d "venv-embedding" ]; then
        echo "❌ Virtual environment not found. Please run setup first:"
        echo "   ./setup-enhanced-embedding.sh"
        exit 1
    fi
    
    # Start embedding service in background
    source venv-embedding/bin/activate
    nohup python enhanced_embedding_service.py > embedding_service.log 2>&1 &
    EMBEDDING_PID=$!
    echo "📝 Embedding service started with PID: $EMBEDDING_PID"
    echo "📋 Logs available in: embedding_service.log"
    
    # Wait for service to be ready
    if ! wait_for_service "http://localhost:$EMBEDDING_SERVICE_PORT/health" "Enhanced Embedding Service"; then
        echo "❌ Failed to start embedding service"
        kill $EMBEDDING_PID 2>/dev/null || true
        exit 1
    fi
fi

echo ""
echo "🧪 Running embedding service tests..."
node test_enhanced_embedding.mjs

if [ $? -ne 0 ]; then
    echo "⚠️  Embedding service tests failed, but continuing with MCPHub startup"
    echo "   Check embedding_service.log for details"
fi

echo ""
echo "🌐 Starting MCPHub..."

# Check if MCPHub is already running
if check_port $MCPHUB_PORT; then
    echo "📡 MCPHub already running on port $MCPHUB_PORT"
    echo "✅ Enhanced MCPHub setup complete!"
    echo ""
    echo "🌐 Services:"
    echo "   - MCPHub: http://localhost:$MCPHUB_PORT"
    echo "   - Enhanced Embedding Service: http://localhost:$EMBEDDING_SERVICE_PORT"
    echo ""
    echo "📊 Configuration:"
    echo "   - Embedding Model: NVIDIA NV-Embed-v2 (1024 dimensions)"
    echo "   - Reranker Model: BAAI/bge-reranker-v2-m3"
    echo "   - Local Embeddings: Enabled"
    echo "   - Reranking: Enabled"
else
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing Node.js dependencies..."
        npm install
    fi
    
    # Build if needed
    if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
        echo "🔨 Building MCPHub..."
        npm run build
    fi
    
    # Start MCPHub
    echo "🚀 Starting MCPHub server..."
    npm start &
    MCPHUB_PID=$!
    echo "📝 MCPHub started with PID: $MCPHUB_PID"
    
    # Wait for MCPHub to be ready
    if wait_for_service "http://localhost:$MCPHUB_PORT" "MCPHub"; then
        echo ""
        echo "🎉 Enhanced MCPHub startup complete!"
        echo ""
        echo "🌐 Services:"
        echo "   - MCPHub: http://localhost:$MCPHUB_PORT"
        echo "   - Enhanced Embedding Service: http://localhost:$EMBEDDING_SERVICE_PORT"
        echo ""
        echo "📊 Configuration:"
        echo "   - Embedding Model: NVIDIA NV-Embed-v2 (1024 dimensions)"
        echo "   - Reranker Model: BAAI/bge-reranker-v2-m3"
        echo "   - Local Embeddings: Enabled"
        echo "   - Reranking: Enabled"
        echo ""
        echo "💡 Tips:"
        echo "   - Check embedding_service.log for embedding service logs"
        echo "   - Test the enhanced search with: node test_enhanced_embedding.mjs"
        echo "   - Stop services with: pkill -f enhanced_embedding_service"
        echo "   - View real-time logs: tail -f embedding_service.log"
    else
        echo "❌ MCPHub failed to start"
        kill $MCPHUB_PID 2>/dev/null || true
        exit 1
    fi
fi

echo ""
echo "✅ All services are running successfully!"
