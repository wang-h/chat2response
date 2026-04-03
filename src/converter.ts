import { v4 as uuidv4 } from 'uuid';
import type {
  ResponsesRequest,
  ChatCompletionRequest,
  ChatMessage,
  InputItem,
  ContentPart,
  Tool,
  ChatTool,
  OutputItem,
  ResponseObject,
  StreamEvent,
  ChatCompletionChunk,
  ToolCall,
} from './types';

const DEBUG = process.env.DEBUG === 'true';

function debug(...args: unknown[]) {
  if (DEBUG) {
    console.log('[Converter]', ...args);
  }
}

// ============================================
// Request Conversion: Responses API → Chat Completions
// ============================================

export function convertResponsesToChat(body: ResponsesRequest): ChatCompletionRequest {
  const { model, input, instructions, tools, tool_choice, stream, temperature, max_tokens, top_p, user } = body;
  
  // Convert input to messages
  const messages: ChatMessage[] = [];
  
  if (typeof input === 'string') {
    // Simple string input
    messages.push({ role: 'user', content: input });
  } else if (Array.isArray(input)) {
    // Complex input items
    for (const item of input) {
      const msg = convertInputItemToMessage(item);
      if (msg) messages.push(msg);
    }
  }
  
  // Add system instructions if provided
  if (instructions) {
    messages.unshift({ role: 'system', content: instructions });
  }
  
  // Convert tools
  const chatTools: ChatTool[] | undefined = tools?.map(convertTool);
  
  return {
    model,
    messages,
    tools: chatTools,
    tool_choice: tool_choice as ChatCompletionRequest['tool_choice'],
    stream: stream ?? true,
    temperature,
    max_tokens,
    top_p,
    user,
  };
}

function convertInputItemToMessage(item: InputItem): ChatMessage | null {
  switch (item.type) {
    case 'message':
      if (item.role === 'system' || item.role === 'developer') {
        return {
          role: 'system',
          content: extractTextContent(item.content),
        };
      }
      if (item.role === 'user') {
        return {
          role: 'user',
          content: extractTextContent(item.content),
        };
      }
      if (item.role === 'assistant') {
        return {
          role: 'assistant',
          content: extractTextContent(item.content),
        };
      }
      break;
    
    case 'function_call_output':
      return {
        role: 'tool',
        content: item.output || '',
        tool_call_id: item.call_id || '',
      };
    
    case 'function_call':
      // This is typically part of an assistant message, handled separately
      return null;
    
    case 'reasoning':
      // Reasoning items are not sent to the model directly
      return null;
    
    default:
      debug('Unknown input item type:', (item as InputItem).type);
      return null;
  }
  return null;
}

function extractTextContent(content: string | ContentPart[] | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  
  return content
    .filter((part): part is ContentPart & { type: 'input_text' | 'output_text' } => 
      part.type === 'input_text' || part.type === 'output_text'
    )
    .map(part => part.text || '')
    .join('');
}

function convertTool(tool: Tool): ChatTool {
  // Handle built-in tools (web_search, code_interpreter, file_search)
  // Convert them to function calls for compatibility
  if (tool.type === 'web_search' || tool.type === 'code_interpreter' || tool.type === 'file_search') {
    return {
      type: 'function',
      function: {
        name: tool.name || tool.type,
        description: tool.description || `${tool.type} tool`,
        parameters: tool.parameters || {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
          },
          required: ['query'],
        },
      },
    };
  }
  
  // Standard function tool
  if (tool.function) {
    return {
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description || '',
        parameters: tool.function.parameters || { type: 'object', properties: {} },
      },
    };
  }
  
  // Fallback for simple tool definitions
  return {
    type: 'function',
    function: {
      name: tool.name || 'unknown_tool',
      description: tool.description || '',
      parameters: tool.parameters || { type: 'object', properties: {} },
    },
  };
}

// ============================================
// Stream Conversion: Chat Completions → Responses API
// ============================================

interface StreamState {
  responseId: string;
  outputItemId: string;
  outputIndex: number;
  contentIndex: number;
  fullText: string;
  isFirstChunk: boolean;
  isOutputItemAdded: boolean;
  isContentPartAdded: boolean;
  isCompleted: boolean;
  currentToolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
}

