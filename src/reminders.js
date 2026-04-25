import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Venezuela = UTC-4 (sin horario de verano)
const VE_OFFSET_HOURS = -4;

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// Convierte fecha/hora venezolana a UTC para guardar en Supabase
export function venezuelaToUTC(datetimeStr) {
  // datetimeStr viene como "2026-04-25T15:00:00" (hora Venezuela)
  const date = new Date(datetimeStr + 'Z'); // tratar como UTC primero
  date.setHours(date.getHours() - VE_OFFSET_HOURS); // sumar 4 horas para convertir a UTC
  return date.toISOString();
}

// Guarda un recordatorio en Supabase
export async function saveReminder(chatId, message, datetimeVenezuela) {
  const scheduledAtUTC = venezuelaToUTC(datetimeVenezuela);

  const { data, error } = await getSupabase()
    .from('reminders')
    .insert({ chat_id: chatId, message, scheduled_at: scheduledAtUTC })
    .select()
    .single();

  if (error) throw new Error(`Error guardando recordatorio: ${error.message}`);

  console.log(`⏰ Recordatorio guardado: "${message}" para ${datetimeVenezuela} VE (${scheduledAtUTC} UTC)`);
  return data;
}

// Revisa y envía recordatorios pendientes (llamado por el cron job)
export async function checkAndSendReminders() {
  const now = new Date().toISOString();

  const { data: reminders, error } = await getSupabase()
    .from('reminders')
    .select('*')
    .eq('sent', false)
    .lte('scheduled_at', now);

  if (error || !reminders?.length) return;

  for (const reminder of reminders) {
    try {
      await sendTelegramMessage(reminder.chat_id, `⏰ *Recordatorio:* ${reminder.message}`);

      await getSupabase()
        .from('reminders')
        .update({ sent: true })
        .eq('id', reminder.id);

      console.log(`✅ Recordatorio enviado: "${reminder.message}"`);
    } catch (err) {
      console.error(`Error enviando recordatorio ${reminder.id}:`, err.message);
    }
  }
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await axios.post(url, { chat_id: chatId, text, parse_mode: 'Markdown' })
    .catch(() => axios.post(url, { chat_id: chatId, text }));
}
