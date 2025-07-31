# Enhanced Embedding Service with Modal Labs

This guide shows how to deploy the NVIDIA NV-Embed-v2 + BAAI/bge-reranker-v2-m3 embedding service to Modal Labs' cloud GPU infrastructure.

## Overview

The Modal Labs deployment provides:

- **NVIDIA NV-Embed-v2**: State-of-the-art 1024-dimension embeddings with instruction templates
- **BAAI/bge-reranker-v2-m3**: Advanced reranker for improved search results
- **Cloud GPU Infrastructure**: No local GPU required, scales automatically
- **FastAPI Service**: HTTP endpoints compatible with OpenAI format
- **Cost-Effective**: Pay only for compute time used (~$0.30-0.60/hour when active)

## Prerequisites

1. **Modal Labs Account**: Sign up at [modal.com](https://modal.com)
2. **HuggingFace Account**: Required for NVIDIA NV-Embed-v2 access
3. **Python 3.11+**: For local Modal client setup

## Quick Setup

### 1. Install and Configure Modal

```bash
# Run the setup script
./setup-modal-embedding.sh
```

This script will:

- Create a virtual environment
- Install Modal client
- Authenticate with Modal Labs
- Set up HuggingFace authentication
- Deploy the service

### 2. Manual Setup (if script fails)

```bash
# Create virtual environment
python3 -m venv venv-modal
source venv-modal/bin/activate

# Install Modal
pip install modal

# Authenticate with Modal
modal token new

# Set HuggingFace token
export HUGGINGFACE_TOKEN=your_token_here
echo "$HUGGINGFACE_TOKEN" | modal secret create huggingface-token

# Deploy the service
modal deploy modal_enhanced_embedding.py
```

### 3. Configure MCPHub

Update your `mcp_settings.json`:

```json
{
  "systemConfig": {
    "smartRouting": {
      "enabled": true,
      "embeddingService": "modal",
      "embeddingModel": "nvidia/NV-Embed-v2",
      "embeddingDimensions": 1024,
      "useLocalEmbeddings": false,
      "rerankerEnabled": true,
      "rerankerModel": "BAAI/bge-reranker-v2-m3",
      "modalEmbeddingUrl": "https://your-username--enhanced-embedding-service-fastapi-app.modal.run",
      "rerankerTopK": 50,
      "rerankerFinalK": 10
    }
  }
}
```

## Service Endpoints

The Modal service provides several endpoints:

### Health Check

```
GET /health
```

### Generate Embeddings (OpenAI Compatible)

```
POST /v1/embeddings
Content-Type: application/json

{
  "input": "search for weather tools",
  "model": "nvidia/NV-Embed-v2",
  "task_type": "search",
  "normalize": true
}
```

### Rerank Documents

```
POST /v1/rerank
Content-Type: application/json

{
  "query": "weather information",
  "documents": ["Get weather data", "Send emails", "Weather API"],
  "top_k": 5
}
```

## Testing the Service

```bash
# Test the deployed service
modal run modal_enhanced_embedding.py::test_service

# Or test manually
curl -X POST "https://your-url/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{"input": "test query", "model": "nvidia/NV-Embed-v2"}'
```

## Performance and Costs

### GPU Configuration

- **GPU Type**: NVIDIA A10G (24GB VRAM)
- **Memory**: 16GB system RAM
- **Container Lifecycle**: Auto-scaling with 2-minute warmup

### Cost Estimation

- **A10G GPU**: ~$0.30-0.60 per hour when active
- **Idle Cost**: $0 (containers scale to zero)
- **Typical Usage**: ~$5-20/month for moderate usage

### Performance Metrics

- **Embedding Generation**: ~50-100 texts/second
- **Reranking**: ~500-1000 pairs/second
- **Cold Start**: ~30-60 seconds (first request)
- **Warm Requests**: <1 second response time

## Monitoring and Management

### View Deployments

```bash
modal app list
```

### Check Logs

```bash
modal logs enhanced-embedding-service
```

### Update Service

```bash
modal deploy modal_enhanced_embedding.py
```

### Stop Service

```bash
modal app stop enhanced-embedding-service
```

## Environment Variables

Set these in your environment or Modal secrets:

| Variable              | Description           | Required |
| --------------------- | --------------------- | -------- |
| `HUGGINGFACE_TOKEN`   | HuggingFace API token | Yes      |
| `MODAL_EMBEDDING_URL` | Modal service URL     | Auto-set |

## Troubleshooting

### Common Issues

1. **Authentication Failed**

   ```bash
   modal token new  # Re-authenticate
   ```

2. **Model Access Denied**
   - Ensure HuggingFace token has access to NVIDIA models
   - Accept model license agreements on HuggingFace

3. **Cold Start Timeouts**
   - First request may take 30-60 seconds
   - Subsequent requests are fast

4. **High Costs**
   - Check if containers are scaling down properly
   - Monitor usage in Modal dashboard

### Debug Mode

Enable verbose logging:

```bash
export MODAL_DEBUG=1
modal deploy modal_enhanced_embedding.py
```

## Comparison: Local vs Modal

| Feature              | Local Setup            | Modal Labs      |
| -------------------- | ---------------------- | --------------- |
| **GPU Required**     | Yes (CUDA)             | No              |
| **Setup Complexity** | High                   | Low             |
| **Maintenance**      | Manual                 | Automatic       |
| **Scaling**          | Manual                 | Automatic       |
| **Cost**             | Hardware + Electricity | Pay-per-use     |
| **Performance**      | Depends on GPU         | Consistent A10G |

## Migration from Local

If you have a local setup, migration is simple:

1. Deploy to Modal using the setup script
2. Update `modalEmbeddingUrl` in settings
3. Set `useLocalEmbeddings: false`
4. Restart MCPHub

Your existing embeddings database remains unchanged.

## Advanced Configuration

### Custom GPU Types

```python
# In modal_enhanced_embedding.py
GPU_CONFIG = modal.gpu.A100()  # Use A100 for better performance
```

### Custom Memory/CPU

```python
@app.cls(
    memory=32768,  # 32GB RAM
    cpu=8,         # 8 CPU cores
    # ...
)
```

### Multiple Regions

Deploy to multiple regions for global performance:

```bash
modal deploy modal_enhanced_embedding.py --region us-east-1
modal deploy modal_enhanced_embedding.py --region eu-west-1
```

## Support

- **Modal Labs Docs**: [docs.modal.com](https://docs.modal.com)
- **HuggingFace Issues**: [github.com/huggingface/transformers](https://github.com/huggingface/transformers)
- **MCPHub Issues**: [Your repository issues]

## Next Steps

1. **Deploy the service**: Run `./setup-modal-embedding.sh`
2. **Update configuration**: Set `modalEmbeddingUrl` in settings
3. **Test integration**: Verify embeddings and reranking work
4. **Monitor usage**: Check Modal dashboard for costs
5. **Optimize**: Adjust GPU type and scaling based on usage

The Modal Labs deployment provides a production-ready, scalable embedding service without the complexity of local GPU management.
