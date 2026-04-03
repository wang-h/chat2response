// Simple test script for streaming response format
const converter = require('./dist/converter');

async function testStreamConversion() {
  console.log('Testing stream conversion...\n');
  
  // Simulate a simple streaming response
  const mockStream = new ReadableStream({
    start(controller) {
      const chunks = [
        { id: '1', choices: [{ delta: { content: 'Hello', role: 'assistant' }, finish_reason: null }] },
        { id: '2', choices: [{ delta: { content: ' ' }, finish_reason: null }] },
        { id: '3', choices: [{ delta: { content: 'world!' }, finish_reason: null }] },
        { id: '4', choices: [{ delta: {}, finish_reason: 'stop' }] },
      ];
      
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  
  console.log('Events received:\n');
  console.log('='.repeat(60));
  
  const stream = converter.streamChatToResponses(mockStream, 'gpt-4', 'Test input');
  
  for await (const chunk of stream) {
    console.log(chunk.trim());
    console.log('-'.repeat(40));
  }
  
  console.log('='.repeat(60));
  console.log('\nTest completed!');
  console.log('\nExpected event sequence:');
  console.log('1. response.created');
  console.log('2. response.in_progress');
  console.log('3. response.output_item.added');
  console.log('4. response.content_part.added');
  console.log('5. response.output_text.delta (x3)');
  console.log('6. response.output_text.done');
  console.log('7. response.content_part.done');
  console.log('8. response.output_item.done');
  console.log('9. response.completed');
  console.log('10. [DONE]');
}

testStreamConversion().catch(console.error);
