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

export async function saveConversation(supabase, userId, role, content, embedding = null) {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      message_role: role,
      content,
      source: 'telegram',
      embedding,
    })
    .select();

  if (error) throw error;
  return data[0];
}

export async function searchMemories(supabase, userId, query, embedding, limit = 3) {
  if (!embedding) return [];

  try {
    const { data, error } = await supabase.rpc('search_conversations', {
      query_embedding: embedding,
      user_id_filter: userId,
      limit_count: limit,
    });

    if (error) {
      console.warn('Memory search error:', error.message);
      return [];
    }

    return (data || []).map(row => `${row.message_role}: ${row.content}`);
  } catch (error) {
    console.error('Search memories error:', error.message);
    return [];
  }
}
