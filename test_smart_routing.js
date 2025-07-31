#!/usr/bin/env node

// Test Smart Routing functionality with Modal Labs Enhanced Embedding Service
const http = require('http');

const baseUrl = 'http://localhost:3001';

// Test data
const testQueries = [
  'I want to search for repositories on GitHub',
  'Fetch data from a REST API',
  'Take a screenshot of a webpage',
  'Send a message to Slack channel',
  'Get weather information',
  'Execute Python code',
  'Query a PostgreSQL database'
];

// Helper function to make HTTP requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: res.headers['content-type']?.includes('application/json') ? JSON.parse(body) : body
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Login function
async function login() {
  console.log('🔐 Logging in...');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const loginData = {
    username: 'admin',
    password: 'admin123'
  };
  
  try {
    const response = await makeRequest(options, loginData);
    
    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Login successful');
      return response.body.token;
    } else {
      console.error('❌ Login failed:', response.body);
      return null;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return null;
  }
}

// Test smart routing
async function testSmartRouting(token, query) {
  console.log(`\n🧠 Testing smart routing for: "${query}"`);
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/mcp/$smart',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  const requestData = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {
      query: query,
      limit: 3
    }
  };
  
  try {
    const response = await makeRequest(options, requestData);
    
    if (response.statusCode === 200) {
      console.log('✅ Smart routing response received');
      console.log('📊 Results:', JSON.stringify(response.body, null, 2));
    } else {
      console.error('❌ Smart routing failed:', response.statusCode, response.body);
    }
  } catch (error) {
    console.error('❌ Smart routing error:', error.message);
  }
}

// Test server status
async function testServerStatus() {
  console.log('🌐 Testing server status...');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/servers',
    method: 'GET'
  };
  
  try {
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      console.log('✅ Server status endpoint responding');
      const servers = response.body;
      console.log(`📈 Connected servers: ${servers.filter(s => s.status === 'connected').length}`);
      servers.forEach(server => {
        if (server.status === 'connected' && server.tools?.length > 0) {
          console.log(`   - ${server.name}: ${server.tools.length} tools`);
        }
      });
    } else {
      console.error('❌ Server status failed:', response.statusCode, response.body);
    }
  } catch (error) {
    console.error('❌ Server status error:', error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting MCPHub Smart Routing Tests');
  console.log('=' .repeat(50));
  
  // Test server status first
  await testServerStatus();
  
  // Login
  const token = await login();
  if (!token) {
    console.error('Cannot proceed without authentication token');
    return;
  }
  
  // Test smart routing with different queries
  for (const query of testQueries) {
    await testSmartRouting(token, query);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between requests
  }
  
  console.log('\n🎉 All tests completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
