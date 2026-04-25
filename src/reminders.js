import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Venezuela = UTC-4 (sin horario de verano)
const VE_OFFSET_HOURS = 4; // horas a sumar para pasar de VE → UTC

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// Convierte fecha/hora venezolana a UTC para guardar en Supabase
export function venezuelaToUTC(datetimeStr) {
  // datetimeStr: "2026-04-25T15:00:00" (hora Venezuela)
  const date = new Date(datetimeStr + 'Z'); // tratar como UTC
  date.setHours(date.getHours() + VE_OFFSET_HOURS); // +4h → UTC
  return date.toISOString();
}

// Hora actual en Venezuela
function getNowVE() {
  const nowUTC = new Date();
  return new Date(nowUTC.getTime() - VE_OFFSET_HOURS * 60 * 60 * 1000);
}

// ============================================================
// RECORDATORIOS DE UNA SOLA VEZ
// ============================================================

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
      await getSupabase().from('reminders').update({ sent: true }).eq('id', reminder.id);
      console.log(`✅ Recordatorio enviado: "${reminder.message}"`);
    } catch (err) {
      console.error(`Error enviando recordatorio ${reminder.id}:`, err.message);
    }
  }
}

// ============================================================
// RECORDATORIOS RECURRENTES (medicamentos, rutinas, etc.)
// ============================================================

export async function saveRecurringReminder(chatId, message, frequency, timeVE, daysOfWeek = null, dayOfMonth = null) {
  const { data, error } = await getSupabase()
    .from('recurring_reminders')
    .insert({
      chat_id: chatId,
      message,
      frequency,      // 'daily' | 'weekly' | 'monthly'
      time_ve: timeVE, // 'HH:MM' hora Venezuela
      days_of_week: daysOfWeek,   // array int[], solo para weekly. 0=Dom 1=Lun...6=Sáb
      day_of_month: dayOfMonth,   // int 1-31, solo para monthly
      active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Error guardando recordatorio recurrente: ${error.message}`);
  console.log(`🔁 Recordatorio recurrente creado: "${message}" (${frequency} a las ${timeVE} VE)`);
  return data;
}

export async function listRecurringReminders(chatId) {
  const { data, error } = await getSupabase()
    .from('recurring_reminders')
    .select('*')
    .eq('chat_id', chatId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Error listando recordatorios recurrentes: ${error.message}`);
  return data || [];
}

export async function deleteRecurringReminder(reminderId) {
  const { error } = await getSupabase()
    .from('recurring_reminders')
    .update({ active: false })
    .eq('id', reminderId);

  if (error) throw new Error(`Error eliminando recordatorio recurrente: ${error.message}`);
  return { success: true };
}

export async function checkAndSendRecurringReminders() {
  const nowVE = getNowVE();

  // Hora actual en Venezuela en formato HH:MM
  const hh = String(nowVE.getUTCHours()).padStart(2, '0');
  const mm = String(nowVE.getUTCMinutes()).padStart(2, '0');
  const currentHHMM = `${hh}:${mm}`;
  const currentDayOfWeek = nowVE.getUTCDay();    // 0=Dom ... 6=Sáb
  const currentDayOfMonth = nowVE.getUTCDate();  // 1-31
  const currentDateVE = nowVE.toISOString().substring(0, 10); // YYYY-MM-DD

  // Buscar recordatorios recurrentes cuya hora coincide con ahora
  const { data: reminders, error } = await getSupabase()
    .from('recurring_reminders')
    .select('*')
    .eq('active', true)
    .eq('time_ve', currentHHMM);

  if (error || !reminders?.length) return;

  for (const reminder of reminders) {
    // Evitar duplicados: si ya se envió hoy (en hora VE), saltar
    if (reminder.last_sent_at) {
      const lastVE = new Date(new Date(reminder.last_sent_at).getTime() - VE_OFFSET_HOURS * 60 * 60 * 1000);
      if (lastVE.toISOString().substring(0, 10) === currentDateVE) continue;
    }

    // Verificar condición de frecuencia
    let shouldSend = false;
    if (reminder.frequency === 'daily') {
      shouldSend = true;
    } else if (reminder.frequency === 'weekly') {
      const days = reminder.days_of_week || [];
      shouldSend = days.includes(currentDayOfWeek);
    } else if (reminder.frequency === 'monthly') {
      shouldSend = reminder.day_of_month === currentDayOfMonth;
    }

    if (!shouldSend) continue;

    try {
      await sendTelegramMessage(reminder.chat_id, `🔁 *Recordatorio:* ${reminder.message}`);
      await getSupabase()
        .from('recurring_reminders')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', reminder.id);
      console.log(`✅ Recurrente enviado: "${reminder.message}"`);
    } catch (err) {
      console.error(`Error enviando recurrente ${reminder.id}:`, err.message);
    }
  }
}

// ============================================================
// REGISTRO DE CICLO MENSTRUAL
// ============================================================

export async function logPeriodStart(chatId, startDate, notes = null) {
  // Buscar último período para calcular longitud del ciclo
  const { data: lastPeriod } = await getSupabase()
    .from('period_logs')
    .select('start_date')
    .eq('chat_id', chatId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  let cycleLength = null;
  if (lastPeriod?.start_date) {
    const last = new Date(lastPeriod.start_date + 'T00:00:00Z');
    const current = new Date(startDate + 'T00:00:00Z');
    const diff = Math.round((current - last) / (1000 * 60 * 60 * 24));
    // Solo guardar si es un ciclo válido (15-45 días)
    if (diff >= 15 && diff <= 45) cycleLength = diff;
  }

  const { data, error } = await getSupabase()
    .from('period_logs')
    .insert({ chat_id: chatId, start_date: startDate, cycle_length: cycleLength, notes })
    .select()
    .single();

  if (error) throw new Error(`Error guardando inicio de período: ${error.message}`);
  console.log(`🩸 Período iniciado: ${startDate}${cycleLength ? ` (ciclo: ${cycleLength} días)` : ''}`);
  return { ...data, cycle_length: cycleLength };
}

export async function logPeriodEnd(chatId, endDate) {
  // Buscar el período activo más reciente (sin end_date)
  const { data: period, error: findError } = await getSupabase()
    .from('period_logs')
    .select('*')
    .eq('chat_id', chatId)
    .is('end_date', null)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError || !period) throw new Error('No encontré un período activo. ¿Ya registraste el inicio?');

  const { data, error } = await getSupabase()
    .from('period_logs')
    .update({ end_date: endDate })
    .eq('id', period.id)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando período: ${error.message}`);

  const start = new Date(period.start_date + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const duration = Math.round((end - start) / (1000 * 60 * 60 * 24));
  console.log(`✅ Período cerrado: ${period.start_date} → ${endDate} (${duration} días de duración)`);
  return { ...data, duration_days: duration };
}

export async function getPeriodHistory(chatId, limit = 6) {
  const { data, error } = await getSupabase()
    .from('period_logs')
    .select('*')
    .eq('chat_id', chatId)
    .order('start_date', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Error obteniendo historial menstrual: ${error.message}`);
  return data || [];
}

