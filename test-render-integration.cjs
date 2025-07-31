#!/usr/bin/env node

// Simple Node.js test script for Render MCP + Modal Labs integration
const https = require('https');
const http = require('http');

// Configuration
const MODAL_SERVICE_URL = 'https://ai-tool-pool--enhanced-embedding-service-fastapi-app.modal.run';
const MCPHUB_BASE_URL = process.env.MCPHUB_URL || 'http://localhost:3000';
const RENDER_API_KEY = process.env.RENDER_API_KEY;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https://') ? https : http;
    const requestUrl = new URL(url);
    
    const requestOptions = {
      hostname: requestUrl.hostname,
      port: requestUrl.port || (protocol === https ? 443 : 80),
      path: requestUrl.pathname + requestUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = {
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            data: data ? JSON.parse(data) : null,
          };
          resolve(response);
        } catch (error) {
          resolve({
            ok: false,
            status: res.statusCode,
            statusText: res.statusMessage,
            data: data,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testModalService() {
  log(colors.cyan, '\n🧪 Testing Modal Labs Enhanced Embedding Service...');
  
  try {
    // Test health endpoint
    log(colors.blue, '  📊 Checking service health...');
    const healthResponse = await makeRequest(`${MODAL_SERVICE_URL}/health`);
    
    if (healthResponse.ok && healthResponse.data) {
      const healthData = healthResponse.data;
      log(colors.green, `  ✅ Service healthy: ${healthData.embedding_model} (${healthData.embedding_dimensions}d)`);
      log(colors.blue, `    GPU Available: ${healthData.gpu_available}`);
      log(colors.blue, `    Reranker: ${healthData.reranker_model}`);
    } else {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }

    // Test embedding generation
    log(colors.blue, '  🔤 Testing embedding generation...');
    const embeddingResponse = await makeRequest(`${MODAL_SERVICE_URL}/v1/embeddings`, {
      method: 'POST',
      body: {
        input: 'Create a new web service on Render',
        task_type: 'search',
        normalize: true,
      },
    });
    
    if (embeddingResponse.ok && embeddingResponse.data) {
      const embeddingData = embeddingResponse.data;
      if (embeddingData.data && embeddingData.data.length > 0) {
        const embedding = embeddingData.data[0].embedding;
        log(colors.green, `  ✅ Generated ${embedding.length}d embedding successfully`);
        log(colors.blue, `    Model: ${embeddingData.model}`);
      } else {
        throw new Error('Invalid embedding response format');
      }
    } else {
      throw new Error(`Embedding failed: ${embeddingResponse.status}`);
    }

    // Test reranking
    log(colors.blue, '  🔄 Testing document reranking...');
    const rerankResponse = await makeRequest(`${MODAL_SERVICE_URL}/v1/rerank`, {
      method: 'POST',
      body: {
        query: 'Deploy a web application',
        documents: [
          'Create a new web service on Render',
          'List all services in workspace',
          'Query database logs',
          'Deploy static site',
          'Manage environment variables',
        ],
        top_k: 3,
      },
    });
    
    if (rerankResponse.ok && rerankResponse.data) {
      const rerankData = rerankResponse.data;
      if (rerankData.results && rerankData.results.length > 0) {
        log(colors.green, `  ✅ Reranked ${rerankData.results.length} documents successfully`);
        log(colors.blue, `    Top result: "${rerankData.results[0].document}" (score: ${rerankData.results[0].relevance_score.toFixed(4)})`);
      } else {
        throw new Error('Invalid reranking response format');
      }
    } else {
      throw new Error(`Reranking failed: ${rerankResponse.status}`);
    }

    return true;
  } catch (error) {
    log(colors.red, `  ❌ Modal service test failed: ${error.message}`);
    return false;
  }
}

async function testRenderConfiguration() {
  log(colors.cyan, '\n🔧 Testing Render MCP Configuration...');

  if (!RENDER_API_KEY) {
    log(colors.yellow, '  ⚠️ RENDER_API_KEY not set, skipping API tests');
    log(colors.blue, '  💡 Set RENDER_API_KEY environment variable to enable full testing');
    return false;
  }

  try {
    // Test direct Render MCP server connection
    log(colors.blue, '  🔗 Testing direct Render MCP connection...');
    const renderResponse = await makeRequest('https://mcp.render.com/mcp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      },
    });

    if (renderResponse.ok && renderResponse.data) {
      const renderData = renderResponse.data;
      if (renderData.result && renderData.result.tools) {
        log(colors.green, `  ✅ Render MCP server responding with ${renderData.result.tools.length} tools`);
        
        // Log first few tools
        const toolNames = renderData.result.tools.slice(0, 5).map(tool => tool.name);
        log(colors.blue, `    Available tools: ${toolNames.join(', ')}...`);
        
        return true;
      } else {
        throw new Error('Invalid response format from Render MCP server');
      }
    } else {
      throw new Error(`Render MCP server connection failed: ${renderResponse.status}`);
    }
  } catch (error) {
    log(colors.red, `  ❌ Render configuration test failed: ${error.message}`);
    return false;
  }
}

async function testEmbeddingIntegration() {
  log(colors.cyan, '\n🎯 Testing Smart Routing Simulation...');

  const renderQueries = [
    'Create a new web service on Render',
    'Deploy a Flask application',
    'Check service logs for errors',
    'Create a PostgreSQL database',
    'Set environment variables',
  ];

  const renderTools = [
    'create_service - Create a new web service or static site',
    'list_services - List all services in the workspace',
    'get_service - Get details about a specific service',
    'create_database - Create a new PostgreSQL database',
    'run_sql_query - Execute a read-only SQL query',
    'list_logs - List logs matching provided filters',
    'update_env_vars - Update environment variables for a service',
    'list_deploys - List deploy history for a service',
  ];

  try {
    for (const query of renderQueries) {
      log(colors.blue, `  🔍 Testing: "${query}"`);

      // Generate embedding for query
      const queryResponse = await makeRequest(`${MODAL_SERVICE_URL}/v1/embeddings`, {
        method: 'POST',
        body: {
          input: query,
          task_type: 'search',
          normalize: true,
        },
      });

      if (!queryResponse.ok) {
        throw new Error(`Query embedding failed: ${queryResponse.status}`);
      }

      // Test reranking with Render tools
      const rerankResponse = await makeRequest(`${MODAL_SERVICE_URL}/v1/rerank`, {
        method: 'POST',
        body: {
          query: query,
          documents: renderTools,
          top_k: 3,
        },
      });

      if (rerankResponse.ok && rerankResponse.data) {
        const results = rerankResponse.data.results;
        if (results && results.length > 0) {
          const topTool = results[0];
          log(colors.green, `    ✅ Top match: ${topTool.document.split(' - ')[0]} (score: ${topTool.relevance_score.toFixed(4)})`);
        } else {
          log(colors.yellow, `    ⚠️ No reranking results for this query`);
        }
      } else {
        log(colors.yellow, `    ⚠️ Reranking failed for this query`);
      }
    }

    return true;
  } catch (error) {
    log(colors.red, `  ❌ Smart routing simulation failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  log(colors.magenta, '🚀 RENDER MCP + MODAL LABS INTEGRATION TEST');
  log(colors.magenta, '============================================');

  const startTime = Date.now();

  const results = {
    modal: await testModalService(),
    render: await testRenderConfiguration(),
    routing: await testEmbeddingIntegration(),
  };

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  log(colors.magenta, '\n📊 TEST RESULTS SUMMARY:');
  log(colors.magenta, '========================');

  const testResults = [
    ['Modal Labs Service', results.modal],
    ['Render Configuration', results.render],
    ['Smart Routing Simulation', results.routing],
  ];

  let passedTests = 0;
  testResults.forEach(([testName, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? colors.green : colors.red;
    log(color, `  ${status} ${testName}`);
    if (passed) passedTests++;
  });

  const successRate = (passedTests / testResults.length * 100).toFixed(1);
  log(colors.magenta, `\n🎯 Results: ${successRate}% (${passedTests}/${testResults.length}) - ${duration}s`);

  if (passedTests >= 2) {
    log(colors.green, '🎉 CORE INTEGRATION WORKING! Modal Labs + Render tools ready for MCPHub!');
  } else {
    log(colors.yellow, '⚠️ Some tests failed. Check configuration and try again.');
  }

  // Next steps
  log(colors.cyan, '\n💡 NEXT STEPS:');
  log(colors.blue, '  1. Add your Render API key: export RENDER_API_KEY="rnd_xxx..."');
  log(colors.blue, '  2. Update mcp_settings.json with your API key');
  log(colors.blue, '  3. Restart MCPHub to load new configuration');
  log(colors.blue, '  4. Test with: curl -X POST http://localhost:3000/mcp/$smart');
  log(colors.blue, '  5. Monitor performance and optimize as needed');

  process.exit(passedTests >= 2 ? 0 : 1);
}

// Run the tests
runTests().catch((error) => {
  log(colors.red, `❌ Test suite failed: ${error.message}`);
  process.exit(1);
});
