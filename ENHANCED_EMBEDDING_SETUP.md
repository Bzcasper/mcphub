# Enhanced Embedding Setup - Multiple Deployment Options

This setup provides MCPHub with state-of-the-art embedding and reranking capabilities using:

- **NVIDIA NV-Embed-v2 / BGE Models**: Advanced embedding models with 1024 dimensions
- **BAAI/bge-reranker-v2-m3**: High-quality reranker for improved search results

## Deployment Options

### Option 1: Modal Labs (Recommended - No GPU Required) 🚀

**Perfect for users without local GPU hardware**

```bash
# Deploy to Modal Labs cloud GPU infrastructure
./setup-modal-embedding.sh

# Test the deployment
./test-modal-embedding.sh
```

**Benefits:**

- ✅ No local GPU required
- ✅ Auto-scaling (pay only when in use)
- ✅ Production-ready infrastructure
- ✅ ~$0.30-0.60/hour when active
- ✅ Scales to zero when not in use

### Option 2: Local GPU Setup

**For users with CUDA-compatible GPU**

```bash
# Install and configure local embedding service
./setup-enhanced-embedding.sh

# Start local service
source venv-embedding/bin/activate
python enhanced_embedding_service.py
```

## Manual Setup Steps

### 1. Python Environment Setup

```bash
# Create virtual environment
python3 -m venv venv-embedding
source venv-embedding/bin/activate

# Install dependencies (will use compatible versions)
pip install --upgrade pip wheel setuptools

# Install core dependencies
pip install torch transformers sentence-transformers flash-attn

# Install remaining dependencies
pip install -r requirements-embedding.txt
```

### 2. Model Authentication

```bash
# Required for accessing NVIDIA NV-Embed-v2
huggingface-cli login
```

### 3. Start Embedding Service

```bash
source venv-embedding/bin/activate
python enhanced_embedding_service.py
```

The service will run on `http://localhost:8000`

### 4. Update MCPHub Configuration

Your `mcp_settings.json` should already have:

```json
{
  "systemConfig": {
    "smartRouting": {
      "enabled": true,
      "embeddingService": "nvidia",
      "embeddingModel": "nvidia/NV-Embed-v2",
      "embeddingDimensions": 1024,
      "useLocalEmbeddings": true,
      "rerankerEnabled": true,
      "rerankerModel": "BAAI/bge-reranker-v2-m3",
      "rerankerTopK": 50,
      "rerankerFinalK": 10,
      "openaiApiBaseUrl": "http://localhost:8000",
      "openaiApiKey": "nvidia-local-key",
      "openaiApiEmbeddingModel": "nvidia/NV-Embed-v2"
    }
  }
}
```

## Service Architecture

### Enhanced Embedding Service (Port 8000)

- **Model**: NVIDIA NV-Embed-v2
- **Dimensions**: 1024
- **Features**: Instruction-based embeddings, multi-GPU support
- **Endpoints**:
  - `GET /health` - Health check
  - `POST /v1/embeddings` - Generate embeddings
  - `POST /v1/rerank` - Rerank documents
  - `POST /embeddings` - OpenAI-compatible endpoint

### Reranker Integration

- **Model**: BAAI/bge-reranker-v2-m3
- **Process**: Initial retrieval (50 results) → Reranking → Final results (10)
- **Benefits**: Improved search accuracy and relevance

## Instruction Templates

The service uses task-specific instruction prefixes:

- **Retrieval**: "Given a question, retrieve passages that answer the question"
- **Search**: "Given a query, find relevant tools and resources"
- **Similarity**: "Determine semantic similarity between texts"
- **Classification**: "Classify the text into appropriate categories"

## Performance Optimization

### GPU Configuration

- **Multi-GPU**: Automatic detection and usage
- **Memory**: Optimized for NV-Embed-v2 requirements
- **Batching**: Configurable batch sizes for throughput

### Model Loading

