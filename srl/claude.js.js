import axios from 'axios';

const openrouterClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export async function processWithClaude(userMessage, memories = []) {
  const systemPrompt = `Eres DANTE, asistente de IA de Indira García.

Tu función:
- Organizar su vida: tareas, recordatorios, prioridades
- Gestionar ClickUp, calendarios
- Recordar contexto y preferencias
- Responder en español, directo y útil

Sé conciso y accionable.`;

  try {
    const response = await openrouterClient.post('/chat/completions', {
      model: 'meta-llama/llama-3.1-8b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    return {
      content: response.data.choices[0].message.content,
      tokens: response.data.usage.total_tokens,
    };
  } catch (error) {
    console.error('OpenRouter error:', error.response?.data || error.message);
    throw error;
  }
}