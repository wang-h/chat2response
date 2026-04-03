"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS = void 0;
exports.getProvider = getProvider;
exports.getCurrentProvider = getCurrentProvider;
exports.getApiKey = getApiKey;
exports.transformRequest = transformRequest;
exports.isProviderSupported = isProviderSupported;
exports.mapModelName = mapModelName;
exports.PROVIDERS = {
    glm: {
        name: 'GLM',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        defaultModel: 'glm-5',
        supportsTools: false, // GLM does not support function calling well
        supportsStreaming: true,
        transformRequest: (req) => {
            // GLM doesn't support tools, so we remove them
            if (req.tools?.length) {
                console.log('[GLM] Removing unsupported tools:', req.tools.length);
            }
            const transformed = {
                ...req,
                // GLM uses a different model naming convention
                model: req.model?.startsWith('glm-') ? req.model : 'glm-5',
            };
            // Remove tool-related fields
            delete transformed.tools;
            delete transformed.tool_choice;
            // Flatten messages to simple text format for GLM
            if (transformed.messages) {
                transformed.messages = transformed.messages.map(msg => ({
                    role: msg.role,
                    content: typeof msg.content === 'string'
                        ? msg.content
                        : JSON.stringify(msg.content),
                }));
            }
            return transformed;
        },
    },
    kimi: {
        name: 'Kimi',
        baseUrl: 'https://api.moonshot.cn/v1', // Kimi standard API endpoint
        defaultModel: 'kimi-coding', // Kimi for Coding model
        supportsTools: true, // Kimi supports function calling
        supportsStreaming: true,
        transformRequest: (req) => {
            // Kimi has specific requirements for tool schemas
            const transformed = { ...req };
            if (transformed.tools) {
                transformed.tools = transformed.tools.map(tool => ({
                    ...tool,
                    function: {
                        ...tool.function,
                        // Ensure parameters has required fields
                        parameters: {
                            type: 'object',
                            properties: {},
                            required: [],
                            ...tool.function.parameters,
                        },
                    },
                }));
            }
            // Convert model name to Kimi format if needed
            if (!transformed.model?.includes('kimi')) {
                transformed.model = 'kimi-coding';
            }
            return transformed;
        },
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        supportsTools: true,
        supportsStreaming: true,
        // DeepSeek follows OpenAI format closely, minimal transformation needed
        transformRequest: (req) => {
            // DeepSeek doesn't support some OpenAI-specific parameters
            const transformed = { ...req };
            // Remove unsupported fields
            delete transformed['store'];
            // Use DeepSeek model if not specified
            if (!transformed.model?.startsWith('deepseek')) {
                transformed.model = 'deepseek-chat';
            }
            return transformed;
        },
    },
    minimax: {
        name: 'MiniMax',
        baseUrl: 'https://api.minimax.chat/v1', // 国内版 API
        defaultModel: 'minimax-2.7',
        supportsTools: true,
        supportsStreaming: true,
        transformRequest: (req) => {
            const transformed = { ...req };
            // MiniMax uses different model naming
            if (!transformed.model?.includes('minimax')) {
                transformed.model = 'minimax-2.7';
            }
            // MiniMax requires specific message format
            if (transformed.messages) {
                transformed.messages = transformed.messages.map(msg => {
                    // Ensure content is always a string
                    const content = typeof msg.content === 'string'
                        ? msg.content
                        : JSON.stringify(msg.content);
                    return {
                        ...msg,
                        content,
                    };
                });
            }
            return transformed;
        },
    },
};
function getProvider(name) {
    const provider = exports.PROVIDERS[name];
    if (!provider) {
        throw new Error(`Unknown provider: ${name}`);
    }
    return provider;
}
function getCurrentProvider() {
    const defaultProvider = process.env.DEFAULT_PROVIDER || 'deepseek';
    return getProvider(defaultProvider);
}
function getApiKey(providerName) {
    const envVar = `${providerName.toUpperCase()}_API_KEY`;
    const apiKey = process.env[envVar];
    if (!apiKey) {
        throw new Error(`Missing API key for ${providerName}. Set ${envVar} environment variable.`);
    }
    return apiKey;
}
function transformRequest(providerName, request) {
    const provider = getProvider(providerName);
    if (provider.transformRequest) {
        return provider.transformRequest(request);
    }
    return request;
}
function isProviderSupported(name) {
    return name in exports.PROVIDERS;
}
// Helper to convert model names between providers
function mapModelName(model, targetProvider) {
    // If the model already belongs to the target provider, return as-is
    if (targetProvider === 'glm' && model.startsWith('glm-'))
        return model;
    if (targetProvider === 'kimi' && model.startsWith('kimi-'))
        return model;
    if (targetProvider === 'deepseek' && model.startsWith('deepseek-'))
        return model;
    if (targetProvider === 'minimax' && model.startsWith('abab'))
        return model;
    // Otherwise return the default model for the provider
    return exports.PROVIDERS[targetProvider].defaultModel;
}
