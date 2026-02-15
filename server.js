import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
};

const server = http.createServer(async (req, res) => {
    // Parse URL
    const protocol = req.socket.encrypted ? 'https' : 'http';
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `${protocol}://${host}`);
    const pathname = url.pathname;

    // API Endpoint
    if (pathname === '/api/gemini' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                let parsedBody;
                try {
                    parsedBody = JSON.parse(body);
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    return;
                }

                const { query, context } = parsedBody;
                // Support both standard and Vite-prefixed env vars
                const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

                if (!apiKey || apiKey === 'your_api_key_here') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'API key not configured' }));
                    return;
                }

                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                const prompt = `
You are an expert Spark performance tuning assistant.
Context:
Mission: ${context.missionId}
Knobs: ${JSON.stringify(context.knobs, null, 2)}
Snapshot Stats: ${JSON.stringify(
                    context.snap.stages.map((s) => ({
                        name: s.name,
                        duration: s.durationMs,
                        shuffle: s.shuffleWriteMB,
                        spill: s.spillMB,
                        skew: s.skewScore,
                    })),
                    null,
                    2
                )}

User Question: ${query}

Provide a helpful, concise answer based on the context. Focus on Spark performance concepts.
`;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ text }));

            } catch (error) {
                console.error('Gemini API Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal Server Error', details: error.message }));
            }
        });
        return;
    }

    // Static File Serving
    // Only serve static files if the request is NOT an API call
    if (!pathname.startsWith('/api/')) {
        // Construct the file path using pathname, defaulting to index.html for root
        let relativePath = pathname === '/' ? 'index.html' : pathname;
        // Strip leading slash if present to make path.join work correctly relative to DIST_DIR
        if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
        }

        let filePath = path.join(DIST_DIR, relativePath);

        // Normalize path to verify it is still inside DIST_DIR
        filePath = path.normalize(filePath);

        // Prevent directory traversal attacks
        if (!filePath.startsWith(DIST_DIR)) {
             res.writeHead(403);
             res.end('Forbidden');
             return;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                // If file not found or is a directory
                if (err.code === 'ENOENT' || err.code === 'EISDIR') {
                    // Check extension of the originally requested path
                    const ext = path.extname(pathname);

                    // If it looks like a route (no extension), serve index.html for SPA
                    if (!ext) {
                        const indexPath = path.join(DIST_DIR, 'index.html');
                        fs.readFile(indexPath, (err, content) => {
                            if (err) {
                                res.writeHead(404);
                                res.end('Not Found (SPA index missing)');
                            } else {
                                res.writeHead(200, { 'Content-Type': 'text/html' });
                                res.end(content, 'utf-8');
                            }
                        });
                    } else {
                        // Looks like a file request (e.g. image.png) but missing -> 404
                        res.writeHead(404);
                        res.end('File Not Found');
                    }
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`);
                }
            } else {
                const extname = path.extname(filePath);
                let contentType = MIME_TYPES[extname] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
