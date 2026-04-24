import { createClient } from '@supabase/supabase-js';

export function initSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function getOrCreateUser(supabase, telegramId, firstName, username) {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      telegram_id: telegramId,
      name: firstName,
      username: username,
      updated_at: new Date(),
    }, { onConflict: 'telegram_id' })
    .select();

  if (error) throw error;
  return data[0];
}

export async function saveConversation(supabase, userId, role, content) {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      message_role: role,
      content,
      source: 'telegram',
    })
    .select();

  if (error) throw error;
  return data[0];
}