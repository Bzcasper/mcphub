import { strict as assert } from 'assert';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const MCPHUB_BASE_URL = process.env.MCPHUB_URL || 'http://localhost:3000';
const MODAL_SERVICE_URL = 'https://ai-tool-pool--enhanced-embedding-service-fastapi-app.modal.run';
const RENDER_API_KEY = process.env.RENDER_API_KEY; // You'll need to set this

// Color console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testModalService() {
  log(colors.cyan, '\n🧪 Testing Modal Labs Enhanced Embedding Service...');

  try {
    // Test health endpoint
    log(colors.blue, '  📊 Checking service health...');
    const healthResponse = await fetch(`${MODAL_SERVICE_URL}/health`);
    const healthData = await healthResponse.json();

    assert(healthResponse.ok, 'Health check should succeed');
    assert(healthData.status === 'healthy', 'Service should be healthy');
    log(
      colors.green,
      `  ✅ Service healthy: ${healthData.embedding_model} (${healthData.embedding_dimensions}d)`,
    );

    // Test embedding generation
    log(colors.blue, '  🔤 Testing embedding generation...');
    const embeddingResponse = await fetch(`${MODAL_SERVICE_URL}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: 'Create a new web service on Render',
        task_type: 'search',
        normalize: true,
      }),
    });

    const embeddingData = await embeddingResponse.json();
    assert(embeddingResponse.ok, 'Embedding generation should succeed');
    assert(embeddingData.data && embeddingData.data.length > 0, 'Should return embedding data');
    assert(
      embeddingData.data[0].embedding.length === 1024,
      'Should return 1024-dimensional embeddings',
    );
    log(
      colors.green,
      `  ✅ Generated ${embeddingData.data[0].embedding.length}d embedding successfully`,
    );

    // Test reranking
    log(colors.blue, '  🔄 Testing document reranking...');
    const rerankResponse = await fetch(`${MODAL_SERVICE_URL}/v1/rerank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Deploy a web application',
        documents: [
          'Create a new web service on Render',
          'List all services in workspace',
          'Query database logs',
          'Deploy static site',
          'Manage environment variables',
        ],
        top_k: 3,
      }),
    });

    const rerankData = await rerankResponse.json();
    assert(rerankResponse.ok, 'Reranking should succeed');
    assert(rerankData.results && rerankData.results.length > 0, 'Should return reranked results');
    log(colors.green, `  ✅ Reranked ${rerankData.results.length} documents successfully`);

    return true;
  } catch (error) {
    log(colors.red, `  ❌ Modal service test failed: ${error.message}`);
    return false;
  }
}

