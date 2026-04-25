import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const TOOLS = [
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
    name: 'get_calendar_bookings',
    description: 'Muestra las reuniones próximas de Indira en Cal.com. Úsala cuando pregunte por su agenda, reuniones, o qué tiene programado.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Cuántos días hacia adelante revisar (default 7)' },
      },
      required: [],
    },
  },
  {
    name: 'get_calendar_availability',
    description: 'Muestra la disponibilidad de Indira en Cal.com para agendar reuniones.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Cuántos días revisar (default 7)' },
      },
      required: [],
    },
  },
  {
    name: 'query_notion_database',
    description: 'Consulta una base de datos específica de Notion de Indira. Úsala para ver el contenido de Proyectos, Recursos, Temas, Áreas o Clientes.',
    input_schema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Cuál base de datos consultar: "proyectos", "recursos", "temas", "areas", "clientes"',
        },
        search: { type: 'string', description: 'Término de búsqueda opcional para filtrar resultados' },
      },
      required: ['database'],
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
  {
    name: 'get_all_calendars',
    description: 'Obtiene los eventos de TODOS los Google Calendars de Indira de una sola vez. Úsala cuando pregunte qué tiene esta semana, hoy, sus reuniones en general, o cuando no especifique una cuenta en particular.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Cuántos días hacia adelante revisar (default 7)' },
      },
      required: [],
    },
  },
  {
    name: 'get_google_calendar',
    description: 'Lee los eventos de UN Google Calendar específico de Indira. Úsala cuando mencione una cuenta concreta (ej: "mi calendario de propuestas", "el de obtenmasclientes").',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta a consultar (ej: "clientes", "personal", "empresa"). Si no especifica, usa "personal".' },
        days: { type: 'number', description: 'Cuántos días hacia adelante revisar (default 7)' },
      },
      required: ['account'],
    },
  },
  {
    name: 'create_google_event',
    description: 'Crea un evento en el Google Calendar de Indira. Úsala cuando quiera agendar una reunión, llamada, cita, o cualquier evento.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'En qué cuenta crear el evento (ej: "clientes", "personal", "empresa").' },
        title: { type: 'string', description: 'Título del evento' },
        description: { type: 'string', description: 'Descripción o notas (opcional)' },
        start_datetime: { type: 'string', description: 'Fecha y hora de inicio ISO. Ej: 2026-04-25T10:00:00' },
        end_datetime: { type: 'string', description: 'Fecha y hora de fin ISO. Ej: 2026-04-25T11:00:00' },
        attendees: { type: 'string', description: 'Emails de asistentes separados por coma (opcional)' },
        location: { type: 'string', description: 'Lugar o link del evento (opcional)' },
      },
      required: ['account', 'title', 'start_datetime', 'end_datetime'],
    },
  },
  {
    name: 'search_drive',
    description: 'Busca archivos en el Google Drive de Indira. Puede buscar en cualquiera de sus cuentas. Úsala cuando pregunte por documentos, archivos, presentaciones, hojas de cálculo, etc.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta de Drive a buscar (ej: "clientes", "personal", "empresa").' },
        query: { type: 'string', description: 'Texto a buscar en los nombres de archivos' },
      },
      required: ['account', 'query'],
    },
  },
  {
    name: 'read_drive_file',
    description: 'Lee el contenido de un archivo de Google Drive (Google Docs, Sheets, txt, etc.). Primero usa search_drive para encontrar el ID.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta' },
        file_id: { type: 'string', description: 'ID del archivo (obtenido de search_drive)' },
      },
      required: ['account', 'file_id'],
    },
  },
  {
    name: 'create_drive_doc',
    description: 'Crea un nuevo Google Doc en el Drive de Indira. Úsala cuando quiera crear un documento, actas de reunión, borradores, etc.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'En qué cuenta de Drive crear el documento' },
        title: { type: 'string', description: 'Título del documento' },
        content: { type: 'string', description: 'Contenido del documento' },
      },
      required: ['account', 'title', 'content'],
    },
  },
  {
    name: 'get_emails',
    description: 'Lee los emails recientes de una cuenta de Gmail de Indira. Úsala cuando pregunte por sus correos, emails recibidos, emails no leídos, etc.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta de Gmail (ej: "clientes", "personal", "empresa").' },
        max_results: { type: 'number', description: 'Cuántos emails traer (default 10)' },
        query: { type: 'string', description: 'Filtro de búsqueda Gmail (ej: "is:unread", "from:juan@email.com", "subject:presupuesto"). Default: inbox reciente.' },
      },
      required: ['account'],
    },
  },
  {
    name: 'read_email',
    description: 'Lee el contenido completo de un email específico. Primero usa get_emails para ver los IDs.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta' },
        message_id: { type: 'string', description: 'ID del mensaje (obtenido de get_emails)' },
      },
      required: ['account', 'message_id'],
    },
  },
  {
    name: 'send_email',
    description: 'Envía un email desde una cuenta de Gmail de Indira. Úsala cuando quiera responder o enviar un correo.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Desde qué cuenta enviar (ej: "clientes", "personal", "empresa").' },
        to: { type: 'string', description: 'Email del destinatario' },
        subject: { type: 'string', description: 'Asunto del correo' },
        body: { type: 'string', description: 'Cuerpo del correo' },
      },
      required: ['account', 'to', 'subject', 'body'],
    },
  },
  {
    name: 'count_emails',
    description: 'Cuenta cuántos emails hay en una cuenta de Gmail con un filtro dado. Úsala ANTES de borrar para mostrar cuántos hay y pedir confirmación.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta' },
        query: { type: 'string', description: 'Filtro Gmail. Ej: "from:facebookmail.com", "category:social", "from:twitter.com OR from:instagram.com"' },
      },
      required: ['account', 'query'],
    },
  },
  {
    name: 'trash_emails_bulk',
    description: 'Elimina permanentemente emails en masa que coincidan con un filtro. IMPORTANTE: Siempre llama count_emails primero y confirma con el usuario antes de usar esta herramienta.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta' },
        query: { type: 'string', description: 'Filtro Gmail para los emails a eliminar' },
        max_to_trash: { type: 'number', description: 'Máximo de emails a eliminar por llamada (default 500)' },
      },
      required: ['account', 'query'],
    },
  },
  {
    name: 'list_top_senders',
    description: 'Muestra los remitentes con más correos en el inbox. Úsala cuando quiera saber qué está llenando su correo o decidir qué limpiar.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta a analizar' },
      },
      required: ['account'],
    },
  },
  {
    name: 'list_drive_files',
    description: 'Lista los archivos de una carpeta del Drive de Indira con su tamaño. Úsala para ver qué hay en un Drive y decidir qué eliminar.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta de Drive' },
        folder_id: { type: 'string', description: 'ID de la carpeta (opcional, default: raíz)' },
      },
      required: ['account'],
    },
  },
  {
    name: 'set_reminder',
    description: 'Crea un recordatorio para enviarle un mensaje a Indira en una fecha y hora específica por Telegram. Úsala cuando diga "recuérdame", "avísame", "mándame un mensaje a las X". La hora es en Venezuela (UTC-4).',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'El mensaje del recordatorio. Sé descriptivo y útil. Ej: "Llamar a Juan para hablar del presupuesto"' },
        datetime: { type: 'string', description: 'Fecha y hora en Venezuela en formato ISO sin zona horaria. Ej: 2026-04-25T15:00:00' },
      },
      required: ['message', 'datetime'],
    },
  },
  {
    name: 'delete_drive_file',
    description: 'Mueve un archivo a la papelera de Google Drive (reversible, no elimina permanentemente). Úsala cuando el usuario quiera borrar un archivo específico.',
    input_schema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Nombre de la cuenta' },
        file_id: { type: 'string', description: 'ID del archivo a eliminar (obtenido de search_drive o list_drive_files)' },
      },
      required: ['account', 'file_id'],
    },
  },
];