export function createStreamState(model: string): StreamState {
  return {
    responseId: `resp_${uuidv4().replace(/-/g, '')}`,
    outputItemId: `msg_${uuidv4().replace(/-/g, '')}`,
    outputIndex: 0,
    contentIndex: 0,
    fullText: '',
    isFirstChunk: true,
    isOutputItemAdded: false,
    isContentPartAdded: false,
    isCompleted: false,
  };
}

export function createInitialResponseObject(
  state: StreamState,
  model: string,
  input: ResponsesRequest['input']
): ResponseObject {
  return {
    id: state.responseId,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    model,
    status: 'in_progress',
    input: typeof input === 'string' ? [{ type: 'message', role: 'user', content: input }] : input,
    output: [],
  };
}

// ============================================
// Event Creation Functions
// ============================================

export function createResponseCreatedEvent(response: ResponseObject): StreamEvent {
  return {
    type: 'response.created',
    response: { ...response, status: 'in_progress' },
  };
}

export function createResponseInProgressEvent(response: ResponseObject): StreamEvent {
  return {
    type: 'response.in_progress',
    response,
  };
}

export function createOutputItemAddedEvent(state: StreamState): StreamEvent {
  const item: OutputItem = {
    id: state.outputItemId,
    type: 'message',
    role: 'assistant',
    content: [],
  };
  
  return {
    type: 'response.output_item.added',
    output_index: state.outputIndex,
    item,
  };
}

export function createContentPartAddedEvent(state: StreamState): StreamEvent {
  return {
    type: 'response.content_part.added',
    item_id: state.outputItemId,
    output_index: state.outputIndex,
    content_index: state.contentIndex,
    part: { type: 'output_text', text: '' },
  };
}

export function createOutputTextDeltaEvent(state: StreamState, delta: string): StreamEvent {
  return {
    type: 'response.output_text.delta',
    item_id: state.outputItemId,
    output_index: state.outputIndex,
    content_index: state.contentIndex,
    delta,
  };
}

export function createOutputTextDoneEvent(state: StreamState): StreamEvent {
  return {
    type: 'response.output_text.done',
    item_id: state.outputItemId,
    output_index: state.outputIndex,
    content_index: state.contentIndex,
    text: state.fullText,
  };
}

export function createContentPartDoneEvent(state: StreamState): StreamEvent {
  return {
    type: 'response.content_part.done',
    item_id: state.outputItemId,
    output_index: state.outputIndex,
    content_index: state.contentIndex,
    part: { type: 'output_text', text: state.fullText },
  };
}

export function createOutputItemDoneEvent(state: StreamState): StreamEvent {
  const item: OutputItem = {
    id: state.outputItemId,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: state.fullText }],
  };
  
  return {
    type: 'response.output_item.done',
    output_index: state.outputIndex,
    item,
  };
}

export function createResponseCompletedEvent(
  state: StreamState,
  model: string,
  input: ResponsesRequest['input'],
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number }
): StreamEvent {
  const outputItem: OutputItem = {
    id: state.outputItemId,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: state.fullText }],
  };
  
  const response: ResponseObject = {
    id: state.responseId,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    model,
    status: 'completed',
    input: typeof input === 'string' ? [{ type: 'message', role: 'user', content: input }] : input,
    output: [outputItem],
    usage,
  };
  
  return {
    type: 'response.completed',
    response,
  };
}

function formatSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// ============================================
// Main Stream Processing
// ============================================

