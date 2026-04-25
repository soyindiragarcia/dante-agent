import axios from 'axios';
import { transcribeVoiceMessage } from './voice.js';
import { analyzeImageWithGemini } from './gemini.js';
import { getOrCreateUser, saveConversation, searchMemories, saveMemory } from './supabase.js';
import { processWithClaude, generateEmbedding, needsClaudeModel } from './claude.js';
import { processWithGroq } from './groq-llm.js';
import { getClickUpTasks, createClickUpTask, searchClickUpTasks, getTaskDetails, getTaskComments, mentionAgent } from './clickup.js';
import { getUpcomingBookings, getAvailability } from './calcom.js';
import { searchNotion, createNotionPage, updateNotionPage, findProjectByName, findResourceByName, queryDatabase, addToShoppingList, getShoppingList } from './notion.js';
import { getGoogleCalendarEvents, createGoogleCalendarEvent, listGoogleAccounts, getAllCalendarEvents } from './google-calendar.js';
import {
  saveReminder,
  saveRecurringReminder,
  listRecurringReminders,
  deleteRecurringReminder,
  logPeriodStart,
  logPeriodEnd,
  getPeriodPrediction,
} from './reminders.js';
import { searchDrive, readDriveFile, createDriveDoc, deleteDriveFile, listDriveFiles } from './google-drive.js';
import { getEmails, readEmail, sendEmail, countEmails, trashEmailsBulk, listTopSenders } from './gmail.js';

const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Horario laboral de Indira: Lunes-Viernes 9am-5pm Venezuela (UTC-4)
// Fuera de este horario DANTE no menciona trabajo ni ClickUp
function isWorkHours() {
  const nowVE = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const day = nowVE.getUTCDay();   // 0=Dom, 1=Lun ... 5=Vie, 6=Sáb
  const hour = nowVE.getUTCHours(); // 0-23 en VE
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
}

