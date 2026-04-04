"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertResponsesToChat = convertResponsesToChat;
exports.createStreamState = createStreamState;
exports.createInitialResponseObject = createInitialResponseObject;
exports.createResponseCreatedEvent = createResponseCreatedEvent;
exports.createResponseInProgressEvent = createResponseInProgressEvent;
exports.createOutputItemAddedEvent = createOutputItemAddedEvent;
exports.createReasoningOutputItemAddedEvent = createReasoningOutputItemAddedEvent;
exports.createReasoningDeltaEvent = createReasoningDeltaEvent;
exports.createContentPartAddedEvent = createContentPartAddedEvent;
exports.createOutputTextDeltaEvent = createOutputTextDeltaEvent;
exports.createOutputTextDoneEvent = createOutputTextDoneEvent;
exports.createContentPartDoneEvent = createContentPartDoneEvent;
exports.createOutputItemDoneEvent = createOutputItemDoneEvent;
exports.createResponseCompletedEvent = createResponseCompletedEvent;
exports.streamChatToResponses = streamChatToResponses;
exports.convertChatToResponses = convertChatToResponses;
const uuid_1 = require("uuid");
const DEBUG = process.env.DEBUG === 'true';
function debug(...args) {
    if (DEBUG) {
        console.log('[Converter]', ...args);
    }
}
// ============================================
// Request Conversion: Responses API → Chat Completions
// ============================================
function convertResponsesToChat(body) {
    const { model, input, instructions, tools, tool_choice, stream, temperature, max_tokens, top_p, user } = body;
    const messages = [];
    // Add system instructions if provided
    if (instructions) {
        messages.push({ role: 'system', content: instructions });
    }
    if (typeof input === 'string') {
        messages.push({ role: 'user', content: input });
    }
    else if (Array.isArray(input)) {
        let lastAssistantMsg = null;
        for (const item of input) {
            if (item.type === 'message') {
                const role = item.role === 'developer' ? 'system' : item.role;
                const msg = {
                    role: role,
                    content: extractTextContent(item.content),
                };
                if (role === 'assistant') {
                    lastAssistantMsg = msg;
                }
                else {
                    lastAssistantMsg = null;
                }
                messages.push(msg);
            }
            else if (item.type === 'function_call') {
                // If we have a function call, it MUST be attached to an assistant message
                const toolCall = {
                    id: item.call_id || `call_${(0, uuid_1.v4)().replace(/-/g, '')}`,
                    type: 'function',
                    function: {
                        name: item.name || '',
                        arguments: item.arguments || '{}',
                    },
                };
                if (lastAssistantMsg && lastAssistantMsg.role === 'assistant') {
                    if (!lastAssistantMsg.tool_calls)
                        lastAssistantMsg.tool_calls = [];
                    lastAssistantMsg.tool_calls.push(toolCall);
                }
                else {
                    // Create a new assistant message if none exists to hold the tool call
                    const msg = {
                        role: 'assistant',
                        content: '',
                        tool_calls: [toolCall],
                    };
                    lastAssistantMsg = msg;
                    messages.push(msg);
                }
            }
            else if (item.type === 'function_call_output') {
                messages.push({
                    role: 'tool',
                    content: item.output || '',
                    tool_call_id: item.call_id || '',
                });
                lastAssistantMsg = null;
            }
        }
    }
    // Convert tools
    const chatTools = tools?.map(convertTool);
    return {
        model,
        messages,
        tools: chatTools,
        tool_choice: tool_choice,
        stream: stream ?? true,
        temperature,
        max_tokens,
        top_p,
        user,
    };
}
function extractTextContent(content) {
    if (!content)
        return '';
    if (typeof content === 'string')
        return content;
    return content
        .filter((part) => part.type === 'input_text' || part.type === 'output_text')
        .map(part => part.text || '')
        .join('');
}
function convertTool(tool) {
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
function createStreamState(model) {
    return {
        responseId: `resp_${(0, uuid_1.v4)().replace(/-/g, '')}`,
        outputItemId: `msg_${(0, uuid_1.v4)().replace(/-/g, '')}`,
        outputIndex: 0,
        contentIndex: 0,
        fullText: '',
        reasoningText: '',
        isFirstChunk: true,
        isOutputItemAdded: false,
        isContentPartAdded: false,
        isReasoningAdded: false,
        isCompleted: false,
        completedToolCalls: [],
        toolCallOutputIndex: 1,
    };
}
function createInitialResponseObject(state, model, input) {
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
function createResponseCreatedEvent(response) {
    return {
        type: 'response.created',
        response: { ...response, status: 'in_progress' },
    };
}
function createResponseInProgressEvent(response) {
    return {
        type: 'response.in_progress',
        response,
    };
}
function createOutputItemAddedEvent(state) {
    const item = {
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
function createReasoningOutputItemAddedEvent(state) {
    const item = {
        id: `reason_${(0, uuid_1.v4)().replace(/-/g, '')}`,
        type: 'reasoning',
    };
    return {
        type: 'response.output_item.added',
        output_index: state.outputIndex++, // Reasoning is usually the first item
        item,
    };
}
function createReasoningDeltaEvent(state, delta) {
    return {
        type: 'response.output_text.delta', // Simplified: reuse output_text.delta for reasoning
        item_id: state.outputItemId, // Note: Simplified mapping
        output_index: state.outputIndex - 1,
        content_index: 0,
        delta,
    };
}
function createContentPartAddedEvent(state) {
    return {
        type: 'response.content_part.added',
        item_id: state.outputItemId,
        output_index: state.outputIndex,
        content_index: state.contentIndex,
        part: { type: 'output_text', text: '' },
    };
}
function createOutputTextDeltaEvent(state, delta) {
    return {
        type: 'response.output_text.delta',
        item_id: state.outputItemId,
        output_index: state.outputIndex,
        content_index: state.contentIndex,
        delta,
    };
}
function createOutputTextDoneEvent(state) {
    return {
        type: 'response.output_text.done',
        item_id: state.outputItemId,
        output_index: state.outputIndex,
        content_index: state.contentIndex,
        text: state.fullText,
    };
}
function createContentPartDoneEvent(state) {
    return {
        type: 'response.content_part.done',
        item_id: state.outputItemId,
        output_index: state.outputIndex,
        content_index: state.contentIndex,
        part: { type: 'output_text', text: state.fullText },
    };
}
function createOutputItemDoneEvent(state) {
    const item = {
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
function createResponseCompletedEvent(state, model, input, usage) {
    const output = [];
    // Add reasoning output item if exists
    if (state.isReasoningAdded) {
        output.push({
            id: `reason_${(0, uuid_1.v4)().replace(/-/g, '')}`,
            type: 'reasoning',
            content: [{ type: 'output_text', text: state.reasoningText }],
        });
    }
    // Add text output item
    if (state.fullText || !state.isReasoningAdded) {
        const outputItem = {
            id: state.outputItemId,
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: state.fullText }],
        };
        output.push(outputItem);
    }
    // Add tool call outputs
    for (const tc of state.completedToolCalls) {
        output.push({
            id: tc.id,
            type: 'function_call',
            name: tc.name,
            arguments: tc.arguments,
            call_id: tc.id,
        });
    }
    const response = {
        id: state.responseId,
        object: 'response',
        created_at: Math.floor(Date.now() / 1000),
        model,
        status: 'completed',
        input: typeof input === 'string' ? [{ type: 'message', role: 'user', content: input }] : input,
        output,
        usage,
    };
    return {
        type: 'response.completed',
        response,
    };
}
function createFunctionCallArgumentsDeltaEvent(outputIndex, itemId, delta) {
    return {
        type: 'response.function_call_arguments.delta',
        output_index: outputIndex,
        item_id: itemId,
        delta,
    };
}
function createFunctionCallArgumentsDoneEvent(outputIndex, itemId, arguments_) {
    return {
        type: 'response.function_call_arguments.done',
        output_index: outputIndex,
        item_id: itemId,
        arguments: arguments_,
    };
}
function createFunctionCallOutputItemAddedEvent(outputIndex, itemId, name) {
    const item = {
        id: itemId,
        type: 'function_call',
        name,
        arguments: '',
        call_id: itemId,
    };
    return {
        type: 'response.output_item.added',
        output_index: outputIndex,
        item,
    };
}
function createFunctionCallOutputItemDoneEvent(outputIndex, itemId, name, arguments_) {
    const item = {
        id: itemId,
        type: 'function_call',
        name,
        arguments: arguments_,
        call_id: itemId,
    };
    return {
        type: 'response.output_item.done',
        output_index: outputIndex,
        item,
    };
}
function formatSSE(event) {
    return `data: ${JSON.stringify(event)}\n\n`;
}
// ============================================
// Main Stream Processing
// ============================================
async function* streamChatToResponses(stream, model, input) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const state = createStreamState(model);
    // Track buffer for incomplete lines
    let buffer = '';
    let responseObj = null;
    let usage;
    // Helper function to send completion events
    const sendCompletionEvents = function* () {
        if (state.isCompleted)
            return;
        // Finalize any pending tool call
        if (state.currentToolCall) {
            state.completedToolCalls.push({ ...state.currentToolCall });
            state.currentToolCall = undefined;
        }
        // 1. Finalize Reasoning if added
        if (state.isReasoningAdded) {
            // We reuse the output_text.done logic or similar if needed for reasoning
            // For simplicity in current mapping, we just ensure the item is logically done
        }
        // 2. Finalize Message Output if added
        if (state.isOutputItemAdded) {
            if (state.fullText.length > 0) {
                yield formatSSE(createOutputTextDoneEvent(state));
            }
            if (state.isContentPartAdded) {
                yield formatSSE(createContentPartDoneEvent(state));
            }
            yield formatSSE(createOutputItemDoneEvent(state));
        }
        // 3. Finalize Tool Calls
        for (let i = 0; i < state.completedToolCalls.length; i++) {
            const tc = state.completedToolCalls[i];
            const tcOutputIndex = state.isReasoningAdded ? i + 2 : i + 1; // Adjust index if reasoning exists
            yield formatSSE(createFunctionCallArgumentsDoneEvent(tcOutputIndex, tc.id, tc.arguments));
            yield formatSSE(createFunctionCallOutputItemDoneEvent(tcOutputIndex, tc.id, tc.name, tc.arguments));
        }
        // 4. ALWAYS send response.completed
        yield formatSSE(createResponseCompletedEvent(state, model, input, usage));
        state.isCompleted = true;
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
                if (!trimmed || !trimmed.startsWith('data:'))
                    continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') {
                    // Stream complete, send final events
                    yield* sendCompletionEvents();
                    continue;
                }
                try {
                    const chunk = JSON.parse(data);
                    // Send initial events on first chunk
                    if (state.isFirstChunk) {
                        state.isFirstChunk = false;
                        responseObj = createInitialResponseObject(state, model, input);
                        // 1. response.created
                        yield formatSSE(createResponseCreatedEvent(responseObj));
                        // 2. response.in_progress
                        yield formatSSE(createResponseInProgressEvent(responseObj));
                    }
                    // Process the chunk
                    if (chunk.choices && chunk.choices.length > 0) {
                        const choice = chunk.choices[0];
                        const reasoningDelta = choice.delta?.reasoning_content;
                        if (reasoningDelta) {
                            if (!state.isReasoningAdded) {
                                state.isReasoningAdded = true;
                                yield formatSSE(createReasoningOutputItemAddedEvent(state));
                            }
                            state.reasoningText += reasoningDelta;
                            // For simplicity, we just send text deltas. 
                            // Codex might need it wrapped differently, but text.delta is usually fine.
                            yield formatSSE({
                                type: 'response.output_text.delta',
                                item_id: state.outputItemId,
                                output_index: state.outputIndex - 1,
                                content_index: 0,
                                delta: reasoningDelta,
                            });
                            continue; // Skip normal content processing if we're in reasoning
                        }
                        // Handle normal content delta
                        let delta = choice.delta?.content;
                        if (delta) {
                            // Ensure we have a message output item and content part if content starts
                            if (!state.isOutputItemAdded) {
                                yield formatSSE(createOutputItemAddedEvent(state));
                                state.isOutputItemAdded = true;
                                state.isContentPartAdded = true;
                                yield formatSSE(createContentPartAddedEvent(state));
                            }
                            state.fullText += delta;
                            // 5. response.output_text.delta
                            yield formatSSE(createOutputTextDeltaEvent(state, delta));
                        }
                        // Handle tool calls
                        if (choice.delta?.tool_calls) {
                            for (const toolCall of choice.delta.tool_calls) {
                                // Handle tool call initialization
                                if (toolCall.id && toolCall.function?.name) {
                                    // If there was a previous incomplete tool call, save it
                                    if (state.currentToolCall) {
                                        state.completedToolCalls.push({ ...state.currentToolCall });
                                    }
                                    state.currentToolCall = {
                                        id: toolCall.id,
                                        name: toolCall.function.name,
                                        arguments: toolCall.function.arguments || '',
                                    };
                                    // Emit output_item.added for this function call
                                    yield formatSSE(createFunctionCallOutputItemAddedEvent(state.toolCallOutputIndex++, state.currentToolCall.id, state.currentToolCall.name));
                                }
                                else if (toolCall.function?.arguments && state.currentToolCall) {
                                    // Accumulate arguments
                                    state.currentToolCall.arguments += toolCall.function.arguments;
                                    // Emit arguments delta
                                    yield formatSSE(createFunctionCallArgumentsDeltaEvent(state.toolCallOutputIndex - 1, state.currentToolCall.id, toolCall.function.arguments));
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
                            // Finalize current tool call if present
                            if (state.currentToolCall && choice.finish_reason === 'tool_calls') {
                                state.completedToolCalls.push({ ...state.currentToolCall });
                                state.currentToolCall = undefined;
                            }
                        }
                    }
                }
                catch (e) {
                    debug('Failed to parse chunk:', data, e);
                }
            }
        }
        // Send final events if not already sent
        yield* sendCompletionEvents();
        // Send [DONE]
        yield 'data: [DONE]\n\n';
    }
    finally {
        reader.releaseLock();
    }
}
// ============================================
// Non-streaming Response Conversion
// ============================================
function convertChatToResponses(chatResponse, model, input) {
    const chat = chatResponse;
    const message = chat.choices[0]?.message;
    let content = message?.content || '';
    const toolCalls = message?.tool_calls;
    // Support reasoning_content for reasoning models (e.g., GLM-5)
    const reasoningContent = message?.reasoning_content;
    if (!content && reasoningContent) {
        content = reasoningContent;
    }
    const output = [];
    // Add text output
    if (content) {
        output.push({
            id: `msg_${(0, uuid_1.v4)().replace(/-/g, '')}`,
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
        id: `resp_${(0, uuid_1.v4)().replace(/-/g, '')}`,
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
