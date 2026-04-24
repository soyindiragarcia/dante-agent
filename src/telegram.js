import axios from 'axios';
import { getOrCreateUser, saveConversation, searchMemories, saveMemory } from './supabase.js';
import { processWithClaude, generateEmbedding } from './claude.js';
import { getClickUpTasks, createClickUpTask } from './clickup.js';
import { getUpcomingBookings, getAvailability } from './calcom.js';
import { searchNotion, createNotionPage, updateNotionPage, findProjectByName, findResourceByName, queryDatabase } from './notion.js';
import { getGoogleCalendarEvents, createGoogleCalendarEvent } from './google-calendar.js';

const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function handleTelegramMessage(message, supabase) {
  const { chat, from, text } = message;

  console.log(`📩 ${from.first_name}: ${text}`);

  try {
    const user = await getOrCreateUser(supabase, from.id, from.first_name, from.username);

    const userEmbedding = generateEmbedding(text);
    await saveConversation(supabase, user.id, 'user', text, userEmbedding);

    const memories = await searchMemories(supabase, user.id, text, userEmbedding, 3);

    const clickupTasks = await getClickUpTasks();
    const tasksContext = clickupTasks.length > 0
      ? `\n\nTareas pendientes en ClickUp:\n${clickupTasks.slice(0, 5).map(t => `- ${t.name} [${t.status?.status || 'open'}]`).join('\n')}`
      : '';

    const fullMessage = text + tasksContext;

    // Manejador de tool calls
    const handleToolCall = async (toolName, toolInput) => {
      console.log(`🔧 Tool call: ${toolName}`, toolInput);

      if (toolName === 'create_task') {
        const task = await createClickUpTask(toolInput);
        return { success: true, task_id: task.id, task_name: task.name, url: task.url };
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

      if (toolName === 'get_google_calendar') {
        const events = await getGoogleCalendarEvents(toolInput.account, toolInput.days || 7);
        return { events, count: events.length, account: toolInput.account };
      }

      if (toolName === 'create_google_event') {
        const event = await createGoogleCalendarEvent(toolInput.account, toolInput);
        return { success: true, event_id: event.id, url: event.url, title: event.title };
      }

      return { error: `Herramienta desconocida: ${toolName}` };
    };

    const response = await processWithClaude(fullMessage, memories, handleToolCall);

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