async function testMCPHubConfiguration() {
  log(colors.cyan, '\n🔧 Testing MCPHub Configuration...');

  try {
    // Test MCPHub health
    log(colors.blue, '  📊 Checking MCPHub health...');
    const healthResponse = await fetch(`${MCPHUB_BASE_URL}/health`);
    if (healthResponse.ok) {
      log(colors.green, '  ✅ MCPHub is running');
    } else {
      log(colors.yellow, '  ⚠️ MCPHub health endpoint not available, continuing...');
    }

    // Test smart routing endpoint
    log(colors.blue, '  🧠 Testing smart routing endpoint...');
    const smartRoutingResponse = await fetch(`${MCPHUB_BASE_URL}/mcp/$smart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/list',
        params: {},
        query: 'Create a new web service on Render',
      }),
    });

    if (smartRoutingResponse.ok) {
      const smartRoutingData = await smartRoutingResponse.json();
      log(colors.green, `  ✅ Smart routing endpoint responding`);

      // Check if render tools are available
      const hasRenderTools = smartRoutingData.result?.tools?.some(
        (tool: any) =>
          tool.name?.toLowerCase().includes('render') ||
          tool.description?.toLowerCase().includes('render'),
      );

      if (hasRenderTools) {
        log(colors.green, '  ✅ Render tools detected in smart routing');
      } else {
        log(colors.yellow, '  ⚠️ Render tools not yet indexed in smart routing');
      }
    } else {
      log(colors.yellow, '  ⚠️ Smart routing endpoint not responding, may need MCPHub restart');
    }

    return true;
  } catch (error) {
    log(colors.red, `  ❌ MCPHub configuration test failed: ${error.message}`);
    return false;
  }
}

async function testRenderMCPServer() {
  log(colors.cyan, '\n🎭 Testing Render MCP Server Integration...');

  if (!RENDER_API_KEY) {
    log(colors.yellow, '  ⚠️ RENDER_API_KEY not set, skipping Render MCP server tests');
    return false;
  }

  try {
    // Test direct Render MCP server connection
    log(colors.blue, '  🔗 Testing direct Render MCP connection...');
    const renderResponse = await fetch('https://mcp.render.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RENDER_API_KEY}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });

    if (renderResponse.ok) {
      const renderData = await renderResponse.json();
      if (renderData.result && renderData.result.tools) {
        log(
          colors.green,
          `  ✅ Render MCP server responding with ${renderData.result.tools.length} tools`,
        );

        // Log available tools
        const toolNames = renderData.result.tools.map((tool: any) => tool.name).slice(0, 5);
        log(colors.blue, `  📋 Available tools: ${toolNames.join(', ')}...`);
      }
    } else {
      log(colors.red, `  ❌ Render MCP server connection failed: ${renderResponse.status}`);
    }

    // Test through MCPHub proxy
    log(colors.blue, '  🔄 Testing Render tools through MCPHub...');
    const proxyResponse = await fetch(`${MCPHUB_BASE_URL}/mcp/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/list',
        params: {},
      }),
    });

    if (proxyResponse.ok) {
      const proxyData = await proxyResponse.json();
      if (proxyData.result && proxyData.result.tools) {
        log(colors.green, `  ✅ Render tools accessible through MCPHub proxy`);
      }
    } else {
      log(colors.yellow, `  ⚠️ MCPHub proxy for Render not yet configured properly`);
    }

    return true;
  } catch (error) {
    log(colors.red, `  ❌ Render MCP server test failed: ${error.message}`);
    return false;
  }
}

