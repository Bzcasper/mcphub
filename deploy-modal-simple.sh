#!/bin/bash

# Simple Modal Labs Deployment Script
# Uses existing modal.toml authentication

set -e

echo "🚀 Modal Labs Enhanced Embedding Service - Simple Deploy"
echo "======================================================="

# Check if we're in the right directory
if [ ! -f "modal_enhanced_embedding.py" ]; then
    echo "❌ modal_enhanced_embedding.py not found in current directory"
    echo "   Please run this script from the mcphub root directory"
    exit 1
fi

# Check if Modal is available
if ! command -v modal &> /dev/null; then
    echo "📦 Installing Modal..."
    # Activate venv if it exists
    if [ -d "venv-modal" ]; then
        source venv-modal/bin/activate
    else
        echo "❌ venv-modal not found. Please run:"
        echo "   python3 -m venv venv-modal"
        echo "   source venv-modal/bin/activate"
        echo "   pip install modal"
        exit 1
    fi
fi

# Check if .modal.toml exists
if [ ! -f ".modal.toml" ]; then
    echo "❌ .modal.toml not found"
    echo "   Please run: modal token new"
    exit 1
fi

echo "✅ Found Modal configuration"

# Check if HuggingFace token is available
if [ -z "$HUGGINGFACE_TOKEN" ]; then
    echo "🤗 HuggingFace Token Setup"
    echo "Please get your token from: https://huggingface.co/settings/tokens"
    echo "Make sure you have access to nvidia/NV-Embed-v2 model"
    echo ""
    read -p "Enter your HuggingFace token: " -s HUGGINGFACE_TOKEN
    echo ""
    
    if [ -z "$HUGGINGFACE_TOKEN" ]; then
        echo "❌ No token provided"
        exit 1
    fi
fi

# Create Modal secret for HuggingFace token
echo "🔐 Setting up HuggingFace authentication..."
echo "$HUGGINGFACE_TOKEN" | modal secret create huggingface-token --force 2>/dev/null || {
    echo "⚠️  Note: Secret may already exist or creation failed"
    echo "   You can update it with: modal secret create huggingface-token"
}

# Test Modal connection
echo "🧪 Testing Modal connection..."
if ! modal app list >/dev/null 2>&1; then
    echo "❌ Modal authentication failed"
    echo "   Try running: modal token new"
    exit 1
fi

echo "✅ Modal connection successful"

# Deploy the service
echo ""
echo "🚀 Deploying Enhanced Embedding Service..."
echo "   This will download models and may take 5-10 minutes..."
echo ""

if modal deploy modal_enhanced_embedding.py; then
    echo ""
    echo "✅ Deployment successful!"
    
    # Get the service URL
    echo ""
    echo "🌐 Service Information:"
    echo "   App Name: enhanced-embedding-service"
    echo "   Your URL will be: https://[username]--enhanced-embedding-service-fastapi-app.modal.run"
    echo ""
    echo "📋 To find your exact URL:"
    echo "   1. Visit: https://modal.com/apps"
    echo "   2. Find 'enhanced-embedding-service'"
    echo "   3. Copy the FastAPI app URL"
    echo ""
    echo "🧪 Test the deployment:"
    echo "   modal run modal_enhanced_embedding.py::test_service"
    echo ""
    echo "⚙️  Update your mcp_settings.json:"
    echo "   \"modalEmbeddingUrl\": \"https://[your-url]\""
    echo "   \"embeddingService\": \"modal\""
    echo "   \"rerankerEnabled\": true"
    
else
    echo ""
    echo "❌ Deployment failed"
    echo ""
    echo "Common issues and solutions:"
    echo "1. Authentication: Run 'modal token new' and try again"
    echo "2. HuggingFace access: Ensure your token has access to nvidia/NV-Embed-v2"
    echo "3. Network: Check internet connection"
    echo "4. Quota: Check Modal dashboard for account limits"
    echo ""
    echo "For detailed logs, run:"
    echo "   modal logs enhanced-embedding-service"
    exit 1
fi

echo ""
echo "💡 Next Steps:"
echo "1. Test: ./test-modal-embedding.sh"
echo "2. Update mcp_settings.json with your Modal URL"
echo "3. Restart MCPHub to use the new service"
echo ""
echo "📊 Monitor usage: https://modal.com/dashboard"
echo "🎉 Setup complete!"
