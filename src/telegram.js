import axios from 'axios';
import { getOrCreateUser, saveConversation, searchMemories, saveMemory } from './supabase.js';
import { processWithClaude, generateEmbedding } from './claude.js';
import { getClickUpTasks, createClickUpTask } from './clickup.js';
import { searchNotion, createNotionPage } from './notion.js';

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

      if (toolName === 'search_notion') {
        const results = await searchNotion(toolInput.query);
        return { results, count: results.length };
      }

      if (toolName === 'create_notion_page') {
        const page = await createNotionPage(toolInput.title, toolInput.content, toolInput.parent_page_id);
        return { success: true, url: page.url, title: page.title };
      }

      if (toolName === 'save_memory') {
        await saveMemory(supabase, user.id, toolInput.key, toolInput.value);
        return { success: true, message: `Memoria guardada: ${toolInput.key}` };
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
