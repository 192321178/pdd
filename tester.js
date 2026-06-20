const http = require('http');

const URL = 'http://127.0.0.1:3000/';
const CONCURRENT_USERS = 100;
const DURATION_MS = 60000; // 1 minute

let totalRequests = 0;
let successfulRequests = 0;
let errorRequests = 0;
const latencies = [];

const startTime = Date.now();
let testInProgress = true;

function sendRequest() {
    if (!testInProgress) return;

    const start = Date.now();
    totalRequests++;

    const req = http.get(URL, (res) => {
        const latency = Date.now() - start;
        latencies.push(latency);
        successfulRequests++;
        res.resume();
        setImmediate(sendRequest); // Use setImmediate to avoid stack overflow and give server breathing room
    });

    req.on('error', (err) => {
        // console.error('Request error:', err.message); // Comment out to reduce noise
        errorRequests++;
        setTimeout(sendRequest, 100); // Wait a bit before retrying on error
    });
}

console.log(`Starting load test with ${CONCURRENT_USERS} concurrent users for 60 seconds...`);

// Start concurrent users
for (let i = 0; i < CONCURRENT_USERS; i++) {
    sendRequest();
}

// Stop test after duration
setTimeout(() => {
    testInProgress = false;
    const endTime = Date.now();
    const durationSec = (endTime - startTime) / 1000;

    const rps = (successfulRequests / durationSec).toFixed(2);
    const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
    let minLatency = Infinity;
    let maxLatency = -Infinity;
    for (const l of latencies) {
        if (l < minLatency) minLatency = l;
        if (l > maxLatency) maxLatency = l;
    }

    console.log('\n--- Load Test Results ---');
    console.log(`Duration: ${durationSec.toFixed(2)}s`);
    console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Successful: ${successfulRequests}`);
    console.log(`Errors: ${errorRequests}`);
    console.log(`Requests Per Second (RPS): ${rps}`);
    console.log(`Response Time (Latency):`);
    console.log(`  Average: ${avgLatency}ms`);
    console.log(`  Min: ${minLatency}ms`);
    console.log(`  Max: ${maxLatency}ms`);
    console.log('--------------------------');

    process.exit(0);
}, DURATION_MS);