// Parte estática del system prompt — se cachea entre requests (también exportado para Groq)
export const STATIC_SYSTEM = `Eres DANTE, asistente de IA personal de Indira García.

CAPACIDADES REALES:
- Ver las tareas reales de ClickUp de Indira (se pasan en el mensaje si hay)
- Crear tareas en ClickUp usando la herramienta create_task
- Ver y crear eventos en Google Calendar (5 cuentas de Google)
- Ver, analizar y describir imágenes que te envíen por Telegram (visión nativa)
- Ver agenda y disponibilidad en Cal.com
- Buscar, crear y editar páginas en Notion
- Guardar información importante usando save_memory
- Recordar contexto de conversaciones anteriores
- Leer y enviar emails de Gmail, limpiar correos en masa
- Buscar, leer, crear y eliminar archivos en Google Drive

CUÁNDO USAR HERRAMIENTAS:
- create_task: cuando el usuario quiera crear una tarea en ClickUp
- get_all_calendars: USA ESTA SIEMPRE que haya cualquier pregunta sobre calendario, agenda, reuniones, eventos, qué tiene hoy/mañana/esta semana/el martes. NUNCA asumas que no hay eventos sin haber llamado esta herramienta primero. Es OBLIGATORIO llamarla antes de responder cualquier cosa sobre agenda.
- get_google_calendar: SOLO si la usuaria menciona explícitamente una cuenta específica Y ya llamaste get_all_calendars.
- create_google_event: cuando quiera agendar algo en Google Calendar
- search_drive: cuando pregunte por archivos, documentos, presentaciones en su Drive
- read_drive_file: después de search_drive, para leer el contenido de un archivo específico
- create_drive_doc: cuando quiera crear un documento en Drive
- list_drive_files: para ver el contenido de un Drive antes de limpiar
- delete_drive_file: para mover un archivo a la papelera del Drive
- get_emails: cuando pregunte por sus correos o emails recibidos
- read_email: para leer el contenido completo de un email específico
- send_email: cuando quiera enviar o responder un correo
- count_emails: SIEMPRE antes de borrar emails en masa — muestra cuántos hay
- trash_emails_bulk: elimina emails en masa. OBLIGATORIO llamar count_emails primero y confirmar con el usuario
- list_top_senders: cuando quiera saber qué está llenando su correo
- search_notion: cuando el usuario pregunte algo que puede estar en Notion, o antes de editar
- update_notion_page: después de search_notion, para editar la página encontrada
- create_notion_page: cuando el usuario quiera crear algo nuevo en Notion
- save_memory: cuando el usuario diga "recuerda que..." o comparta info personal importante
- set_reminder: cuando diga "recuérdame", "avísame a las X", "mándame un mensaje mañana a las Y". La hora siempre es en Venezuela (UTC-4). Confirma la hora exacta al usuario.

REGLAS CRÍTICAS:
- Responde SIEMPRE en español natural y conversacional
- NUNCA muestres código ni procesos técnicos
- NUNCA inventes datos — usa solo lo que se te proporciona
- Si el usuario pide editar algo en Notion: PRIMERO busca con search_notion, LUEGO edita con update_notion_page
- NO menciones ClickUp si el usuario está hablando de Notion o algo diferente
- Sé directo y accionable — confirma cuando hagas algo
- Para limpiar emails: SIEMPRE usa count_emails primero, muestra el número y pide confirmación antes de borrar`;

