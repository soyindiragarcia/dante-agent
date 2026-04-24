import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function processWithClaude(userMessage, memories = []) {
  const memoryContext = memories.length > 0
    ? `\n\nContexto de conversaciones anteriores:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
    : '';

  const systemPrompt = `Eres DANTE, asistente de IA personal de Indira García.

CAPACIDADES REALES (lo que SÍ puedes hacer):
- Ver y reportar las tareas reales de ClickUp de Indira (se te pasan en cada mensaje si las hay)
- Recordar contexto de conversaciones anteriores gracias a tu memoria semántica
- Ayudar a organizar, priorizar y planificar
- Redactar textos, emails, ideas

LIMITACIONES REALES (lo que NO puedes hacer):
- Crear o modificar tareas en ClickUp
- Acceder a calendario, email o Instagram
- Enviar notificaciones proactivas

REGLAS IMPORTANTES:
- Responde SIEMPRE en español natural y conversacional, sin markdown excesivo
- NUNCA muestres código, scripts, ni procesos técnicos
- NUNCA inventes tareas, datos o información — usa SOLO lo que aparece explícitamente en el mensaje
- Si el mensaje incluye "Tareas pendientes:", úsalas. Si no hay tareas, di "No tienes tareas pendientes actualmente"
- Sé directo, conciso y accionable${memoryContext}`;

  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: userMessage },
      ],
      system: systemPrompt,
    });

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    };
  } catch (error) {
    console.error('Claude error:', error.message);
    throw error;
  }
}

export async function generateEmbedding(text) {
  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Return a JSON object with an "embedding" array of 1536 numbers representing the semantic meaning of this text. Only return valid JSON, no other text.\n\nText: ${text}`,
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(content);
    return parsed.embedding || null;
  } catch (error) {
    console.error('Embedding error:', error.message);
    return null;
  }
}
