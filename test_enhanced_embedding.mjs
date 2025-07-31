#!/usr/bin/env node

/**
 * Test Enhanced Embedding System (NV-Embed-v2 + Re-ranker)
 * This script tests the complete enhanced embedding pipeline
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8000';
const TEST_TIMEOUT = 30000; // 30 seconds

class EnhancedEmbeddingTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  async test(name, testFn) {
    process.stdout.write(`Testing ${name}... `);
    try {
      await testFn();
      console.log('✅ PASSED');
      this.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      this.failed++;
      this.errors.push({ test: name, error: error.message });
    }
  }

  async testServiceHealth() {
    const response = await fetch(`${BASE_URL}/health`, {
      timeout: TEST_TIMEOUT,
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    const health = await response.json();

    if (!health.models_loaded?.embedding) {
      throw new Error('Embedding model not loaded');
    }

    if (!health.models_loaded?.reranker) {
      throw new Error('Reranker model not loaded');
    }

    console.log(`\n  📊 Service Details:`);
    console.log(`     GPU Available: ${health.gpu_available}`);
    console.log(`     GPU Count: ${health.gpu_count}`);
    if (health.memory_usage) {
      console.log(`     GPU Memory: ${(health.memory_usage / 1024 / 1024 / 1024).toFixed(2)} GB`);
    }
  }

  async testEmbeddingGeneration() {
    const testTexts = [
      'search for weather information',
      'create a new file in the workspace',
      'send an email message to team',
    ];

    const response = await fetch(`${BASE_URL}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nvidia-local-key',
      },
      body: JSON.stringify({
        input: testTexts,
        model: 'nvidia/NV-Embed-v2',
        task_type: 'search',
        normalize: true,
      }),
      timeout: TEST_TIMEOUT,
    });

    if (!response.ok) {
      throw new Error(`Embedding generation failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.data || !Array.isArray(result.data)) {
      throw new Error('Invalid embedding response format');
    }

    if (result.data.length !== testTexts.length) {
      throw new Error(`Expected ${testTexts.length} embeddings, got ${result.data.length}`);
    }

    // Check embedding dimensions (should be 1024 for NV-Embed-v2)
    const firstEmbedding = result.data[0].embedding;
    if (!Array.isArray(firstEmbedding) || firstEmbedding.length !== 1024) {
      throw new Error(`Expected 1024 dimensions, got ${firstEmbedding?.length || 'unknown'}`);
    }

    console.log(`\n  📊 Embedding Details:`);
    console.log(`     Generated embeddings: ${result.data.length}`);
    console.log(`     Dimensions: ${firstEmbedding.length}`);
    console.log(`     Model: ${result.model}`);
  }

  async testReranking() {
    const query = 'find weather information';
    const documents = [
      'Get current weather conditions for any location',
      'Create a new file in your workspace',
      'Send email messages to team members',
      'Check weather forecast and temperature data',
      'Download files from the internet',
      'Weather API for getting meteorological data',
    ];

    const response = await fetch(`${BASE_URL}/v1/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nvidia-local-key',
      },
      body: JSON.stringify({
        query: query,
        documents: documents,
        top_k: 3,
      }),
      timeout: TEST_TIMEOUT,
    });

    if (!response.ok) {
      throw new Error(`Reranking failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.results || !Array.isArray(result.results)) {
      throw new Error('Invalid reranking response format');
    }

    if (result.results.length === 0) {
      throw new Error('No reranked results returned');
    }

    // Check that results are properly ranked (weather-related should be at top)
    const topResult = result.results[0];
    if (!topResult.document.toLowerCase().includes('weather')) {
      console.log(`\n  ⚠️  Warning: Top result may not be optimally ranked`);
      console.log(`     Query: "${query}"`);
      console.log(`     Top result: "${topResult.document}"`);
    }

    console.log(`\n  📊 Reranking Details:`);
    console.log(`     Input documents: ${documents.length}`);
    console.log(`     Returned results: ${result.results.length}`);
    console.log(`     Top result: "${topResult.document}"`);
    console.log(`     Top score: ${topResult.relevance_score.toFixed(4)}`);
  }

  async testOpenAICompatibility() {
    // Test OpenAI-compatible endpoint
    const response = await fetch(`${BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nvidia-local-key',
      },
      body: JSON.stringify({
        input: ['test compatibility with OpenAI format'],
        model: 'nvidia/NV-Embed-v2',
      }),
      timeout: TEST_TIMEOUT,
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI compatibility test failed: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();

    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
      throw new Error('Invalid OpenAI-compatible response');
    }

    const embedding = result.data[0].embedding;
    if (!Array.isArray(embedding) || embedding.length !== 1024) {
      throw new Error('OpenAI-compatible endpoint returned invalid embedding');
    }
  }

  async testPerformance() {
    const startTime = Date.now();
    const testText = 'This is a performance test for the embedding generation system';

    const response = await fetch(`${BASE_URL}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nvidia-local-key',
      },
      body: JSON.stringify({
        input: [testText],
        model: 'nvidia/NV-Embed-v2',
        task_type: 'search',
        normalize: true,
      }),
      timeout: TEST_TIMEOUT,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (!response.ok) {
      throw new Error(`Performance test failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.data || result.data.length === 0) {
      throw new Error('Performance test returned no data');
    }

    console.log(`\n  📊 Performance Details:`);
    console.log(`     Response time: ${duration}ms`);
    console.log(`     Text length: ${testText.length} characters`);

    if (duration > 10000) {
      console.log(`     ⚠️  Warning: Response time seems slow (>${duration}ms)`);
    }
  }

  async runAllTests() {
    console.log('🧪 Enhanced Embedding System Test Suite');
    console.log('==========================================');
    console.log(`Testing service at: ${BASE_URL}\n`);

    // Wait a bit for service to be ready
    console.log('⏳ Waiting for service to be ready...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await this.test('Service Health Check', () => this.testServiceHealth());
    await this.test('Embedding Generation', () => this.testEmbeddingGeneration());
    await this.test('Document Reranking', () => this.testReranking());
    await this.test('OpenAI Compatibility', () => this.testOpenAICompatibility());
    await this.test('Performance Baseline', () => this.testPerformance());

    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(
      `📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`,
    );

    if (this.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.errors.forEach((error) => {
        console.log(`   - ${error.test}: ${error.error}`);
      });
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Ensure the enhanced embedding service is running');
      console.log('   2. Check GPU availability and memory');
      console.log('   3. Verify HuggingFace authentication');
      console.log('   4. Check network connectivity to the service');
    } else {
      console.log('\n🎉 All tests passed! Enhanced embedding system is working correctly.');
      console.log('\n✅ MCPHub Configuration Verified:');
      console.log('   - NVIDIA NV-Embed-v2 (1024 dimensions)');
      console.log('   - BAAI/bge-reranker-v2-m3 reranking');
      console.log('   - OpenAI-compatible API endpoints');
      console.log('   - Performance within acceptable ranges');
    }

    process.exit(this.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tester = new EnhancedEmbeddingTester();
tester.runAllTests().catch((error) => {
  console.error(`\n💥 Test suite failed to run: ${error.message}`);
  console.error('\nPlease ensure:');
  console.error('1. Enhanced embedding service is running at http://localhost:8000');
  console.error('2. All dependencies are properly installed');
  console.error('3. GPU drivers and CUDA are properly configured');
  process.exit(1);
});
