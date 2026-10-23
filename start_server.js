// Local HTTP server: `static/` at site root, `tools/` under `/tools/`.

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// Repository root (directory of this file)
const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.join(REPO_ROOT, 'static');
const TOOLS_ROOT = path.join(REPO_ROOT, 'tools');

const PORT = 8000;
const MAX_PORTS_TO_TRY = 20;

const GENERIC_EDITOR_PATH = '/tools/generic-template-editor/';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
};

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
};

/**
 * Map a URL path to a file system path. `/tools/...` → tools/, everything else → static/.
 * `..` segments cannot climb above the chosen root.
 * @param {string} urlPath
 * @returns {string | null}
 */
function translatePath(urlPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath);
    } catch {
        return null;
    }
    let words = decoded.replace(/\\/g, '/').split('/').filter((w) => w && w !== '.');
    let root = STATIC_ROOT;
    if (words[0] === 'tools') {
        root = TOOLS_ROOT;
        words = words.slice(1);
    }
    const parts = [];
    for (const word of words) {
        if (word === '..') parts.pop();
        else parts.push(word);
    }
    const fsPath = path.join(root, ...parts);
    if (fsPath !== root && !fsPath.startsWith(root + path.sep)) return null;
    return fsPath;
}

function sendText(res, status, message, headOnly) {
    res.writeHead(status, { ...NO_CACHE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(headOnly ? undefined : message);
}

async function handleRequest(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendText(res, 405, 'Method Not Allowed');
        return;
    }
    const headOnly = req.method === 'HEAD';
    const url = new URL(req.url || '/', 'http://localhost');
    let fsPath = translatePath(url.pathname);
    if (!fsPath) {
        sendText(res, 404, 'Not Found', headOnly);
        return;
    }

    let info;
    try {
        info = await stat(fsPath);
        if (info.isDirectory()) {
            // Relative links inside index.html need the trailing slash
            if (!url.pathname.endsWith('/')) {
                res.writeHead(301, { ...NO_CACHE_HEADERS, Location: `${url.pathname}/${url.search}` });
                res.end();
                return;
            }
            fsPath = path.join(fsPath, 'index.html');
            info = await stat(fsPath);
        }
    } catch {
        sendText(res, 404, 'Not Found', headOnly);
        return;
    }

    const contentType = MIME_TYPES[path.extname(fsPath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { ...NO_CACHE_HEADERS, 'Content-Type': contentType, 'Content-Length': info.size });
    if (headOnly) {
        res.end();
        return;
    }
    createReadStream(fsPath)
        .on('error', () => res.destroy())
        .pipe(res);
}

/**
 * @param {number} start
 * @returns {Promise<{ server: http.Server, port: number }>}
 */
async function listenOnFreePort(start) {
    for (let port = start; port < start + MAX_PORTS_TO_TRY; port++) {
        const server = http.createServer((req, res) => {
            handleRequest(req, res).catch((err) => {
                console.error(err);
                if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
                else res.destroy();
            });
        });
        try {
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(port, resolve);
            });
            return { server, port };
        } catch (err) {
            if (err.code !== 'EADDRINUSE') throw err;
            console.log(`Port ${port} is busy, trying port ${port + 1}...`);
        }
    }
    throw new Error(`Could not find a free port between ${start} and ${start + MAX_PORTS_TO_TRY - 1}.`);
}

/** @returns {Promise<boolean>} whether a browser launcher started */
function openBrowser(url) {
    let command;
    let args;
    if (process.platform === 'win32') {
        command = 'cmd';
        args = ['/c', 'start', '', url];
    } else if (process.platform === 'darwin') {
        command = 'open';
        args = [url];
    } else {
        command = 'xdg-open';
        args = [url];
    }
    return new Promise((resolve) => {
        const child = spawn(command, args, { stdio: 'ignore', detached: true });
        child.once('error', () => resolve(false));
        child.once('spawn', () => {
            child.unref();
            resolve(true);
        });
    });
}

async function main() {
    const { values } = parseArgs({
        options: {
            generic: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false },
        },
    });
    if (values.help) {
        console.log('Usage: node start_server.js [--generic]');
        console.log('Serve static/ (site root) and tools/ under /tools/.');
        console.log(`  --generic  Open the generic template editor (${GENERIC_EDITOR_PATH}) in the browser.`);
        return;
    }

    const { server, port } = await listenOnFreePort(PORT);
    const base = `http://localhost:${port}`;
    const openUrl = base + (values.generic ? GENERIC_EDITOR_PATH : '/');

    console.log(`Successfully started server on ${base}`);
    console.log(`Serving static from: ${STATIC_ROOT}`);
    console.log(`Serving tools from:  ${TOOLS_ROOT}  →  ${base}/tools/`);
    console.log('Opening in your default browser...');

    if (!(await openBrowser(openUrl))) {
        console.log('\n---------------------------------------------------');
        console.log('Could not automatically open your browser.');
        console.log(`Please manually open this URL: ${openUrl}`);
        console.log('---------------------------------------------------\n');
    }

    console.log('\n---------------------------------------------------');
    console.log('Your project is now running.');
    console.log('Keep this terminal window open to keep it running.');
    console.log('To stop the server, close this window or press Ctrl+C.');
    console.log('---------------------------------------------------\n');

    process.on('SIGINT', () => {
        console.log('\nServer stopped.');
        server.close();
        process.exit(0);
    });
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
