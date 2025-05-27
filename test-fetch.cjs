const fetch = require('node-fetch');

console.log('Testing fetch...');
console.log('fetch type:', typeof fetch);
console.log('fetch function:', fetch);

async function testFetch() {
  try {
    const response = await fetch('https://httpbin.org/get');
    const data = await response.json();
    console.log('✅ Fetch working! Response:', data.url);
  } catch (error) {
    console.error('❌ Fetch failed:', error.message);
  }
}

testFetch(); 