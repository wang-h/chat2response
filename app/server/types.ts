// ============================================
// OpenAI Responses API Types
// ============================================

export interface ResponsesRequest {
  model: string;
  input: string | InputItem[];
  instructions?: string;
  tools?: Tool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  store?: boolean;
  user?: string;
  [key: string]: unknown;
}

export interface InputItem {
  type: 'message' | 'function_call' | 'function_call_output' | 'reasoning';
  role?: 'user' | 'assistant' | 'system' | 'developer';
  content?: string | ContentPart[];
  name?: string;
  arguments?: string;
  call_id?: string;
  output?: string;
  summary?: SummaryPart[];
  encrypted_content?: string;
}

export interface ContentPart {
  type: 'input_text' | 'input_image' | 'input_file' | 'output_text' | 'refusal';
  text?: string;
  image_url?: string;
  file_url?: string;
  detail?: 'auto' | 'low' | 'high';
}

export interface SummaryPart {
  type: 'summary_text';
  text: string;
}

export interface Tool {
  type: 'function' | 'web_search' | 'code_interpreter' | 'file_search';
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

// ============================================
// Chat Completions API Types
// ============================================

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  user?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ChatTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ============================================
// Responses API Streaming Event Types
// ============================================

export type StreamEvent =
  | ResponseCreatedEvent
  | ResponseInProgressEvent
  | ResponseCompletedEvent
  | ResponseIncompleteEvent
  | ResponseFailedEvent
  | OutputItemAddedEvent
  | OutputItemDoneEvent
  | ContentPartAddedEvent
  | ContentPartDoneEvent
  | OutputTextDeltaEvent
  | OutputTextDoneEvent
  | FunctionCallArgumentsDeltaEvent
  | FunctionCallArgumentsDoneEvent;

export interface ResponseCreatedEvent {
  type: 'response.created';
  response: ResponseObject;
}

export interface ResponseInProgressEvent {
  type: 'response.in_progress';
  response: ResponseObject;
}

export interface ResponseCompletedEvent {
  type: 'response.completed';
  response: ResponseObject;
}

export interface ResponseIncompleteEvent {
  type: 'response.incomplete';
  response: ResponseObject;
}

export interface ResponseFailedEvent {
  type: 'response.failed';
  response: ResponseObject;
}

export interface OutputItemAddedEvent {
  type: 'response.output_item.added';
  output_index: number;
  item: OutputItem;
}

export interface OutputItemDoneEvent {
  type: 'response.output_item.done';
  output_index: number;
  item: OutputItem;
}

export interface ContentPartAddedEvent {
  type: 'response.content_part.added';
  item_id: string;
  output_index: number;
  content_index: number;
  part: ContentPart;
}

export interface ContentPartDoneEvent {
  type: 'response.content_part.done';
  item_id: string;
  output_index: number;
  content_index: number;
  part: ContentPart;
}

export interface OutputTextDeltaEvent {
  type: 'response.output_text.delta';
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
  logprobs?: LogProb[];
}

export interface OutputTextDoneEvent {
  type: 'response.output_text.done';
  item_id: string;
  output_index: number;
  content_index: number;
  text: string;
  logprobs?: LogProb[];
}

export interface FunctionCallArgumentsDeltaEvent {
  type: 'response.function_call_arguments.delta';
  item_id: string;
  output_index: number;
  delta: string;
}

export interface FunctionCallArgumentsDoneEvent {
  type: 'response.function_call_arguments.done';
  item_id: string;
  output_index: number;
  arguments: string;
}

export interface LogProb {
  token: string;
  logprob: number;
  bytes: number[];
}

// ============================================
// Response Object Types
// ============================================

export interface ResponseObject {
  id: string;
  object: 'response';
  created_at: number;
  model: string;
  status: 'queued' | 'in_progress' | 'completed' | 'incomplete' | 'failed';
  error?: ErrorObject;
  incomplete_details?: IncompleteDetails;
  input: InputItem[];
  output: OutputItem[];
  usage?: Usage;
}

export interface OutputItem {
  id: string;
  type: 'message' | 'function_call' | 'reasoning';
  role?: 'assistant';
  content?: ContentPart[];
  name?: string;
  arguments?: string;
  call_id?: string;
}

export interface ErrorObject {
  code: string;
  message: string;
  param?: string;
}

export interface IncompleteDetails {
  reason: 'max_tokens' | 'content_filter';
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

// ============================================
// Provider Types
// ============================================

export type ProviderName = 'glm' | 'kimi' | 'deepseek' | 'minimax';

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  defaultModel: string;
  supportsTools: boolean;
  supportsStreaming: boolean;
  transformRequest?: (req: ChatCompletionRequest) => ChatCompletionRequest;
  transformResponse?: (res: unknown) => unknown;
}

// ============================================
// Chat Completion Chunk Types (for streaming)
// ============================================

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChunkChoice[];
  usage?: Usage;
}

export interface ChunkChoice {
  index: number;
  delta: DeltaMessage;
  finish_reason: string | null;
  logprobs?: unknown;
}

export interface DeltaMessage {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: ToolCall[];
}
