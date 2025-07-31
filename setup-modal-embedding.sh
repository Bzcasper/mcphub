#!/bin/bash

# Modal Labs Enhanced Embedding Service Setup Script
# Deploys NVIDIA NV-Embed-v2 + BAAI/bge-reranker-v2-m3 to Modal Labs

set -e

echo "🚀 Modal Labs Enhanced Embedding Service Setup"
echo "=============================================="
echo "Deploying NVIDIA NV-Embed-v2 + BAAI/bge-reranker-v2-m3 to Modal Labs"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Check if pip is available
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed"
    exit 1
fi

# Create virtual environment for Modal if it doesn't exist
if [ ! -d "venv-modal" ]; then
    echo "📦 Creating virtual environment for Modal..."
    python3 -m venv venv-modal
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv-modal/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install Modal
echo "🌐 Installing Modal Labs..."
pip install modal

# Check if Modal token is configured
echo ""
echo "🔐 Modal Labs Authentication Check"
if ! modal token list &>/dev/null; then
    echo "⚠️  Modal CLI not authenticated"
    echo "   Please run: modal token new"
    echo "   This will open a browser to authenticate with Modal Labs"
    echo ""
    read -p "Do you want to authenticate now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        modal token new
    else
        echo "⚠️  Warning: Authentication skipped. Deployment will fail without authentication."
        echo "   Run 'modal token new' to authenticate later."
        exit 1
    fi
else
    echo "✅ Modal CLI already authenticated"
fi

# Check if HuggingFace token is set as environment variable
echo ""
echo "🤗 HuggingFace Token Check"
if [ -z "$HUGGINGFACE_TOKEN" ]; then
    echo "⚠️  HUGGINGFACE_TOKEN environment variable not set"
    echo "   The NVIDIA NV-Embed-v2 model requires authentication"
    echo ""
    echo "   Please:"
    echo "   1. Get your HuggingFace token from: https://huggingface.co/settings/tokens"
    echo "   2. Set it as environment variable:"
    echo "      export HUGGINGFACE_TOKEN=your_token_here"
    echo "   3. Add it to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
    echo ""
    read -p "Do you have a HuggingFace token to set now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your HuggingFace token: " -s token
        echo
        export HUGGINGFACE_TOKEN=$token
        echo "✅ Token set for this session"
        echo "   Remember to add 'export HUGGINGFACE_TOKEN=$token' to your shell profile"
    else
        echo "⚠️  Warning: Token not set. Model access may fail during deployment."
    fi
else
    echo "✅ HUGGINGFACE_TOKEN environment variable is set"
fi

# Set Modal secret for HuggingFace token
if [ ! -z "$HUGGINGFACE_TOKEN" ]; then
    echo "🔐 Setting HuggingFace token as Modal secret..."
    echo "$HUGGINGFACE_TOKEN" | modal secret create huggingface-token
    echo "✅ HuggingFace token set as Modal secret"
fi

# Test Modal connection
echo ""
echo "🧪 Testing Modal connection..."
if modal app list &>/dev/null; then
    echo "✅ Modal connection successful"
else
    echo "❌ Modal connection failed"
    echo "   Please check your authentication and network connection"
    exit 1
fi

# Deploy the service
echo ""
echo "🚀 Deploying Enhanced Embedding Service to Modal Labs..."
echo "   This may take a few minutes as Modal builds the container image..."

if modal deploy modal_enhanced_embedding.py; then
    echo "✅ Deployment successful!"
    
    # Get the deployment URL
    echo ""
    echo "🌐 Getting service URL..."
    modal app list | grep enhanced-embedding-service || true
    
    echo ""
    echo "✅ Enhanced Embedding Service deployed to Modal Labs!"
    echo ""
    echo "Service endpoints:"
    echo "🔗 Web App: https://[your-username]--enhanced-embedding-service-fastapi-app.modal.run"
    echo "📋 Health Check: /health"
    echo "🤖 Embeddings: /v1/embeddings"
    echo "🔄 Reranking: /v1/rerank"
    echo ""
    echo "To test the service:"
    echo "  modal run modal_enhanced_embedding.py::test_service"
    echo ""
    echo "To update your MCPHub configuration:"
    echo "  1. Update mcp_settings.json:"
    echo "     \"openaiApiBaseUrl\": \"https://[your-username]--enhanced-embedding-service-fastapi-app.modal.run\""
    echo "     \"useLocalEmbeddings\": true"
    echo "     \"rerankerEnabled\": true"
    echo "  2. Restart MCPHub to use the new service"
    
else
    echo "❌ Deployment failed"
    echo "   Check the error messages above for details"
    echo "   Common issues:"
    echo "   - Missing HuggingFace authentication"
    echo "   - Network connectivity problems"
    echo "   - Modal account limits"
    exit 1
fi

echo ""
echo "💡 Next steps:"
echo "1. Test the deployed service: modal run modal_enhanced_embedding.py::test_service"
echo "2. Update MCPHub configuration with the Modal service URL"
echo "3. The service runs on Modal's GPU infrastructure - no local GPU needed!"
echo ""
echo "📊 Usage and billing:"
echo "   - Modal charges based on compute time used"
echo "   - A10G GPU costs ~$0.30-0.60 per hour when active"
echo "   - Service automatically scales to zero when not in use"
echo "   - Check your usage at: https://modal.com/dashboard"
echo ""
echo "🎉 Modal Labs deployment completed successfully!"
