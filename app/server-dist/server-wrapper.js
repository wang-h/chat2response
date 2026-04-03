const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import our converter modules (relative paths for when this file is in server-dist)
const { convertResponsesToChat, streamChatToResponses, convertChatToResponses } = require('./converter');
const { getCurrentProvider, getProvider, getApiKey, transformRequest, isProviderSupported, PROVIDERS } = require('./providers');

let server = null;
let app = null;

function createApp() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  // Health Check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'chat2response',
      version: '2.0.0',
      providers: Object.keys(PROVIDERS),
    });
  });

  // Models Endpoint
  app.get('/v1/models', async (req, res) => {
    try {
      const allModels = [];
      
      for (const [key, provider] of Object.entries(PROVIDERS)) {
        allModels.push({
          id: provider.defaultModel,
          object: 'model',
          created: Date.now(),
          owned_by: provider.name,
        });
      }
      
      res.json({
        object: 'list',
        data: allModels,
      });
    } catch (error) {
      res.status(500).json({
        error: {
          message: 'Failed to list models',
          type: 'internal_error',
        },
      });
    }
  });

  // Main Responses Endpoint
  app.post('/v1/responses', async (req, res) => {
    try {
      const body = req.body;
      
      // Get provider from request header or use default
      const providerHeader = req.headers['x-provider'];
      const providerName = 
        (isProviderSupported(providerHeader) ? providerHeader : null) ||
        process.env.DEFAULT_PROVIDER || 
        'deepseek';
      
      const provider = getProvider(providerName);
      const apiKey = getApiKey(providerName);
      
      // 1. Convert Responses API request to Chat Completions format
      let chatRequest = convertResponsesToChat(body);
      
      // 2. Apply provider-specific transformations
      chatRequest = transformRequest(providerName, chatRequest);
      
      // 3. Forward to provider
      const targetUrl = `${provider.baseUrl}/chat/completions`;
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(chatRequest),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          return res.status(response.status).json(errorJson);
        } catch {
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
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        if (!response.body) {
          throw new Error('No response body');
        }
        
        const stream = streamChatToResponses(response.body, chatRequest.model, body.input);
        
        try {
          for await (const chunk of stream) {
            res.write(chunk);
            if (res.writableEnded) break;
          }
          
          if (!res.writableEnded) {
            res.end();
          }
        } catch (streamError) {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ 
              type: 'response.failed',
              error: { message: String(streamError), code: 'stream_error' }
            })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
        }
      } else {
        const chatResponse = await response.json();
        const responsesOutput = convertChatToResponses(chatResponse, chatRequest.model, body.input);
        res.json(responsesOutput);
      }
      
    } catch (error) {
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

  // Chat Completions Pass-through
  app.post('/v1/chat/completions', async (req, res) => {
    try {
      const providerHeader = req.headers['x-provider'];
      const providerName = 
        (isProviderSupported(providerHeader) ? providerHeader : null) ||
        process.env.DEFAULT_PROVIDER || 
        'deepseek';
      
      const provider = getProvider(providerName);
      const apiKey = getApiKey(providerName);
      
      const transformedRequest = transformRequest(providerName, req.body);
      
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(transformedRequest),
      });
      
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      if (transformedRequest.stream && response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } finally {
          reader.releaseLock();
        }
      } else {
        const body = await response.text();
        res.status(response.status).send(body);
      }
    } catch (error) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : String(error),
          type: 'internal_error',
        },
      });
    }
  });

  return app;
}

async function startProxyServer(port = 3456) {
  if (server) {
    throw new Error('Server already running');
  }

  app = createApp();
  
  return new Promise((resolve, reject) => {
    server = app.listen(port, () => {
      console.log(`Chat2Response server running on port ${port}`);
      
      resolve({
        stop: () => {
          return new Promise((resolveStop) => {
            if (server) {
              server.close(() => {
                server = null;
                app = null;
                resolveStop();
              });
            } else {
              resolveStop();
            }
          });
        }
      });
    });
    
    server.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  startProxyServer,
  createApp
};
