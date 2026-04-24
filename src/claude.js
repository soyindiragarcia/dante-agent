import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TOOLS = [
  {
    name: 'create_task',
    description: 'Crea una tarea en ClickUp en el inbox de DANTE. Úsala cuando el usuario quiera crear una tarea, recordatorio, o acción pendiente. Genera un nombre claro y una descripción detallada con todo el contexto necesario.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Título corto y claro de la tarea' },
        description: { type: 'string', description: 'Descripción detallada. Si es un correo, incluye el borrador completo. Si es una llamada, incluye los puntos a tratar.' },
        due_date: { type: 'string', description: 'Fecha de vencimiento en formato ISO (opcional). Ej: 2026-04-25' },
      },
      required: ['name', 'description'],
    },
  },
  {
    name: 'search_notion',
    description: 'Busca páginas o bases de datos en Notion de Indira. Úsala cuando pregunte por algo que puede estar en Notion.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar en Notion' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_notion_page',
    description: 'Crea una nueva página en Notion. Úsala cuando el usuario quiera guardar notas, reuniones, ideas o cualquier contenido en Notion.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título de la entrada' },
        content: { type: 'string', description: 'Descripción o contenido detallado' },
        due_date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD (opcional)' },
        priority: { type: 'string', description: 'Prioridad: Alta, Media, o Baja (opcional)' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'update_notion_page',
    description: 'Edita una página o entrada existente en Notion. Primero usa search_notion para encontrar el ID de la página, luego usa este tool para editarla. Puedes cambiar título, descripción, estado, prioridad, fecha o proyecto.',
    input_schema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'ID de la página a editar (obtenido de search_notion)' },
        title: { type: 'string', description: 'Nuevo título (opcional)' },
        description: { type: 'string', description: 'Nueva descripción (opcional)' },
        status: { type: 'string', description: 'Nuevo estado: Inbox, En proceso, Completada (opcional)' },
        priority: { type: 'string', description: 'Nueva prioridad: Alta, Media, Baja, Urgente (opcional)' },
        due_date: { type: 'string', description: 'Nueva fecha en formato YYYY-MM-DD (opcional)' },
        project_name: { type: 'string', description: 'Nombre del proyecto a asignar en Proyectos (opcional)' },
        resource_name: { type: 'string', description: 'Nombre del recurso a asignar en Recursos (opcional). Ej: CANVA, GPTS, Prompts' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'save_memory',
    description: 'Guarda información importante sobre Indira para recordar en el futuro. Úsala cuando el usuario diga "recuerda que...", "anota que...", o comparte info personal importante.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Categoría o etiqueta de la memoria (ej: preferencia, proyecto, contacto, dato_personal)' },
        value: { type: 'string', description: 'El contenido a recordar' },
      },
      required: ['key', 'value'],
    },
  },
];

export async function processWithClaude(userMessage, memories = [], onToolCall = null) {
  const memoryContext = memories.length > 0
    ? `\n\nContexto de conversaciones anteriores relevantes:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
    : '';

  const systemPrompt = `Eres DANTE, asistente de IA personal de Indira García. Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

CAPACIDADES REALES:
- Ver las tareas reales de ClickUp de Indira (se pasan en el mensaje si hay)
- Crear tareas en ClickUp usando la herramienta create_task
- Guardar información importante usando save_memory
- Recordar contexto de conversaciones anteriores

CUÁNDO USAR HERRAMIENTAS:
- create_task: cuando el usuario quiera crear una tarea en ClickUp
- search_notion: cuando el usuario pregunte algo que puede estar en Notion, o antes de editar
- update_notion_page: después de search_notion, para editar la página encontrada
- create_notion_page: cuando el usuario quiera crear algo nuevo en Notion
- save_memory: cuando el usuario diga "recuerda que..." o comparta info personal importante

REGLAS CRÍTICAS:
- Responde SIEMPRE en español natural y conversacional
- NUNCA muestres código ni procesos técnicos
- NUNCA inventes datos — usa solo lo que se te proporciona
- Si el usuario pide editar algo en Notion: PRIMERO busca con search_notion, LUEGO edita con update_notion_page
- NO menciones ClickUp si el usuario está hablando de Notion o algo diferente
- Sé directo y accionable — confirma cuando hagas algo${memoryContext}`;

  const messages = [{ role: 'user', content: userMessage }];
  let totalTokens = 0;
  const MAX_TOOL_CALLS = 6;
  let toolCallCount = 0;

  try {
    let response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
    totalTokens += response.usage.input_tokens + response.usage.output_tokens;

    // Loop agentivo: permite múltiples tool calls en secuencia
    while (response.stop_reason === 'tool_use' && toolCallCount < MAX_TOOL_CALLS) {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUseBlock of toolUseBlocks) {
        toolCallCount++;
        console.log(`🔧 Tool call ${toolCallCount}: ${toolUseBlock.name}`);
        let toolResult = null;

        if (onToolCall) {
          try {
            toolResult = await onToolCall(toolUseBlock.name, toolUseBlock.input);
          } catch (err) {
            toolResult = { error: err.message };
          }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult || { error: 'No se pudo ejecutar' }),
        });
      }

      // Añadir respuesta del asistente y resultados al historial
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      // Llamar a Claude de nuevo con los resultados
      response = await client.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });
      totalTokens += response.usage.input_tokens + response.usage.output_tokens;
    }

    const text = response.content.find(b => b.type === 'text');
    return {
      content: text?.text || '✅ Hecho.',
      tokens: totalTokens,
    };

  } catch (error) {
    console.error('Claude error:', error.message);
    throw error;
  }
}

export function generateEmbedding(text) {
  const vector = new Array(1536).fill(0);
  for (let i = 0; i < text.length; i++) {
    vector[i % 1536] += text.charCodeAt(i) / 1000;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
}
