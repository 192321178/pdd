const { spawn } = require('child_process');
const path = require('path');

const server = spawn('node', ['server.js'], { stdio: 'inherit' });

console.log('Waiting for server to start...');
setTimeout(() => {
    console.log('Server should be ready. Starting tester...');
    const tester = spawn('node', ['tester.js'], { stdio: 'inherit' });

    tester.on('close', (code) => {
        console.log(`Tester finished with code ${code}. Cleaning up...`);
        server.kill();
        process.exit(code);
    });
}, 5000);
