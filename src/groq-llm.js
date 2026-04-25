import Groq from 'groq-sdk';
import { TOOLS, STATIC_SYSTEM } from './claude.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Convierte tools de formato Claude → formato OpenAI/Groq
function toOpenAITools(claudeTools) {
  return claudeTools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

export async function processWithGroq(userMessage, memories = [], onToolCall = null) {
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const memoryContext = memories.length > 0
    ? `\nContexto de conversaciones anteriores relevantes:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
    : '';

  const systemPrompt = `${STATIC_SYSTEM}\n\nHoy es ${today}.${memoryContext}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const tools = toOpenAITools(TOOLS);
  const MAX_TOOL_CALLS = 10;
  let toolCallCount = 0;

  try {
    let response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 2048,
      messages,
      tools,
      tool_choice: 'auto',
    });

    let msg = response.choices[0].message;

    // Loop agentivo
    while (msg.tool_calls?.length && toolCallCount < MAX_TOOL_CALLS) {
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });

      const toolResults = [];
      for (const toolCall of msg.tool_calls) {
        toolCallCount++;
        const toolName = toolCall.function.name;
        let toolInput = {};
        try { toolInput = JSON.parse(toolCall.function.arguments); } catch {}

        console.log(`🔧 Groq Tool call ${toolCallCount}: ${toolName}`);
        let toolResult = { error: 'No se pudo ejecutar' };

        if (onToolCall) {
          try {
            toolResult = await onToolCall(toolName, toolInput);
          } catch (err) {
            toolResult = { error: err.message };
          }
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      messages.push(...toolResults);

      response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 1024,
        messages,
        tools,
        tool_choice: 'auto',
      });

      msg = response.choices[0].message;
    }

    console.log(`⚡ Groq respondió (${GROQ_MODEL})`);
    return { content: msg.content || '✅ Hecho.', tokens: 0 };

  } catch (error) {
    console.error('Groq LLM error:', error.message);
    throw error;
  }
}
