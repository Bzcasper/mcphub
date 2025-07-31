#!/bin/bash

# Deploy Modal Enhanced Embedding Service with HuggingFace Token
# This script sets up the token and deploys the service

set -e

echo "🚀 Deploying Modal Enhanced Embedding Service"
echo "============================================="

# Activate Modal environment
if [ -d "venv-modal" ]; then
    source venv-modal/bin/activate
fi

# Set HuggingFace token (you should set this as environment variable instead)
# export HUGGINGFACE_TOKEN="your_token_here"
# export HF_TOKEN="your_token_here"

# Check if token is already set
if [ -z "$HUGGINGFACE_TOKEN" ] && [ -z "$HF_TOKEN" ]; then
    echo "⚠️  HuggingFace token not set. Please set HUGGINGFACE_TOKEN or HF_TOKEN environment variable"
    echo "   Example: export HUGGINGFACE_TOKEN=your_token_here"
    exit 1
fi

echo "🔐 Setting up Modal secrets..."

# Create/update Modal secrets with the token
echo "$HUGGINGFACE_TOKEN" | modal secret create huggingface-token --force || true
echo "$HF_TOKEN" | modal secret create HF_TOKEN --force || true
echo "$HUGGINGFACE_TOKEN" | modal secret create HUGGING_FACE_HUB_TOKEN --force || true

echo "✅ Modal secrets updated"

echo "🚀 Deploying enhanced embedding service..."
modal deploy modal_enhanced_embedding.py --force

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🧪 Testing the service..."
modal run modal_enhanced_embedding.py::test_service

echo ""
echo "🌐 Your service is available at:"
echo "https://ai-tool-pool--enhanced-embedding-service-fastapi-app.modal.run"
echo ""
echo "🔧 Update your mcp_settings.json with:"
echo "\"modalEmbeddingUrl\": \"https://ai-tool-pool--enhanced-embedding-service-fastapi-app.modal.run\""
echo "\"embeddingService\": \"modal\""
echo "\"rerankerEnabled\": true"
