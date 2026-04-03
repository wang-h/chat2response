// Lightweight verification script for provider transforms
const { transformRequest } = require('./dist/providers');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test GLM preserves tool_call_id for role: 'tool' messages
const glmResult = transformRequest('glm', {
  model: 'glm-5',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'tool', content: '{"result": 42}', tool_call_id: 'call_123' },
  ],
});

const glmToolMessage = glmResult.messages.find(m => m.role === 'tool');
assert(glmToolMessage, 'GLM should preserve tool message');
assert(glmToolMessage.tool_call_id === 'call_123', `GLM should preserve tool_call_id, got: ${glmToolMessage.tool_call_id}`);
console.log('✓ GLM preserves tool_call_id');

// Test MiniMax preserves tool_call_id for role: 'tool' messages
const minimaxResult = transformRequest('minimax', {
  model: 'minimax-2.7',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'tool', content: '{"result": 42}', tool_call_id: 'call_456' },
  ],
});

const minimaxToolMessage = minimaxResult.messages.find(m => m.role === 'tool');
assert(minimaxToolMessage, 'MiniMax should preserve tool message');
assert(minimaxToolMessage.tool_call_id === 'call_456', `MiniMax should preserve tool_call_id, got: ${minimaxToolMessage.tool_call_id}`);
console.log('✓ MiniMax preserves tool_call_id');

// Test Kimi model matching uses startsWith
const kimiResult = transformRequest('kimi', {
  model: 'my-kimi-model',
  messages: [{ role: 'user', content: 'Hello' }],
});
assert(kimiResult.model === 'kimi-coding', `Kimi should reset model that does not start with 'kimi', got: ${kimiResult.model}`);

const kimiResult2 = transformRequest('kimi', {
  model: 'kimi-latest',
  messages: [{ role: 'user', content: 'Hello' }],
});
assert(kimiResult2.model === 'kimi-latest', `Kimi should keep model that starts with 'kimi', got: ${kimiResult2.model}`);
console.log('✓ Kimi model matching is strict');

console.log('\nAll transform tests passed!');
