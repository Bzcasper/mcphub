#!/bin/bash

# Restart Enhanced Embedding Service
echo "🔄 Restarting Enhanced Embedding Service..."

# Kill existing service
echo "🛑 Stopping existing service..."
pkill -f enhanced_embedding_service || echo "No existing service found"

# Wait a moment
sleep 2

# Start new service
echo "🚀 Starting enhanced embedding service..."
cd /home/bobby/projects/mcphub
source venv-embedding/bin/activate
nohup python enhanced_embedding_service.py > embedding_service.log 2>&1 &

echo "✅ Enhanced embedding service restarted"
echo "📋 Logs: tail -f embedding_service.log"
echo "🧪 Test: node test_enhanced_embedding.mjs"