export async function getPeriodPrediction(chatId) {
  const history = await getPeriodHistory(chatId, 8);

  if (history.length === 0) {
    return {
      prediction: null,
      message: 'No hay registros de período todavía. Dime cuándo te llegó la última vez y empezamos a llevar el registro.',
      avg_cycle_length: 28,
    };
  }

  // Calcular promedio de ciclos válidos
  const validCycles = history.filter(p => p.cycle_length && p.cycle_length >= 15 && p.cycle_length <= 45);
  const avgCycle = validCycles.length >= 1
    ? Math.round(validCycles.reduce((acc, p) => acc + p.cycle_length, 0) / validCycles.length)
    : 28;

  const lastPeriod = history[0];
  const lastStart = new Date(lastPeriod.start_date + 'T00:00:00Z');
  const predictedNext = new Date(lastStart.getTime() + avgCycle * 24 * 60 * 60 * 1000);

  // Días que faltan
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const daysUntil = Math.round((predictedNext - today) / (1000 * 60 * 60 * 24));

  // Duración promedio del período
  const durations = history
    .filter(p => p.end_date)
    .map(p => Math.round(
      (new Date(p.end_date + 'T00:00:00Z') - new Date(p.start_date + 'T00:00:00Z')) / (1000 * 60 * 60 * 24)
    ));
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 5;

  return {
    last_period_start: lastPeriod.start_date,
    last_period_end: lastPeriod.end_date || 'en curso',
    avg_cycle_length_days: avgCycle,
    avg_period_duration_days: avgDuration,
    predicted_next_start: predictedNext.toISOString().split('T')[0],
    days_until_next: daysUntil,
    records_used: history.length,
    should_buy_analgesics: daysUntil <= 7 && daysUntil > 0,
    history: history.map(p => ({
      start: p.start_date,
      end: p.end_date || 'en curso',
      cycle_days: p.cycle_length || null,
    })),
  };
}

// ============================================================
// Envío interno de mensajes Telegram
// ============================================================
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await axios.post(url, { chat_id: chatId, text, parse_mode: 'Markdown' })
    .catch(() => axios.post(url, { chat_id: chatId, text }));
}