// Tools con cache en el último elemento
const TOOLS_CACHED = TOOLS.map((tool, i) =>
  i === TOOLS.length - 1 ? { ...tool, cache_control: { type: 'ephemeral' } } : tool
);

// Routing: elige el modelo según la complejidad de la tarea
const WRITING_KEYWORDS = [
  'escribe', 'redacta', 'borrador', 'propuesta', 'plantilla',
  'crea un correo', 'draft', 'carta', 'contrato', 'guion',
  'analiza en detalle', 'estrategia', 'plan completo', 'informe',
  'presentación', 'resumen ejecutivo', 'reporte',
];

export function needsClaudeModel(message, hasImage = null) {
  // Si la imagen llegó a Claude (fallback de Gemini) → necesita Claude Vision
  if (hasImage) return 'sonnet';

  const lower = (message || '').toLowerCase();
  const needsWriting = WRITING_KEYWORDS.some(kw => lower.includes(kw));

  if (needsWriting) return 'sonnet'; // Escritura compleja → Claude Sonnet
  return null; // Todo lo demás → Groq (gratis)
}

function selectModel(message, hasImage = null) {
  const claudeNeeded = needsClaudeModel(message, hasImage);
  if (claudeNeeded === 'sonnet') {
    console.log('✍️ Escritura compleja → claude-sonnet-4-5');
    return 'claude-sonnet-4-5';
  }
  return 'claude-haiku-4-5'; // fallback si llega aquí
}

export async function processWithClaude(userMessage, memories = [], onToolCall = null, imageData = null) {
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const memoryContext = memories.length > 0
    ? `\nContexto de conversaciones anteriores relevantes:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
    : '';

  // Parte dinámica (fecha + memorias) — no se cachea porque cambia
  const dynamicSystem = `Hoy es ${today}.${memoryContext}`;

  const userContent = imageData
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageData.mediaType, data: imageData.base64 } },
        { type: 'text', text: userMessage },
      ]
    : userMessage;

  const messages = [{ role: 'user', content: userContent }];
  let totalTokens = 0;
  let cacheHits = 0;
  const MAX_TOOL_CALLS = 10;
  let toolCallCount = 0;

  // System como array: parte estática cacheada + parte dinámica sin cache
  const systemBlocks = [
    { type: 'text', text: STATIC_SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamicSystem },
  ];

  const MODEL = selectModel(userMessage, imageData);

  try {
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemBlocks,
      tools: TOOLS_CACHED,
      messages,
    });
    totalTokens += response.usage.input_tokens + response.usage.output_tokens;
    cacheHits += response.usage.cache_read_input_tokens || 0;

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
        model: MODEL,
        max_tokens: 1024,
        system: systemBlocks,
        tools: TOOLS_CACHED,
        messages,
      });
      totalTokens += response.usage.input_tokens + response.usage.output_tokens;
      cacheHits += response.usage.cache_read_input_tokens || 0;
    }

    const text = response.content.find(b => b.type === 'text');
    if (cacheHits > 0) console.log(`💰 Cache hits: ${cacheHits} tokens ahorrados`);
    return {
      content: text?.text || '✅ Hecho.',
      tokens: totalTokens,
      cacheHits,
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