async function testSmartRoutingWithRender() {
  log(colors.cyan, '\n🎯 Testing Smart Routing with Render Tools...');

  const testQueries = [
    'Create a new web service on Render',
    'Deploy a Flask application to Render',
    'Check the logs for my service',
    'List all my Render services',
    'Create a new PostgreSQL database',
    'Set environment variables for my app',
  ];

  try {
    for (const query of testQueries) {
      log(colors.blue, `  🔍 Testing query: "${query}"`);

      const response = await fetch(`${MCPHUB_BASE_URL}/mcp/$smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          params: {
            name: 'search_tools',
            arguments: { query },
          },
          query,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        log(colors.green, `    ✅ Smart routing successful`);

        // Check if results contain Render-related tools
        const hasRenderResults = JSON.stringify(data).toLowerCase().includes('render');
        if (hasRenderResults) {
          log(colors.green, `    🎯 Found Render-related recommendations`);
        } else {
          log(colors.yellow, `    ⚠️ No Render-specific results (normal for some queries)`);
        }
      } else {
        log(colors.yellow, `    ⚠️ Smart routing failed for this query`);
      }
    }

    return true;
  } catch (error) {
    log(colors.red, `  ❌ Smart routing test failed: ${error.message}`);
    return false;
  }
}

async function testEmbeddingServiceIntegration() {
  log(colors.cyan, '\n🔗 Testing Embedding Service Integration...');

  const renderToolDescriptions = [
    'Create a new web service on Render platform',
    'List all services in the current workspace',
    'Deploy a new version of an existing service',
    'Query logs for service debugging and monitoring',
    'Create and manage PostgreSQL databases',
    'Manage environment variables for services',
    'Set up custom domains for web services',
    'Scale services up or down based on demand',
  ];

  try {
    // Test embedding generation for Render tools
    log(colors.blue, '  🔤 Generating embeddings for Render tool descriptions...');
    const embeddingResponse = await fetch(`${MODAL_SERVICE_URL}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: renderToolDescriptions,
        task_type: 'search',
        normalize: true,
      }),
    });

    const embeddingData = await embeddingResponse.json();
    assert(embeddingResponse.ok, 'Embedding generation should succeed');
    assert(
      embeddingData.data.length === renderToolDescriptions.length,
      'Should generate embeddings for all tools',
    );
    log(colors.green, `  ✅ Generated embeddings for ${embeddingData.data.length} Render tools`);

    // Test query-to-tool matching
    log(colors.blue, '  🎯 Testing query-to-tool matching...');
    const testQuery = 'I need to deploy a Python web application';

    const queryEmbeddingResponse = await fetch(`${MODAL_SERVICE_URL}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: testQuery,
        task_type: 'search',
        normalize: true,
      }),
    });

    const _queryEmbeddingData = await queryEmbeddingResponse.json();
    assert(queryEmbeddingResponse.ok, 'Query embedding should succeed');
    log(colors.green, `  ✅ Generated query embedding successfully`);

    // Test reranking with Render tools
    log(colors.blue, '  🔄 Testing reranking with Render tools...');
    const rerankResponse = await fetch(`${MODAL_SERVICE_URL}/v1/rerank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: testQuery,
        documents: renderToolDescriptions,
        top_k: 3,
      }),
    });

    const rerankData = await rerankResponse.json();
    assert(rerankResponse.ok, 'Reranking should succeed');
    assert(rerankData.results.length > 0, 'Should return reranked results');

    log(colors.green, '  ✅ Top 3 recommended tools:');
    rerankData.results.forEach((result: any, index: number) => {
      log(
        colors.blue,
        `    ${index + 1}. ${result.document} (score: ${result.relevance_score.toFixed(4)})`,
      );
    });

    return true;
  } catch (error) {
    log(colors.red, `  ❌ Embedding service integration test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  log(colors.magenta, '🚀 RENDER MCP SERVER + MODAL LABS INTEGRATION TEST SUITE');
  log(colors.magenta, '==============================================================');

  const results = {
    modalService: await testModalService(),
    mcphubConfig: await testMCPHubConfiguration(),
    renderMCP: await testRenderMCPServer(),
    smartRouting: await testSmartRoutingWithRender(),
    embeddingIntegration: await testEmbeddingServiceIntegration(),
  };

  // Summary
  log(colors.magenta, '\n📊 TEST RESULTS SUMMARY:');
  log(colors.magenta, '========================');

  const testResults = [
    ['Modal Labs Service', results.modalService],
    ['MCPHub Configuration', results.mcphubConfig],
    ['Render MCP Server', results.renderMCP],
    ['Smart Routing', results.smartRouting],
    ['Embedding Integration', results.embeddingIntegration],
  ];

  let passedTests = 0;
  testResults.forEach(([testName, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? colors.green : colors.red;
    log(color, `  ${status} ${testName}`);
    if (passed) passedTests++;
  });

  const successRate = ((passedTests / testResults.length) * 100).toFixed(1);
  log(
    colors.magenta,
    `\n🎯 Overall Success Rate: ${successRate}% (${passedTests}/${testResults.length})`,
  );

  if (passedTests === testResults.length) {
    log(colors.green, '🎉 ALL TESTS PASSED! Render MCP + Modal Labs integration is ready!');
  } else {
    log(colors.yellow, '⚠️ Some tests failed. Check configuration and try again.');
  }

  // Integration recommendations
  log(colors.cyan, '\n💡 NEXT STEPS:');
  if (!RENDER_API_KEY) {
    log(colors.yellow, '  1. Set RENDER_API_KEY environment variable for full functionality');
  }
  log(colors.blue, '  2. Restart MCPHub to load new Render MCP server configuration');
  log(colors.blue, '  3. Test smart routing with real Render queries');
  log(colors.blue, '  4. Monitor Modal Labs service performance and scaling');
  log(colors.blue, '  5. Set up logging and monitoring for production use');

  process.exit(passedTests === testResults.length ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  log(colors.red, `❌ Test suite failed with error: ${error.message}`);
  process.exit(1);
});
