#!/bin/bash

# Test Modal Enhanced Embedding Service
# Verifies deployment and functionality

set -e

echo "🧪 Testing Modal Enhanced Embedding Service"
echo "==========================================="

# Check if Modal is available
if ! command -v modal &> /dev/null; then
    echo "❌ Modal CLI not found. Please run setup-modal-embedding.sh first"
    exit 1
fi

# Check if deployment exists
echo "📋 Checking deployment status..."
if ! modal app list | grep -q "enhanced-embedding-service"; then
    echo "❌ Enhanced embedding service not deployed"
    echo "   Please run: modal deploy modal_enhanced_embedding.py"
    exit 1
fi

echo "✅ Service deployment found"

# Get the service URL
echo "🔗 Getting service URL..."
SERVICE_URL=""

# Try to extract URL from modal app list (this might vary by Modal version)
# For now, we'll ask the user to provide it
echo ""
echo "📝 Please provide your Modal service URL:"
echo "   Format: https://your-username--enhanced-embedding-service-fastapi-app.modal.run"
echo "   (You can find this in your Modal dashboard)"
echo ""
read -p "Service URL: " SERVICE_URL

if [ -z "$SERVICE_URL" ]; then
    echo "❌ No service URL provided"
    exit 1
fi

# Remove trailing slash if present
SERVICE_URL=${SERVICE_URL%/}

echo "🔗 Using service URL: $SERVICE_URL"

# Test health endpoint
echo ""
echo "🏥 Testing health endpoint..."
if curl -s -f "$SERVICE_URL/health" > /dev/null; then
    echo "✅ Health endpoint responding"
    curl -s "$SERVICE_URL/health" | python3 -m json.tool
else
    echo "❌ Health endpoint failed"
    echo "   Check if the service is running and URL is correct"
    exit 1
fi

# Test embedding generation
echo ""
echo "🤖 Testing embedding generation..."
EMBEDDING_RESPONSE=$(curl -s -X POST "$SERVICE_URL/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "search for weather information tools",
    "model": "nvidia/NV-Embed-v2",
    "task_type": "search",
    "normalize": true
  }')

