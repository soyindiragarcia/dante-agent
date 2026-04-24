import axios from 'axios';
import { getOrCreateUser, saveConversation } from './supabase.js';
import { processWithClaude } from './claude.js';
import { getClickUpTasks } from './clickup.js';

const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function handleTelegramMessage(message, supabase) {
  const { chat, from, text } = message;

  console.log(`📩 ${from.first_name}: ${text}`);

  try {
    const user = await getOrCreateUser(supabase, from.id, from.first_name, from.username);
    
    await saveConversation(supabase, user.id, 'user', text);

    const clickupTasks = await getClickUpTasks();
    const tasksContext = clickupTasks.length > 0
      ? `\n\nTareas pendientes:\n${clickupTasks.slice(0, 3).map((t) => `- ${t.name}`).join('\n')}`
      : '';

    const response = await processWithClaude(text + tasksContext);

    await saveConversation(supabase, user.id, 'assistant', response.content);

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
    });
  } catch (error) {
    console.error('Telegram error:', error.message);
  }
}