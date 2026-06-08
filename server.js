const fs = require('fs');
const http = require('http');
const path = require('path');
const myfxbookStats = require('./api/myfxbook-stats');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
};

function loadLocalEnv() {
    const envPath = path.join(ROOT, '.env.local');
    if (!fs.existsSync(envPath)) return;

    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
        const clean = line.replace(/^\uFEFF/, '').trim();
        if (!clean || clean.startsWith('#')) return;

        const separator = clean.indexOf('=');
        if (separator <= 0) return;

        const key = clean.slice(0, separator).trim();
        const value = clean.slice(separator + 1).trim();
        if (!process.env[key]) process.env[key] = value;
    });
}

function sendNotFound(response) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Not found');
}

function sendStaticFile(filePath, response) {
    fs.readFile(filePath, (error, content) => {
        if (error) {
            sendNotFound(response);
            return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        response.end(content);
    });
}

loadLocalEnv();

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (url.pathname === '/api/myfxbook-stats') {
        myfxbookStats(request, response);
        return;
    }

    const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.normalize(path.join(ROOT, decodeURIComponent(requestedPath)));

    if (!filePath.startsWith(ROOT) || filePath.includes(`${path.sep}api${path.sep}`)) {
        sendNotFound(response);
        return;
    }

    sendStaticFile(filePath, response);
});

server.listen(PORT, () => {
    console.log(`THE FOREX BANK local server running at http://localhost:${PORT}`);
});