- **Caching**: Models loaded once at startup
- **Warmup**: Automatic model warming for consistent performance
- **Error Handling**: Graceful fallbacks for model issues

## Troubleshooting

### Common Issues

1. **"Access to model nvidia/NV-Embed-v2 is restricted"**

   ```bash
   huggingface-cli login
   ```

2. **CUDA/GPU Issues**

   ```bash
   # Check CUDA availability
   python -c "import torch; print(torch.cuda.is_available())"
   ```

3. **Port Already in Use**

   ```bash
   # Check what's using port 8000
   lsof -i :8000

   # Kill existing service
   pkill -f enhanced_embedding_service
   ```

4. **Model Loading Errors**
   - Ensure sufficient GPU memory (8GB+ recommended)
   - Check HuggingFace authentication
   - Verify internet connectivity for initial model download

### Performance Issues

1. **Slow Response Times**
   - Check GPU utilization: `nvidia-smi`
   - Adjust batch sizes in service configuration
   - Ensure adequate GPU memory

2. **Memory Issues**
   - Monitor GPU memory: `nvidia-smi`
   - Reduce batch sizes
   - Consider using CPU fallback for development

### Logs and Monitoring

```bash
# View embedding service logs
tail -f embedding_service.log

# Check service health
curl http://localhost:8000/health

# Monitor GPU usage
watch nvidia-smi

# Test embedding generation
curl -X POST http://localhost:8000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": ["test"], "model": "nvidia/NV-Embed-v2"}'
```

## Migration from Previous Setup

If migrating from a previous embedding setup:

1. **Database Migration**: Vector dimensions changed from 768 to 1024

   ```bash
   node migrate-vector-dimensions.mjs
   ```

2. **Regenerate Embeddings**: All existing tool embeddings will be regenerated automatically

3. **Update Configuration**: Ensure `mcp_settings.json` has correct settings

## Testing

### Comprehensive Test Suite

```bash
node test_enhanced_embedding.mjs
```

### Manual Testing

```bash
# Test embedding generation
curl -X POST http://localhost:8000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer nvidia-local-key" \
  -d '{
    "input": ["search for weather information"],
    "model": "nvidia/NV-Embed-v2",
    "task_type": "search",
    "normalize": true
  }'

# Test reranking
curl -X POST http://localhost:8000/v1/rerank \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer nvidia-local-key" \
  -d '{
    "query": "weather forecast",
    "documents": [
      "Get weather data",
      "Send email",
      "Weather API service"
    ],
    "top_k": 2
  }'
```

## Production Deployment

### Systemd Service

```bash
# Copy service file
sudo cp enhanced-embedding.service /etc/systemd/system/enhanced-embedding@.service

# Enable and start
sudo systemctl enable enhanced-embedding@bobby
sudo systemctl start enhanced-embedding@bobby

# Check status
sudo systemctl status enhanced-embedding@bobby
```

### Docker Deployment

A Dockerfile is available for containerized deployment with proper GPU support.

## Support

For issues and questions:

1. Check logs in `embedding_service.log`
2. Run the test suite for diagnostics
3. Verify GPU and CUDA setup
4. Ensure HuggingFace authentication

## Performance Benchmarks

Expected performance on modern GPU:

- **Embedding Generation**: 50-100 texts/second
- **Reranking**: 200-500 pairs/second
- **Memory Usage**: 6-8GB GPU memory
- **Cold Start**: 30-60 seconds for model loading

## Features

✅ **NVIDIA NV-Embed-v2** (1024 dimensions)  
✅ **BAAI/bge-reranker-v2-m3** reranking  
✅ **Instruction-based embeddings**  
✅ **Multi-GPU support**  
✅ **OpenAI-compatible API**  
✅ **Automatic fallbacks**  
✅ **Comprehensive testing**  
✅ **Production-ready deployment**  
✅ **Real-time monitoring**  
✅ **Performance optimization**