async function downloadTelegramImage(fileId) {
  const fileInfo = await axios.get(`${TELEGRAM_API_URL}/getFile`, { params: { file_id: fileId } });
  const filePath = fileInfo.data.result.file_path;
  const ext = filePath.split('.').pop().toLowerCase();
  const mediaType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const imageResponse = await axios.get(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`,
    { responseType: 'arraybuffer' }
  );
  const base64 = Buffer.from(imageResponse.data).toString('base64');
  return { base64, mediaType };
}

export async function handleTelegramMessage(message, supabase) {
  const { chat, from, text, voice, photo, caption } = message;

  let messageText = text;
  let imageData = null;

  // Manejar notas de voz
  if (voice && !text) {
    try {
      await sendMessage(chat.id, '🎤 _Transcribiendo nota de voz..._');
      messageText = await transcribeVoiceMessage(voice.file_id);
    } catch (error) {
      console.error('Voice transcription error:', error.message);
      await sendMessage(chat.id, '❌ No pude transcribir la nota de voz.');
      return;
    }
  }

  // Manejar imágenes con Gemini Flash (gratis)
  if (photo) {
    try {
      await sendMessage(chat.id, '🖼️ _Analizando imagen..._');
      const highRes = photo[photo.length - 1];
      const imgData = await downloadTelegramImage(highRes.file_id);
      const description = await analyzeImageWithGemini(imgData.base64, imgData.mediaType, caption || null);
      // Pasar descripción a Claude como texto — sin gastar tokens de visión
      messageText = `[IMAGEN ANALIZADA POR GEMINI]\n${description}\n\n${caption ? `Instrucción del usuario: ${caption}` : 'El usuario envió esta imagen. Responde sobre ella y pregunta si quiere guardarla en memoria.'}`;
      imageData = null; // Gemini ya la procesó, no hace falta enviar a Claude
    } catch (error) {
      console.error('Image analysis error:', error.message);
      // Fallback: enviar a Claude Vision si Gemini falla
      try {
        const highRes = photo[photo.length - 1];
        imageData = await downloadTelegramImage(highRes.file_id);
        messageText = caption || 'Analiza esta imagen detalladamente.';
      } catch (e) {
        await sendMessage(chat.id, '❌ No pude procesar la imagen.');
        return;
      }
    }
  }

  if (!messageText) return;

  console.log(`📩 ${from.first_name}: ${messageText}`);

  try {
    const user = await getOrCreateUser(supabase, from.id, from.first_name, from.username);

    const userEmbedding = generateEmbedding(messageText);
    await saveConversation(supabase, user.id, 'user', messageText, userEmbedding);

    const memories = await searchMemories(supabase, user.id, messageText, userEmbedding, 3);

    const workTime = isWorkHours();
    const [clickupTasks, googleAccounts] = await Promise.all([
      workTime ? getClickUpTasks() : Promise.resolve([]),
      listGoogleAccounts(),
    ]);

    const tasksContext = workTime && clickupTasks.length > 0
      ? `\n\nTareas pendientes en ClickUp:\n${clickupTasks.slice(0, 5).map(t => `- ${t.name} [${t.status?.status || 'open'}]`).join('\n')}`
      : '';

    const accountsContext = googleAccounts.length > 0
      ? `\n\nCuentas de Google autorizadas (usa EXACTAMENTE estos nombres):\n${googleAccounts.map(a => `- "${a.name}" → ${a.email}`).join('\n')}`
      : '';

    const fullMessage = messageText + tasksContext + accountsContext;

    // Manejador de tool calls
    const handleToolCall = async (toolName, toolInput) => {
      console.log(`🔧 Tool call: ${toolName}`, toolInput);

      if (toolName === 'create_task') {
        const task = await createClickUpTask(toolInput);
        return { success: true, task_id: task.id, task_name: task.name, url: task.url };
      }

      if (toolName === 'search_tasks') {
        const tasks = await searchClickUpTasks(toolInput.query);
        return { tasks, count: tasks.length };
      }

      if (toolName === 'get_task_details') {
        const task = await getTaskDetails(toolInput.task_id);
        return task;
      }

      if (toolName === 'get_task_comments') {
        const comments = await getTaskComments(toolInput.task_id);
        return { comments, count: comments.length };
      }

      if (toolName === 'mention_agent') {
        const result = await mentionAgent(toolInput.task_id, toolInput.agent, toolInput.instruction);
        return { success: true, agent: toolInput.agent, task_id: toolInput.task_id };
      }

      if (toolName === 'get_calendar_bookings') {
        const bookings = await getUpcomingBookings(toolInput.days || 7);
        return { bookings, count: bookings.length };
      }

      if (toolName === 'get_calendar_availability') {
        const availability = await getAvailability(toolInput.days || 7);
        return { availability };
      }

      if (toolName === 'query_notion_database') {
        const dbMap = {
          proyectos: process.env.NOTION_PROJECTS_DB_ID,
          recursos: process.env.NOTION_RECURSOS_DB_ID,
          temas: process.env.NOTION_TEMAS_DB_ID,
          areas: process.env.NOTION_AREAS_DB_ID,
          clientes: process.env.NOTION_CLIENTES_DB_ID,
        };
        const dbId = dbMap[toolInput.database?.toLowerCase()];
        if (!dbId) return { error: `Base de datos "${toolInput.database}" no encontrada` };
        const results = await queryDatabase(dbId, toolInput.search);
        return { results, count: results.length };
      }

      if (toolName === 'search_notion') {
        const results = await searchNotion(toolInput.query);
        return { results, count: results.length };
      }

      if (toolName === 'create_notion_page') {
        const page = await createNotionPage(toolInput.title, toolInput.content, toolInput.due_date, toolInput.priority);
        return { success: true, url: page.url, title: page.title };
      }

      if (toolName === 'update_notion_page') {
        const updates = { ...toolInput };
        // Si hay project_name, buscar su ID primero
        if (toolInput.project_name) {
          const project = await findProjectByName(toolInput.project_name);
          if (project) updates.project_id = project.id;
        }
        if (toolInput.resource_name) {
          const resource = await findResourceByName(toolInput.resource_name);
          if (resource) updates.resource_id = resource.id;
        }
        const result = await updateNotionPage(toolInput.page_id, updates);
        return { success: true, url: result.url };
      }

      if (toolName === 'save_memory') {
        await saveMemory(supabase, user.id, toolInput.key, toolInput.value);
        return { success: true, message: `Memoria guardada: ${toolInput.key}` };
      }

      if (toolName === 'get_all_calendars') {
        const events = await getAllCalendarEvents(toolInput.days || 7);
        return { events, count: events.length };
      }

      if (toolName === 'get_google_calendar') {
        const events = await getGoogleCalendarEvents(toolInput.account, toolInput.days || 7);
        return { events, count: Array.isArray(events) ? events.length : 0, account: toolInput.account };
      }

      if (toolName === 'create_google_event') {
        const event = await createGoogleCalendarEvent(toolInput.account, toolInput);
        return { success: true, event_id: event.id, url: event.url, title: event.title };
      }

      if (toolName === 'search_drive') {
        const files = await searchDrive(toolInput.account, toolInput.query);
        return { files, count: Array.isArray(files) ? files.length : 0 };
      }

      if (toolName === 'read_drive_file') {
        const file = await readDriveFile(toolInput.account, toolInput.file_id);
        return file;
      }

      if (toolName === 'create_drive_doc') {
        const doc = await createDriveDoc(toolInput.account, toolInput.title, toolInput.content);
        return { success: true, id: doc.id, url: doc.url, title: doc.title };
      }

      if (toolName === 'get_emails') {
        const emails = await getEmails(toolInput.account, toolInput.max_results || 10, toolInput.query || '');
        return { emails, count: Array.isArray(emails) ? emails.length : 0 };
      }

      if (toolName === 'read_email') {
        const email = await readEmail(toolInput.account, toolInput.message_id);
        return email;
      }

      if (toolName === 'send_email') {
        const result = await sendEmail(toolInput.account, toolInput);
        return result;
      }

      if (toolName === 'count_emails') {
        const result = await countEmails(toolInput.account, toolInput.query);
        return result;
      }

      if (toolName === 'trash_emails_bulk') {
        const result = await trashEmailsBulk(toolInput.account, toolInput.query, toolInput.max_to_trash || 500);
        return result;
      }

      if (toolName === 'list_top_senders') {
        const senders = await listTopSenders(toolInput.account);
        return { senders, account: toolInput.account };
      }

      if (toolName === 'list_drive_files') {
        const files = await listDriveFiles(toolInput.account, toolInput.folder_id || 'root');
        return { files, count: Array.isArray(files) ? files.length : 0 };
      }

      if (toolName === 'delete_drive_file') {
        const result = await deleteDriveFile(toolInput.account, toolInput.file_id);
        return result;
      }

      if (toolName === 'set_reminder') {
        const reminder = await saveReminder(chat.id, toolInput.message, toolInput.datetime);
        return { success: true, message: toolInput.message, scheduled_at: toolInput.datetime };
      }

      // ── Recordatorios recurrentes ──────────────────────────
      if (toolName === 'set_recurring_reminder') {
        const reminder = await saveRecurringReminder(
          chat.id,
          toolInput.message,
          toolInput.frequency,
          toolInput.time_ve,
          toolInput.days_of_week || null,
          toolInput.day_of_month || null
        );
        return {
          success: true,
          id: reminder.id,
          message: toolInput.message,
          frequency: toolInput.frequency,
          time_ve: toolInput.time_ve,
        };
      }

      if (toolName === 'list_recurring_reminders') {
        const reminders = await listRecurringReminders(chat.id);
        return { reminders, count: reminders.length };
      }

      if (toolName === 'delete_recurring_reminder') {
        await deleteRecurringReminder(toolInput.reminder_id);
        return { success: true };
      }

      // ── Ciclo menstrual ────────────────────────────────────
      if (toolName === 'log_period') {
        if (toolInput.action === 'start') {
          const log = await logPeriodStart(chat.id, toolInput.date, toolInput.notes || null);
          return { success: true, action: 'start', ...log };
        } else {
          const log = await logPeriodEnd(chat.id, toolInput.date);
          return { success: true, action: 'end', ...log };
        }
      }

      if (toolName === 'get_period_prediction') {
        const prediction = await getPeriodPrediction(chat.id);
        return prediction;
      }

      // ── Lista de compras ───────────────────────────────────
      if (toolName === 'add_to_shopping_list') {
        const result = await addToShoppingList(
          toolInput.item,
          toolInput.quantity || null,
          toolInput.category || null
        );
        return { success: true, ...result };
      }

      if (toolName === 'get_shopping_list') {
        const items = await getShoppingList();
        return { items, count: items.length };
      }

      return { error: `Herramienta desconocida: ${toolName}` };
    };

    // Routing: Groq (gratis) para tareas estándar, Claude solo si hace falta
    const claudeNeeded = needsClaudeModel(fullMessage, imageData);
    let response;

    if (claudeNeeded) {
      console.log(`🧠 Usando Claude (${claudeNeeded})`);
      response = await processWithClaude(fullMessage, memories, handleToolCall, imageData);
    } else {
      console.log('⚡ Usando Groq LLaMA (gratis)');
      try {
        response = await processWithGroq(fullMessage, memories, handleToolCall);
      } catch (groqError) {
        console.error('Groq falló, fallback a Claude Haiku:', groqError.message);
        response = await processWithClaude(fullMessage, memories, handleToolCall, imageData);
      }
    }

    const responseEmbedding = generateEmbedding(response.content);
    await saveConversation(supabase, user.id, 'assistant', response.content, responseEmbedding);

    await sendMessage(chat.id, response.content);

    console.log(`✅ Respondido`);
  } catch (error) {
    console.error('Error:', error);
    await sendMessage(chat.id, `❌ Error: ${error.message}`);
  }
}

async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    // Retry without markdown if formatting fails
    try {
      await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
        chat_id: chatId,
        text,
      });
    } catch (e) {
      console.error('Telegram error:', e.message);
    }
  }
}
