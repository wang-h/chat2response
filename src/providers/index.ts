import type { ProviderConfig, ProviderName, ChatCompletionRequest } from '../types';

export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  glm: {
    name: 'GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.6',
    supportsTools: false, // GLM does not support function calling well
    supportsStreaming: true,
    transformRequest: (req: ChatCompletionRequest): ChatCompletionRequest => {
      // GLM doesn't support tools, so we remove them
      if (req.tools?.length) {
        console.log('[GLM] Removing unsupported tools:', req.tools.length);
      }
      
      const transformed: ChatCompletionRequest = {
        ...req,
        // GLM uses a different model naming convention
        model: req.model.startsWith('glm-') ? req.model : 'glm-4.6',
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
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2-0711-preview', // Updated to latest model
    supportsTools: true, // Kimi supports function calling
    supportsStreaming: true,
    transformRequest: (req: ChatCompletionRequest): ChatCompletionRequest => {
      // Kimi has specific requirements for tool schemas
      const transformed: ChatCompletionRequest = { ...req };
      
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
      if (!transformed.model?.startsWith('kimi-')) {
        transformed.model = 'kimi-k2-0711-preview';
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
    transformRequest: (req: ChatCompletionRequest): ChatCompletionRequest => {
      // DeepSeek doesn't support some OpenAI-specific parameters
      const transformed: ChatCompletionRequest = { ...req };
      
      // Remove unsupported fields
      delete (transformed as Record<string, unknown>)['store'];
      
      // Use DeepSeek model if not specified
      if (!transformed.model?.startsWith('deepseek-')) {
        transformed.model = 'deepseek-chat';
      }
      
      return transformed;
    },
  },
  
  minimax: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.chat/v1',
    defaultModel: 'abab6.5s-chat',
    supportsTools: true,
    supportsStreaming: true,
    transformRequest: (req: ChatCompletionRequest): ChatCompletionRequest => {
      const transformed: ChatCompletionRequest = { ...req };
      
      // MiniMax uses different model naming
      if (!transformed.model?.startsWith('abab')) {
        transformed.model = 'abab6.5s-chat';
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

export function getProvider(name: ProviderName): ProviderConfig {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export function getCurrentProvider(): ProviderConfig {
  const defaultProvider = (process.env.DEFAULT_PROVIDER as ProviderName) || 'deepseek';
  return getProvider(defaultProvider);
}

export function getApiKey(providerName: ProviderName): string {
  const envVar = `${providerName.toUpperCase()}_API_KEY`;
  const apiKey = process.env[envVar];
  
  if (!apiKey) {
    throw new Error(`Missing API key for ${providerName}. Set ${envVar} environment variable.`);
  }
  
  return apiKey;
}

export function transformRequest(
  providerName: ProviderName,
  request: ChatCompletionRequest
): ChatCompletionRequest {
  const provider = getProvider(providerName);
  
  if (provider.transformRequest) {
    return provider.transformRequest(request);
  }
  
  return request;
}

export function isProviderSupported(name: string): name is ProviderName {
  return name in PROVIDERS;
}

// Helper to convert model names between providers
export function mapModelName(model: string, targetProvider: ProviderName): string {
  // If the model already belongs to the target provider, return as-is
  if (targetProvider === 'glm' && model.startsWith('glm-')) return model;
  if (targetProvider === 'kimi' && model.startsWith('kimi-')) return model;
  if (targetProvider === 'deepseek' && model.startsWith('deepseek-')) return model;
  if (targetProvider === 'minimax' && model.startsWith('abab')) return model;
  
  // Otherwise return the default model for the provider
  return PROVIDERS[targetProvider].defaultModel;
}
