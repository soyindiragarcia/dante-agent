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

  // ── ClickUp: leer tareas y comentarios de agentes ─────────
  {
    name: 'search_tasks',
    description: 'Busca tareas en ClickUp por nombre o palabra clave. Úsala cuando el usuario pregunte por una tarea específica o quiera saber el estado de algo.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar en los nombres de tareas. Ej: "funnel cliente X", "propuesta Maria"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_task_details',
    description: 'Lee los detalles completos de una tarea de ClickUp: descripción, estado, asignados y fecha. Úsala cuando el usuario quiera saber qué hay en una tarea concreta.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID de la tarea en ClickUp (obtenido de search_tasks o create_task)' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'get_task_comments',
    description: 'Lee los comentarios de una tarea de ClickUp. Úsala para ver qué generó Julia (desglose de trabajo o QA) o Martha (propuesta comercial). Muestra el contenido de los comentarios de los agentes.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID de la tarea (obtenido de search_tasks o create_task)' },
      },
      required: ['task_id'],
    },
  },

  // ── Recordatorios recurrentes ──────────────────────────────
  {
    name: 'set_recurring_reminder',
    description: 'Crea un recordatorio recurrente: diario, semanal o mensual. Úsala para medicamentos, rutina de skincare, vitaminas, ejercicio, o cualquier hábito repetitivo. La hora siempre en Venezuela (UTC-4).',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Texto del recordatorio. Sé descriptivo. Ej: "Tomar Ibuprofeno 400mg con comida", "Aplicar crema humectante y SPF"' },
        frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Frecuencia: daily=todos los días, weekly=días específicos de la semana, monthly=una vez al mes en un día fijo' },
        time_ve: { type: 'string', description: 'Hora en Venezuela en formato HH:MM. Ej: "08:00", "21:30"' },
        days_of_week: { type: 'array', items: { type: 'number' }, description: 'Solo para frequency=weekly. Días de la semana: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb. Ej: [1,2,3,4,5] para lunes a viernes' },
        day_of_month: { type: 'number', description: 'Solo para frequency=monthly. Día del mes 1-31. Ej: 1 para el primer día de cada mes' },
      },
      required: ['message', 'frequency', 'time_ve'],
    },
  },
  {
    name: 'list_recurring_reminders',
    description: 'Muestra todos los recordatorios recurrentes activos de Indira (medicamentos, rutinas, etc.). Úsala cuando pregunte qué recordatorios tiene configurados.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'delete_recurring_reminder',
    description: 'Desactiva un recordatorio recurrente. Primero usa list_recurring_reminders para obtener el ID.',
    input_schema: {
      type: 'object',
      properties: {
        reminder_id: { type: 'string', description: 'ID del recordatorio a desactivar (UUID obtenido de list_recurring_reminders)' },
      },
      required: ['reminder_id'],
    },
  },

  // ── Ciclo menstrual ────────────────────────────────────────
  {
    name: 'log_period',
    description: 'Registra el inicio o fin del período menstrual de Indira. Úsala cuando diga "me llegó el período", "empezó", "se me fue", "terminó". Si no da fecha, usa hoy.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'end'], description: 'start = llegó el período / end = terminó el período' },
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD. Si no la menciona, usa la fecha de hoy.' },
        notes: { type: 'string', description: 'Síntomas o notas: dolor, flujo abundante, cólicos, etc. (opcional)' },
      },
      required: ['action', 'date'],
    },
  },
  {
    name: 'get_period_prediction',
    description: 'Muestra el historial del ciclo menstrual de Indira y predice cuándo llegará el próximo período. También indica si debería comprar analgésicos pronto.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ── Lista de compras en Notion ─────────────────────────────
  {
    name: 'add_to_shopping_list',
    description: 'Agrega un artículo a la lista de compras de Indira en Notion. Úsala SIEMPRE que diga que necesita comprar algo, que se le acabó algo, o que tiene que conseguir algo — medicamentos, skincare, comida, hogar, etc.',
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Nombre del artículo. Ej: "Ibuprofeno 400mg", "Crema SPF 50", "Proteína de suero"' },
        quantity: { type: 'string', description: 'Cantidad o especificaciones adicionales. Ej: "2 cajas", "250ml", "talla M" (opcional)' },
        category: { type: 'string', description: 'Categoría exacta como aparece en la lista de Notion. Ej: "Medicamentos", "Skincare", "Comida", "Hogar", "Personal". Si no estás seguro, omite para agregar al final.' },
      },
      required: ['item'],
    },
  },
  {
    name: 'get_shopping_list',
    description: 'Muestra la lista de compras pendientes de Indira guardada en Notion.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Parte estática del system prompt — se cachea entre requests (también exportado para Groq)
export const STATIC_SYSTEM = `Eres DANTE, asistente de IA personal de Indira García (venezolana, Studio Knecta).

CAPACIDADES REALES:
- Ver las tareas reales de ClickUp de Indira (se pasan en el mensaje si hay)
- Crear tareas en ClickUp usando la herramienta create_task
- Ver y crear eventos en Google Calendar (5 cuentas de Google)
- Ver, analizar y describir imágenes que te envíen por Telegram (visión nativa)
- Ver agenda y disponibilidad en Cal.com
- Buscar, crear y editar páginas en Notion (sistema PARA: Proyectos, Recursos, Temas, Áreas, Clientes, Inbox)
- Guardar información importante usando save_memory
- Recordar contexto de conversaciones anteriores
- Leer y enviar emails de Gmail, limpiar correos en masa
- Buscar, leer, crear y eliminar archivos en Google Drive
- Recordatorios puntuales (set_reminder) y recurrentes (set_recurring_reminder) — medicamentos, rutinas, hábitos
- Registro del ciclo menstrual con predicción del próximo período
- Lista de compras en Notion — cualquier cosa que mencione necesitar comprar

CUÁNDO USAR HERRAMIENTAS:
- create_task: cuando quiera crear una tarea en ClickUp. Siempre devuelve el link de la tarea creada.
- search_tasks: cuando pregunte por una tarea, quiera saber su estado, o necesite encontrar el ID de una tarea para leer sus comentarios
- get_task_details: para ver descripción y estado de una tarea específica
- get_task_comments: para leer lo que Julia (desglose/QA) o Martha (propuesta) generaron en una tarea. Úsala cuando pregunten "¿qué dijo Julia?", "¿ya tiene propuesta?", "¿cómo quedó el desglose?"
- get_all_calendars: USA ESTA SIEMPRE para cualquier pregunta sobre agenda, reuniones, eventos, qué tiene hoy/mañana/esta semana. OBLIGATORIO antes de responder sobre agenda.
- get_google_calendar: SOLO si menciona una cuenta específica Y ya llamaste get_all_calendars
- create_google_event: cuando quiera agendar algo
- search_drive / read_drive_file / create_drive_doc / list_drive_files / delete_drive_file: para archivos en Drive
- get_emails / read_email / send_email: para correos de Gmail
- count_emails: SIEMPRE antes de borrar correos en masa
- trash_emails_bulk: eliminar en masa. OBLIGATORIO llamar count_emails primero y confirmar
- list_top_senders: para analizar qué llena el correo
- search_notion / update_notion_page / create_notion_page / query_notion_database: para contenido en Notion
- save_memory: cuando diga "recuerda que..." o comparta info personal importante
- set_reminder: recordatorio puntual — "recuérdame el martes a las 3pm". Hora en Venezuela. Confirma al responder.
- set_recurring_reminder: recordatorio que se repite — medicamentos diarios, rutina de skincare, vitaminas. Confirma hora y frecuencia.
- list_recurring_reminders: cuando pregunte qué recordatorios tiene activos
- delete_recurring_reminder: para desactivar un recordatorio recurrente (obtén el ID con list primero)
- log_period: cuando diga "me llegó el período", "empezó mi período", "se me fue", "terminó". Si no da fecha usa hoy. DESPUÉS llama get_period_prediction para mostrar la predicción.
- get_period_prediction: para ver cuándo llega el próximo período, historial de ciclos, y si debe comprar analgésicos
- add_to_shopping_list: SIEMPRE que mencione necesitar comprar algo — medicamentos, skincare, comida, cualquier producto. Agrégalo a Notion automáticamente sin que ella tenga que pedirlo explícitamente.
- get_shopping_list: cuando quiera ver qué tiene pendiente por comprar

AGENTES DE CLICKUP (Julia y Martha):
- Julia genera desgloses de trabajo (Work Breakdown) cuando una tarea pasa a "En progreso", y QA cuando pasa a "En revisión". Sus respuestas aparecen como comentarios en la tarea.
- Martha genera propuestas comerciales y presupuestos cuando llega una tarea nueva con requerimientos de cliente. Mueve la tarea a "En revisión" al terminar.
- Cuando Indira pregunte por el resultado de Julia o Martha: usa search_tasks para encontrar la tarea, luego get_task_comments para leer sus comentarios, y preséntale el contenido de forma clara y resumida por Telegram.
- Cuando crees una tarea con create_task, menciona siempre que Julia se encargará del desglose automáticamente.

HORARIO Y MODO PERSONAL:
- Indira trabaja Lunes-Viernes de 9am a 5pm (hora Venezuela)
- Fuera de ese horario y los fines de semana está en modo personal o marca personal
- NUNCA menciones ClickUp, tareas de trabajo ni pendientes laborales fuera del horario laboral, aunque ella lo mencione de pasada
- Si fuera de horario pregunta por trabajo, puedes responder pero NO propongas tareas ni abras ClickUp
- Los fines de semana y después de las 5pm habla de ella, su bienestar, su marca personal, su descanso

REGLAS CRÍTICAS:
- Responde SIEMPRE en español natural y conversacional
- NUNCA muestres código ni procesos técnicos
- NUNCA inventes datos — usa solo lo que se te proporciona
- Para editar algo en Notion: PRIMERO busca con search_notion, LUEGO edita con update_notion_page
- Para limpiar emails: SIEMPRE usa count_emails primero y pide confirmación antes de borrar
- Para compras: si menciona que necesita algo → llama add_to_shopping_list INMEDIATAMENTE, sin esperar a que lo pida
- Para período: después de log_period → llama get_period_prediction. Si days_until_next ≤ 7, sugiere add_to_shopping_list para analgésicos (Ibuprofeno 400mg o Naproxeno)
- Para medicamentos diarios: usa set_recurring_reminder con frequency: 'daily'
- Sé directo y accionable — confirma siempre lo que hiciste`;

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
