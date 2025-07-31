"""
Modal Labs Enhanced Embedding Service
NVIDIA NV-Embed-v2 + BAAI/bge-reranker-v2-m3 on Modal's GPU infrastructure
"""

import os
import json
from typing import List, Dict, Any, Optional, Union
import modal

# Modal app configuration
app = modal.App("enhanced-embedding-service")

# Create Modal Volume for model caching
volume = modal.Volume.from_name("embedding-model-cache", create_if_missing=True)
MODEL_CACHE_PATH = "/vol/models"

# Create Modal image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install([
        "torch==2.1.0",
        "transformers==4.36.0",
        "sentence-transformers==2.2.2", 
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "pydantic==2.5.0",
        "numpy==1.24.3",
        "scipy==1.11.4",
        "requests==2.31.0",
        "tqdm==4.66.1",
        "huggingface-hub==0.19.4",
        "accelerate==0.25.0",
        "hf_transfer",  # Add hf_transfer for faster downloads
    ])
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "HF_HOME": f"{MODEL_CACHE_PATH}/huggingface",
        "HF_HUB_CACHE": f"{MODEL_CACHE_PATH}/huggingface/hub",
        "TRANSFORMERS_CACHE": f"{MODEL_CACHE_PATH}/huggingface/transformers"
    })
)

# GPU configuration - using A10G for good performance/cost balance
GPU_CONFIG = "A10G"

# Model constants - Using better models with fallback to public ones
EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5"  # Better quality model (1024 dimensions)
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"  # High-quality reranker
EMBEDDING_DIMENSIONS = 1024  # BGE-large models use 1024 dimensions
MAX_SEQ_LENGTH = 512  # Standard length for BGE models
BATCH_SIZE = 32

# Fallback models (public, no auth required)
FALLBACK_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"  # 384 dimensions
FALLBACK_RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
FALLBACK_DIMENSIONS = 384

# Instruction templates for different task types
TASK_INSTRUCTIONS = {
    "retrieval": "Given a question, retrieve passages that answer the question",
    "search": "Given a query, find relevant tools and resources",
    "similarity": "Determine semantic similarity between texts",
    "classification": "Classify the text into appropriate categories",
    "clustering": "Group similar texts together",
    "reranking": "Rank passages by relevance to the query"
}

# Model caching functions
@app.function(
    image=image,
    volumes={MODEL_CACHE_PATH: volume},
    timeout=900,  # 15 minutes for downloading
    memory=4096
)
def download_and_cache_models():
    """Download and cache models to Modal volume"""
    import os
    from huggingface_hub import snapshot_download, login
    
    # Setup authentication
    hf_token = os.environ.get("HF_TOKEN")
    if hf_token:
        login(token=hf_token)
        print("✅ Logged into HuggingFace")
    
    # Download embedding model
    embedding_cache_dir = f"{MODEL_CACHE_PATH}/embedding/{EMBEDDING_MODEL.replace('/', '--')}"
    if not os.path.exists(embedding_cache_dir):
        print(f"📥 Downloading embedding model: {EMBEDDING_MODEL}")
        snapshot_download(
            repo_id=EMBEDDING_MODEL,
            local_dir=embedding_cache_dir,
            token=hf_token
        )
        print(f"✅ Cached embedding model to {embedding_cache_dir}")
    else:
        print(f"✅ Embedding model already cached: {embedding_cache_dir}")
    
    # Download reranker model
    reranker_cache_dir = f"{MODEL_CACHE_PATH}/reranker/{RERANKER_MODEL.replace('/', '--')}"
    if not os.path.exists(reranker_cache_dir):
        print(f"📥 Downloading reranker model: {RERANKER_MODEL}")
        snapshot_download(
            repo_id=RERANKER_MODEL,
            local_dir=reranker_cache_dir,
            token=hf_token
        )
        print(f"✅ Cached reranker model to {reranker_cache_dir}")
    else:
        print(f"✅ Reranker model already cached: {reranker_cache_dir}")
    
    # Download fallback models
    fallback_embedding_dir = f"{MODEL_CACHE_PATH}/embedding/{FALLBACK_EMBEDDING_MODEL.replace('/', '--')}"
    if not os.path.exists(fallback_embedding_dir):
        print(f"📥 Downloading fallback embedding model: {FALLBACK_EMBEDDING_MODEL}")
        snapshot_download(
            repo_id=FALLBACK_EMBEDDING_MODEL,
            local_dir=fallback_embedding_dir
        )
        print(f"✅ Cached fallback embedding model to {fallback_embedding_dir}")
    else:
        print(f"✅ Fallback embedding model already cached: {fallback_embedding_dir}")
    
    fallback_reranker_dir = f"{MODEL_CACHE_PATH}/reranker/{FALLBACK_RERANKER_MODEL.replace('/', '--')}"
    if not os.path.exists(fallback_reranker_dir):
        print(f"📥 Downloading fallback reranker model: {FALLBACK_RERANKER_MODEL}")
        snapshot_download(
            repo_id=FALLBACK_RERANKER_MODEL,
            local_dir=fallback_reranker_dir
        )
        print(f"✅ Cached fallback reranker model to {fallback_reranker_dir}")
    else:
        print(f"✅ Fallback reranker model already cached: {fallback_reranker_dir}")
    
    # Commit changes to volume
    volume.commit()
    print("💾 All models cached and committed to volume")
    
    return {
        "embedding_model_path": embedding_cache_dir,
        "reranker_model_path": reranker_cache_dir,
        "fallback_embedding_path": fallback_embedding_dir,
        "fallback_reranker_path": fallback_reranker_dir
    }