export async function* streamChatToResponses(
  stream: ReadableStream<Uint8Array>,
  model: string,
  input: ResponsesRequest['input']
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const state = createStreamState(model);
  
  // Track buffer for incomplete lines
  let buffer = '';
  let responseObj: ResponseObject | null = null;
  let usage: { input_tokens: number; output_tokens: number; total_tokens: number } | undefined;
  
  // Helper function to send completion events
  const sendCompletionEvents = function* (): Generator<string> {
    if (!state.isCompleted && state.isOutputItemAdded) {
      // Send output_text.done
      if (state.fullText.length > 0) {
        yield formatSSE(createOutputTextDoneEvent(state));
      }
      
      // Send content_part.done
      if (state.isContentPartAdded) {
        yield formatSSE(createContentPartDoneEvent(state));
      }
      
      // Send output_item.done
      yield formatSSE(createOutputItemDoneEvent(state));
      
      // Send response.completed
      yield formatSSE(createResponseCompletedEvent(state, model, input, usage));
      state.isCompleted = true;
    }
  };
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Send completion events before ending
        yield* sendCompletionEvents();
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        
        const data = trimmed.slice(5).trim();
        
        if (data === '[DONE]') {
          // Stream complete, send final events
          yield* sendCompletionEvents();
          continue;
        }
        
        try {
          const chunk: ChatCompletionChunk = JSON.parse(data);
          
          // Send initial events on first chunk
          if (state.isFirstChunk) {
            state.isFirstChunk = false;
            responseObj = createInitialResponseObject(state, model, input);
            
            // 1. response.created
            yield formatSSE(createResponseCreatedEvent(responseObj));
            
            // 2. response.in_progress (optional but good for completeness)
            yield formatSSE(createResponseInProgressEvent(responseObj));
            
            // 3. response.output_item.added
            yield formatSSE(createOutputItemAddedEvent(state));
            state.isOutputItemAdded = true;
            
            // 4. response.content_part.added
            yield formatSSE(createContentPartAddedEvent(state));
            state.isContentPartAdded = true;
          }
          
          // Process the chunk
          if (chunk.choices && chunk.choices.length > 0) {
            const choice = chunk.choices[0];
            
            // Handle content delta
            let delta = choice.delta?.content;
            
            // Fallback to reasoning_content for reasoning models (e.g., GLM-4.6)
            if (!delta && (choice.delta as Record<string, string> | undefined)?.reasoning_content) {
              delta = (choice.delta as Record<string, string>).reasoning_content;
            }
            
            if (delta) {
              state.fullText += delta;
              
              // 5. response.output_text.delta
              yield formatSSE(createOutputTextDeltaEvent(state, delta));
            }
            
            // Handle tool calls
            if (choice.delta?.tool_calls) {
              for (const toolCall of choice.delta.tool_calls) {
                // Handle tool call initialization
                if (toolCall.id && toolCall.function?.name) {
                  state.currentToolCall = {
                    id: toolCall.id,
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments || '',
                  };
                } else if (toolCall.function?.arguments && state.currentToolCall) {
                  // Accumulate arguments
                  state.currentToolCall.arguments += toolCall.function.arguments;
                }
              }
            }
            
            // Capture usage if provided
            if (chunk.usage) {
              usage = {
                input_tokens: chunk.usage.input_tokens || 0,
                output_tokens: chunk.usage.output_tokens || 0,
                total_tokens: chunk.usage.total_tokens || 0,
              };
            }
            
            // Handle finish reason
            if (choice.finish_reason) {
              debug('Finish reason:', choice.finish_reason);
            }
          }
        } catch (e) {
          debug('Failed to parse chunk:', data, e);
        }
      }
    }
    
    // Send final events if not already sent
    yield* sendCompletionEvents();
    
    // Send [DONE]
    yield 'data: [DONE]\n\n';
    
  } finally {
    reader.releaseLock();
  }
}

// ============================================
// Non-streaming Response Conversion
// ============================================

export function convertChatToResponses(
  chatResponse: unknown,
  model: string,
  input: ResponsesRequest['input']
): ResponseObject {
  const chat = chatResponse as {
    id: string;
    choices: Array<{
      message: {
        content: string;
        tool_calls?: Array<{
          id: string;
          type: 'function';
          function: {
            name: string;
            arguments: string;
          };
        }>;
      };
      finish_reason: string;
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
  
  const message = chat.choices[0]?.message;
  const content = message?.content || '';
  const toolCalls = message?.tool_calls;
  
  const output: OutputItem[] = [];
  
  // Add text output
  if (content) {
    output.push({
      id: `msg_${uuidv4().replace(/-/g, '')}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: content }],
    });
  }
  
  // Add function call outputs
  if (toolCalls) {
    for (const toolCall of toolCalls) {
      output.push({
        id: toolCall.id,
        type: 'function_call',
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
        call_id: toolCall.id,
      });
    }
  }
  
  return {
    id: `resp_${uuidv4().replace(/-/g, '')}`,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    model,
    status: 'completed',
    input: typeof input === 'string' ? [{ type: 'message', role: 'user', content: input }] : input,
    output,
    usage: chat.usage ? {
      input_tokens: chat.usage.prompt_tokens,
      output_tokens: chat.usage.completion_tokens,
      total_tokens: chat.usage.total_tokens,
    } : undefined,
  };
}