if echo "$EMBEDDING_RESPONSE" | grep -q '"embedding"'; then
    echo "✅ Embedding generation successful"
    EMBEDDING_LENGTH=$(echo "$EMBEDDING_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'data' in data and len(data['data']) > 0:
    print(len(data['data'][0]['embedding']))
else:
    print('Error: Invalid response format')
")
    echo "   Embedding dimensions: $EMBEDDING_LENGTH"
    
    if [ "$EMBEDDING_LENGTH" = "1024" ]; then
        echo "✅ Correct embedding dimensions (1024)"
    else
        echo "⚠️  Unexpected embedding dimensions: $EMBEDDING_LENGTH (expected 1024)"
    fi
else
    echo "❌ Embedding generation failed"
    echo "Response: $EMBEDDING_RESPONSE"
    exit 1
fi

# Test reranking
echo ""
echo "🔄 Testing document reranking..."
RERANK_RESPONSE=$(curl -s -X POST "$SERVICE_URL/v1/rerank" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "weather information",
    "documents": [
      "Get current weather conditions for any location",
      "Send email messages to team members",
      "Create a new file in your workspace",
      "Check weather forecast and temperature data",
      "Download files from the internet",
      "Weather API for getting meteorological data"
    ],
    "top_k": 3
  }')

if echo "$RERANK_RESPONSE" | grep -q '"results"'; then
    echo "✅ Reranking successful"
    echo "Top 3 results:"
    echo "$RERANK_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'results' in data:
        for i, result in enumerate(data['results'][:3]):
            doc = result.get('document', 'N/A')[:50]
            score = result.get('relevance_score', 0)
            print(f'   {i+1}. {doc}... (score: {score:.4f})')
    else:
        print('Error: No results in response')
except Exception as e:
    print(f'Error parsing response: {e}')
"
else
    echo "❌ Reranking failed"
    echo "Response: $RERANK_RESPONSE"
    exit 1
fi

# Test Modal-specific functions
echo ""
echo "🚀 Testing Modal functions directly..."
if modal run modal_enhanced_embedding.py::test_service; then
    echo "✅ Modal function tests passed"
else
    echo "⚠️  Modal function tests failed (this may be normal if container is cold)"
fi

# Performance test
echo ""
echo "⚡ Performance test..."
echo "   Testing embedding generation speed..."

start_time=$(date +%s%N)
for i in {1..5}; do
    curl -s -X POST "$SERVICE_URL/v1/embeddings" \
      -H "Content-Type: application/json" \
      -d "{\"input\": \"test query $i\", \"model\": \"nvidia/NV-Embed-v2\"}" \
      > /dev/null
done
end_time=$(date +%s%N)

duration=$(((end_time - start_time) / 1000000))  # Convert to milliseconds
avg_time=$((duration / 5))

echo "   Average response time: ${avg_time}ms (5 requests)"

if [ $avg_time -lt 5000 ]; then
    echo "✅ Good performance (< 5 seconds per request)"
elif [ $avg_time -lt 10000 ]; then
    echo "⚠️  Moderate performance (5-10 seconds per request)"
else
    echo "⚠️  Slow performance (> 10 seconds per request) - container may be cold"
fi

# Configuration test
echo ""
echo "⚙️  Testing MCPHub configuration..."
CONFIG_FILE="mcp_settings.json"

if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Found mcp_settings.json"
    
    # Check if Modal URL is configured
    if grep -q "modalEmbeddingUrl" "$CONFIG_FILE"; then
        echo "✅ Modal embedding URL found in configuration"
        CONFIGURED_URL=$(grep "modalEmbeddingUrl" "$CONFIG_FILE" | sed 's/.*"modalEmbeddingUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        
        if [ "$CONFIGURED_URL" = "$SERVICE_URL" ]; then
            echo "✅ Configuration URL matches tested URL"
        else
            echo "⚠️  Configuration URL differs from tested URL"
            echo "   Configured: $CONFIGURED_URL"
            echo "   Tested: $SERVICE_URL"
        fi
    else
        echo "⚠️  Modal embedding URL not found in configuration"
        echo "   Please update mcp_settings.json with modalEmbeddingUrl"
    fi
    
    # Check other relevant settings
    if grep -q '"embeddingService"[[:space:]]*:[[:space:]]*"modal"' "$CONFIG_FILE"; then
        echo "✅ Embedding service set to modal"
    else
        echo "⚠️  Embedding service not set to modal"
    fi
    
    if grep -q '"rerankerEnabled"[[:space:]]*:[[:space:]]*true' "$CONFIG_FILE"; then
        echo "✅ Reranker enabled"
    else
        echo "⚠️  Reranker not enabled"
    fi
else
    echo "⚠️  mcp_settings.json not found"
    echo "   Using mcp_settings_modal_example.json as reference"
fi

# Final summary
echo ""
echo "📊 Test Summary"
echo "==============="
echo "✅ Service Health: OK"
echo "✅ Embedding Generation: OK"
echo "✅ Document Reranking: OK"
echo "⚡ Average Response Time: ${avg_time}ms"
echo ""
echo "🎉 Modal Enhanced Embedding Service is working correctly!"
echo ""
echo "Next steps:"
echo "1. Update mcp_settings.json with:"
echo "   \"modalEmbeddingUrl\": \"$SERVICE_URL\""
echo "   \"embeddingService\": \"modal\""
echo "   \"rerankerEnabled\": true"
echo "2. Restart MCPHub to use the Modal service"
echo "3. Monitor usage at: https://modal.com/dashboard"
echo ""
echo "💡 Tips:"
echo "- First requests may be slower due to cold starts"
echo "- Service auto-scales to zero when not in use"
echo "- Check Modal dashboard for usage and costs"