@app.cls(
    image=image,
    gpu=GPU_CONFIG,
    memory=16384,  # 16GB memory
    timeout=300,   # 5 minute timeout per request
    scaledown_window=300,  # Shut down after 5 minutes of inactivity
    secrets=[modal.Secret.from_name("HF_TOKEN")],
    volumes={MODEL_CACHE_PATH: volume},  # Add volume for model caching
)
@modal.concurrent(max_inputs=10)  # Allow 10 concurrent requests
class EnhancedEmbeddingService:
    """Modal Labs Enhanced Embedding Service Class"""
    
    embedding_model: str = modal.parameter(default=EMBEDDING_MODEL)
    reranker_model: str = modal.parameter(default=RERANKER_MODEL)
    
    def __post_init__(self):
        """Initialize model storage"""
        self._embedding_model = None
        self._reranker_model = None
    
    @modal.enter()
    def load_models(self):
        """Load models when container starts - from cached volume if available"""
        import os
        from huggingface_hub import login
        
        # Get HuggingFace token from Modal secret (directly from environment)
        hf_token = os.environ.get("HF_TOKEN")
        
        if hf_token:
            try:
                login(token=hf_token)
                print("✅ Successfully logged into HuggingFace Hub with provided token")
            except Exception as e:
                print(f"⚠️  HuggingFace login failed: {e}")
        else:
            print("⚠️  No HF_TOKEN found in environment")
        
        print("🚀 Loading BGE large embedding model from cache...")
        from sentence_transformers import SentenceTransformer, CrossEncoder
        
        # Define cached model paths
        embedding_cache_dir = f"{MODEL_CACHE_PATH}/embedding/{self.embedding_model.replace('/', '--')}"
        reranker_cache_dir = f"{MODEL_CACHE_PATH}/reranker/{self.reranker_model.replace('/', '--')}"
        fallback_embedding_dir = f"{MODEL_CACHE_PATH}/embedding/{FALLBACK_EMBEDDING_MODEL.replace('/', '--')}"
        fallback_reranker_dir = f"{MODEL_CACHE_PATH}/reranker/{FALLBACK_RERANKER_MODEL.replace('/', '--')}"
        
        try:
            # Try to load from cache first, fallback to download if not available
            if os.path.exists(embedding_cache_dir):
                print(f"   Loading cached embedding model from: {embedding_cache_dir}")
                self._embedding_model = SentenceTransformer(embedding_cache_dir, device="cuda")
            else:
                print(f"   Cache miss, loading embedding model directly: {self.embedding_model}")
                self._embedding_model = SentenceTransformer(
                    self.embedding_model,
                    device="cuda",
                    use_auth_token=hf_token if hf_token else None
                )
            
            # Set model configuration
            self._embedding_model.max_seq_length = MAX_SEQ_LENGTH
            print(f"✅ Embedding model loaded: {self.embedding_model}")
            
            # Load reranker model from cache or download
            if os.path.exists(reranker_cache_dir):
                print(f"   Loading cached reranker model from: {reranker_cache_dir}")
                self._reranker_model = CrossEncoder(reranker_cache_dir, device="cuda")
            else:
                print(f"   Cache miss, loading reranker model directly: {self.reranker_model}")
                self._reranker_model = CrossEncoder(self.reranker_model, device="cuda")
            
            print(f"✅ Reranker model loaded: {self.reranker_model}")
            
        except Exception as e:
            print(f"❌ Error loading primary models: {e}")
            print("🔄 Trying fallback models...")
            
            # Try fallback models from cache or download
            try:
                if os.path.exists(fallback_embedding_dir):
                    print(f"   Loading cached fallback embedding model from: {fallback_embedding_dir}")
                    self._embedding_model = SentenceTransformer(fallback_embedding_dir, device="cuda")
                else:
                    print(f"   Loading fallback embedding model directly: {FALLBACK_EMBEDDING_MODEL}")
                    self._embedding_model = SentenceTransformer(FALLBACK_EMBEDDING_MODEL, device="cuda")
                
                if os.path.exists(fallback_reranker_dir):
                    print(f"   Loading cached fallback reranker model from: {fallback_reranker_dir}")
                    self._reranker_model = CrossEncoder(fallback_reranker_dir, device="cuda")
                else:
                    print(f"   Loading fallback reranker model directly: {FALLBACK_RERANKER_MODEL}")
                    self._reranker_model = CrossEncoder(FALLBACK_RERANKER_MODEL, device="cuda")
                
                print("✅ Fallback models loaded successfully")
                print(f"   Note: Using fallback dimensions ({FALLBACK_DIMENSIONS})")
                
                # Update the global embedding dimensions for this instance
                global EMBEDDING_DIMENSIONS
                EMBEDDING_DIMENSIONS = FALLBACK_DIMENSIONS
                
            except Exception as fallback_error:
                print(f"❌ Fallback model loading also failed: {fallback_error}")
                raise
    
    def _add_eos_token(self, texts: List[str]) -> List[str]:
        """Add EOS token to texts - simplified for BGE models"""
        # BGE models don't typically need EOS tokens, return as-is
        return texts
    
    def _get_instruction_prefix(self, task_type: str) -> str:
        """Get instruction prefix for the given task type"""
        # BGE models use simple prefixes
        if task_type == "search":
            return "Represent this sentence for searching relevant passages: "
        elif task_type == "retrieval":
            return "Represent this sentence for retrieving relevant documents: "
        else:
            return ""
    
    @modal.method()
    def generate_embeddings(
        self,
        texts: List[str],
        task_type: str = "search",
        normalize: bool = True
    ) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        if not texts:
            return []
        
        try:
            # For BGE models, we can add instruction prefixes for queries
            processed_texts = []
            for text in texts:
                if task_type in ["search", "retrieval"]:
                    prefix = self._get_instruction_prefix(task_type)
                    processed_texts.append(prefix + text)
                else:
                    processed_texts.append(text)
            
            # Generate embeddings
            embeddings = self._embedding_model.encode(
                processed_texts,
                batch_size=BATCH_SIZE,
                normalize_embeddings=normalize,
                convert_to_numpy=True
            )
            
            return embeddings.tolist()
            
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            raise
    
    @modal.method()
    def rerank_documents(
        self,
        query: str,
        documents: List[str],
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """Rerank documents using the reranker model"""
        if not documents:
            return []
        
        try:
            # Prepare query-document pairs for reranking
            pairs = [[query, doc] for doc in documents]
            
            # Get relevance scores
            scores = self._reranker_model.predict(pairs)
            
            # Create results with scores and indices
            results = []
            for i, score in enumerate(scores):
                results.append({
                    "index": i,
                    "document": documents[i],
                    "relevance_score": float(score)
                })
            
            # Sort by relevance score (descending)
            results.sort(key=lambda x: x["relevance_score"], reverse=True)
            
            # Return top-k results
            return results[:top_k]
            
        except Exception as e:
            print(f"Error reranking documents: {e}")
            raise
    
    @modal.method()
    def health_check(self) -> Dict[str, Any]:
        """Health check endpoint"""
        import torch
        
        return {
            "status": "healthy",
            "service": "Enhanced Embedding Service (Modal Labs)",
            "embedding_model": EMBEDDING_MODEL,
            "reranker_model": RERANKER_MODEL,
            "embedding_dimensions": EMBEDDING_DIMENSIONS,
            "device": "cuda",
            "gpu_available": torch.cuda.is_available(),
            "gpu_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
            "memory_usage": torch.cuda.memory_allocated() if torch.cuda.is_available() else None
        }

# Wrapper functions for easier API access
@app.function(image=image, memory=1024)
@modal.concurrent(max_inputs=5)
def generate_embeddings_api(
    texts: Union[str, List[str]],
    task_type: str = "search",
    normalize: bool = True
) -> Dict[str, Any]:
    """API wrapper for embedding generation"""
    service = EnhancedEmbeddingService()
    
    # Convert single string to list
    if isinstance(texts, str):
        texts = [texts]
    
    embeddings = service.generate_embeddings.remote(texts, task_type, normalize)
    
    # Format response similar to OpenAI API
    data = []
    for i, embedding in enumerate(embeddings):
        data.append({
            "object": "embedding",
            "index": i,
            "embedding": embedding
        })
    
    return {
        "object": "list",
        "data": data,
        "model": EMBEDDING_MODEL,
        "usage": {
            "prompt_tokens": sum(len(text.split()) for text in texts),
            "total_tokens": sum(len(text.split()) for text in texts)
        }
    }

@app.function(image=image, memory=1024)
@modal.concurrent(max_inputs=5)
def rerank_documents_api(
    query: str,
    documents: List[str],
    top_k: int = 10
) -> Dict[str, Any]:
    """API wrapper for document reranking"""
    service = EnhancedEmbeddingService()
    results = service.rerank_documents.remote(query, documents, top_k)
    
    return {
        "results": results
    }

@app.function(image=image, memory=1024)
@modal.concurrent(max_inputs=5)
def health_check_api() -> Dict[str, Any]:
    """API wrapper for health check"""
    service = EnhancedEmbeddingService()
    return service.health_check.remote()

# FastAPI web service for HTTP endpoints
@app.function(
    image=image.pip_install("fastapi", "uvicorn[standard]"),
    memory=1024,
    scaledown_window=300,  # Shut down after 5 minutes of inactivity
    timeout=3600,  # 1 hour max runtime
)
@modal.concurrent(max_inputs=10)  # Reduced concurrency to save costs
@modal.asgi_app()
def fastapi_app():
    """FastAPI application for HTTP endpoints"""
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel, Field
    
    # Request/Response models
    class EmbeddingRequest(BaseModel):
        input: Union[str, List[str]] = Field(..., description="Text or list of texts to embed")
        model: str = Field(default=EMBEDDING_MODEL, description="Embedding model to use")
        task_type: str = Field(default="search", description="Type of task")
        normalize: bool = Field(default=True, description="Whether to normalize embeddings")
    
    class RerankRequest(BaseModel):
        query: str = Field(..., description="Query text")
        documents: List[str] = Field(..., description="List of documents to rerank")
        top_k: int = Field(default=10, description="Number of top documents to return")
    
    # Create FastAPI app
    web_app = FastAPI(
        title="Enhanced Embedding Service (Modal Labs)",
        description="NVIDIA NV-Embed-v2 + BAAI/bge-reranker-v2-m3 on Modal's GPU infrastructure",
        version="1.0.0"
    )
    
    @web_app.get("/")
    async def root():
        """Root endpoint"""
        return {
            "service": "Enhanced Embedding Service (Modal Labs)",
            "embedding_model": EMBEDDING_MODEL,
            "reranker_model": RERANKER_MODEL,
            "embedding_dimensions": EMBEDDING_DIMENSIONS,
            "endpoints": ["/health", "/v1/embeddings", "/v1/rerank", "/embeddings"]
        }
    
    @web_app.get("/health")
    async def health():
        """Health check endpoint"""
        try:
            result = health_check_api.remote()
            return result
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")
    
    @web_app.post("/v1/embeddings")
    async def create_embeddings(request: EmbeddingRequest):
        """Generate embeddings endpoint"""
        try:
            result = generate_embeddings_api.remote(
                request.input,
                request.task_type,
                request.normalize
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")
    
    @web_app.post("/v1/rerank")
    async def rerank_documents(request: RerankRequest):
        """Rerank documents endpoint"""
        try:
            result = rerank_documents_api.remote(
                request.query,
                request.documents,
                request.top_k
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Reranking failed: {str(e)}")
    
    @web_app.post("/embeddings")
    async def embeddings_openai_compatible(request: dict):
        """OpenAI-compatible embeddings endpoint"""
        try:
            # Convert to our request format
            embedding_request = EmbeddingRequest(
                input=request.get("input", []),
                model=request.get("model", EMBEDDING_MODEL),
                task_type=request.get("task_type", "search"),
                normalize=request.get("normalize", True)
            )
            
            result = generate_embeddings_api.remote(
                embedding_request.input,
                embedding_request.task_type,
                embedding_request.normalize
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")
    
    return web_app

# CLI functions for local testing
@app.local_entrypoint()
def setup_models():
    """Download and cache all models to Modal volume"""
    print("🔧 Setting up model cache...")
    result = download_and_cache_models.remote()
    print("📋 Model cache setup results:")
    for key, path in result.items():
        print(f"   {key}: {path}")
    print("✅ Model cache setup complete!")

@app.local_entrypoint()
def test_service():
    """Test the Modal embedding service locally"""
    print("🧪 Testing Enhanced Embedding Service on Modal Labs...")
    
    # Test embedding generation
    print("\n📝 Testing embedding generation...")
    test_texts = [
        "search for weather information",
        "create a new file in the workspace",
        "send an email message to team"
    ]
    
    try:
        result = generate_embeddings_api.remote(test_texts, "search", True)
        print(f"✅ Generated {len(result['data'])} embeddings")
        print(f"   Dimensions: {len(result['data'][0]['embedding'])}")
        print(f"   Model: {result['model']}")
    except Exception as e:
        print(f"❌ Embedding test failed: {e}")
    
    # Test reranking
    print("\n🔄 Testing document reranking...")
    query = "find weather information"
    documents = [
        "Get current weather conditions for any location",
        "Create a new file in your workspace", 
        "Send email messages to team members",
        "Check weather forecast and temperature data",
        "Download files from the internet",
        "Weather API for getting meteorological data"
    ]
    
    try:
        result = rerank_documents_api.remote(query, documents, 3)
        print(f"✅ Reranked {len(result['results'])} documents")
        for i, doc in enumerate(result['results'][:3]):
            print(f"   {i+1}. {doc['document'][:50]}... (score: {doc['relevance_score']:.4f})")
    except Exception as e:
        print(f"❌ Reranking test failed: {e}")
    
    # Test health check
    print("\n🏥 Testing health check...")
    try:
        result = health_check_api.remote()
        print(f"✅ Service healthy: {result['status']}")
        print(f"   GPU available: {result['gpu_available']}")
        print(f"   GPU count: {result['gpu_count']}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")
    
    print("\n🎉 Modal Labs service test completed!")

if __name__ == "__main__":
    # This allows running the script locally for deployment
    print("🚀 Enhanced Embedding Service for Modal Labs")
    print("Deploy with: modal deploy modal_enhanced_embedding.py")
    print("Serve with: modal serve modal_enhanced_embedding.py")
    print("Setup models: modal run modal_enhanced_embedding.py::setup_models")
    print("Test service: modal run modal_enhanced_embedding.py::test_service")
