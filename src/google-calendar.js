import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback';

// Scopes completos: Calendar + Drive + Gmail + perfil
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// Guarda o actualiza una cuenta en Supabase
export async function saveGoogleAccount(name, email, refreshToken) {
  const { error } = await getSupabase()
    .from('google_accounts')
    .upsert({ name, email, refresh_token: refreshToken, updated_at: new Date().toISOString() }, { onConflict: 'name' });
  if (error) throw new Error(`Error guardando cuenta: ${error.message}`);
  console.log(`✅ Cuenta Google guardada: ${name} (${email})`);
}

// Obtiene el refresh_token de una cuenta desde Supabase
async function getRefreshToken(accountName) {
  const { data, error } = await getSupabase()
    .from('google_accounts')
    .select('refresh_token, email')
    .eq('name', accountName)
    .single();
  if (error || !data) throw new Error(`Cuenta "${accountName}" no encontrada. Autoriza en /auth/google?account=${accountName}`);
  return data.refresh_token;
}

// Lista todas las cuentas autorizadas
export async function listGoogleAccounts() {
  const { data } = await getSupabase()
    .from('google_accounts')
    .select('name, email, updated_at')
    .order('name');
  return data || [];
}

// Crea cliente autenticado para una cuenta
export async function getAuthClient(accountName) {
  const refreshToken = await getRefreshToken(accountName);
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

// Genera URL de autorización
export function getAuthUrl(account) {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    state: account,
    prompt: 'consent',
  });
}

// Intercambia código por tokens y obtiene email del usuario
export async function handleGoogleCallback(code) {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Obtener el email de la cuenta
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();

  return { tokens, email: userInfo.email };
}

// ── CALENDAR ──────────────────────────────────────────────

export async function getGoogleCalendarEvents(accountName, days = 7) {
  try {
    const auth = await getAuthClient(accountName);
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 15,
    });

    const events = response.data.items || [];
    console.log(`📅 Google Calendar (${accountName}): ${events.length} eventos`);

    return events.map(event => ({
      id: event.id,
      title: event.summary || 'Sin título',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || '',
      description: event.description || '',
      attendees: (event.attendees || []).map(a => a.displayName || a.email).join(', '),
      meetLink: event.hangoutLink || '',
    }));
  } catch (error) {
    console.error(`Google Calendar error (${accountName}):`, error.message);
    return { error: error.message };
  }
}

export async function createGoogleCalendarEvent(accountName, { title, description, start_datetime, end_datetime, attendees, location }) {
  try {
    const auth = await getAuthClient(accountName);
    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: title,
      description: description || '',
      location: location || '',
      start: { dateTime: new Date(start_datetime).toISOString(), timeZone: 'America/Caracas' },
      end: { dateTime: new Date(end_datetime).toISOString(), timeZone: 'America/Caracas' },
    };

    if (attendees) {
      event.attendees = attendees.split(',').map(e => ({ email: e.trim() }));
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: attendees ? 'all' : 'none',
    });

    console.log(`✅ Evento creado (${accountName}): ${title}`);
    return { id: response.data.id, url: response.data.htmlLink, title };
  } catch (error) {
    console.error(`Google Calendar create error (${accountName}):`, error.message);
    throw new Error(`No pude crear el evento: ${error.message}`);
  }
}
