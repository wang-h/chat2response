"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const converter_1 = require("./converter");
const providers_1 = require("./providers");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3456;
const DEBUG = process.env.DEBUG === 'true';
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
function debug(...args) {
    if (DEBUG) {
        console.log('[App]', ...args);
    }
}
// ============================================
// Health Check
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'chat2response',
        version: '2.0.0',
        providers: Object.keys(providers_1.PROVIDERS),
    });
});
// ============================================
// Models Endpoint
// ============================================
app.get('/v1/models', async (req, res) => {
    try {
        // Aggregate models from all providers
        const allModels = [];
        for (const [key, provider] of Object.entries(providers_1.PROVIDERS)) {
            const models = provider.models ?? [provider.defaultModel];
            for (const modelId of models) {
                allModels.push({
                    id: modelId,
                    object: 'model',
                    created: Date.now(),
                    owned_by: provider.name,
                });
            }
        }
        res.json({
            object: 'list',
            data: allModels,
        });
    }
    catch (error) {
        console.error('Error listing models:', error);
        res.status(500).json({
            error: {
                message: 'Failed to list models',
                type: 'internal_error',
            },
        });
    }
});
// ============================================
// Main Responses Endpoint
// ============================================
app.post('/v1/responses', async (req, res) => {
    const startTime = Date.now();
    try {
        const body = req.body;
        debug('Received request:', JSON.stringify(body, null, 2));
        // Get provider from request header or use default
        const providerHeader = req.headers['x-provider'];
        const providerFromModel = (0, providers_1.detectProviderFromModel)(body.model);
        const providerName = ((0, providers_1.isProviderSupported)(providerHeader) ? providerHeader : null) ||
            providerFromModel ||
            process.env.DEFAULT_PROVIDER ||
            'deepseek';
        const provider = (0, providers_1.getProvider)(providerName);
        const apiKey = (0, providers_1.getApiKey)(providerName);
        debug(`Using provider: ${provider.name}`);
        // 1. Convert Responses API request to Chat Completions format
        let chatRequest = (0, converter_1.convertResponsesToChat)(body);
        debug('Converted to Chat Completions:', JSON.stringify(chatRequest, null, 2));
        // 2. Apply provider-specific transformations
        chatRequest = (0, providers_1.transformRequest)(providerName, chatRequest);
        debug('After provider transformation:', JSON.stringify(chatRequest, null, 2));
        // 3. Forward to provider
        const targetUrl = `${provider.baseUrl}/chat/completions`;
        debug(`Forwarding to: ${targetUrl}`);
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'claude-code/0.1.0', // 与 OpenClaw 保持一致
            },
            body: JSON.stringify(chatRequest),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Provider error (${response.status}):`, errorText);
            // Try to parse as JSON
            try {
                const errorJson = JSON.parse(errorText);
                return res.status(response.status).json(errorJson);
            }
            catch {
                return res.status(response.status).json({
                    error: {
                        message: errorText || `Provider returned ${response.status}`,
                        type: 'provider_error',
                    },
                });
            }
        }
        // 4. Handle streaming vs non-streaming
        if (body.stream !== false && provider.supportsStreaming) {
            // Streaming response
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            if (!response.body) {
                throw new Error('No response body');
            }
            const stream = (0, converter_1.streamChatToResponses)(response.body, chatRequest.model, body.input);
            try {
                for await (const chunk of stream) {
                    res.write(chunk);
                    // Check if client disconnected
                    if (res.writableEnded) {
                        debug('Client disconnected');
                        break;
                    }
                }
                if (!res.writableEnded) {
                    res.end();
                }
            }
            catch (streamError) {
                console.error('Stream error:', streamError);
                if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify({
                        type: 'response.failed',
                        error: { message: String(streamError), code: 'stream_error' }
                    })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                }
            }
        }
        else {
            // Non-streaming response
            const chatResponse = await response.json();
            debug('Received Chat Completions response:', JSON.stringify(chatResponse, null, 2));
            // Convert to Responses API format
            const responsesOutput = (0, converter_1.convertChatToResponses)(chatResponse, chatRequest.model, body.input);
            debug('Converted to Responses API:', JSON.stringify(responsesOutput, null, 2));
            res.json(responsesOutput);
        }
        const duration = Date.now() - startTime;
        debug(`Request completed in ${duration}ms`);
    }
    catch (error) {
        console.error('Error handling request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: {
                    message: error instanceof Error ? error.message : String(error),
                    type: 'internal_error',
                },
            });
        }
    }
});
// ============================================
// Chat Completions Pass-through (optional)
// ============================================
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const providerHeader = req.headers['x-provider'];
        const providerName = ((0, providers_1.isProviderSupported)(providerHeader) ? providerHeader : null) ||
            process.env.DEFAULT_PROVIDER ||
            'deepseek';
        const provider = (0, providers_1.getProvider)(providerName);
        const apiKey = (0, providers_1.getApiKey)(providerName);
        // Apply provider-specific transformations
        const transformedRequest = (0, providers_1.transformRequest)(providerName, req.body);
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'claude-code/0.1.0',
            },
            body: JSON.stringify(transformedRequest),
        });
        // Forward the response
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        if (transformedRequest.stream && response.body) {
            // Streaming - pipe through
            const reader = response.body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    res.write(Buffer.from(value));
                }
                res.end();
            }
            finally {
                reader.releaseLock();
            }
        }
        else {
            // Non-streaming
            const body = await response.text();
            res.status(response.status).send(body);
        }
    }
    catch (error) {
        console.error('Error in chat completions:', error);
        res.status(500).json({
            error: {
                message: error instanceof Error ? error.message : String(error),
                type: 'internal_error',
            },
        });
    }
});
// ============================================
// Error Handling
// ============================================
app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: {
            message: err.message || 'Internal server error',
            type: 'internal_error',
        },
    });
});
// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║           Chat2Response v2.0.0                         ║
║  OpenAI Responses API → Chat Completions Bridge        ║
╠════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                       ║
║  Health: http://localhost:${PORT}/health                ║
╠════════════════════════════════════════════════════════╣
║  Providers:                                            ║
${Object.entries(providers_1.PROVIDERS).map(([k, p]) => `║    ${k.padEnd(8)} - ${p.name.padEnd(15)} (tools: ${p.supportsTools ? '✓' : '✗'})`.padEnd(55) + '║').join('\n')}
╠════════════════════════════════════════════════════════╣
║  Codex Config:                                         ║
║  ~/.codex/config.toml:                                 ║
║  [model_providers.local]                               ║
║  base_url = "http://localhost:${PORT}/v1"              ║
╚════════════════════════════════════════════════════════╝
  `);
});
