import { google } from 'googleapis';

const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://dante-agent-production.up.railway.app/auth/google/callback'
  : 'http://localhost:3001/auth/google/callback';

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

// Genera la URL de autorización para una cuenta
export function getAuthUrl(account) {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state: account,
    prompt: 'consent',
  });
}

// Intercambia el code por tokens
export async function handleGoogleCallback(code) {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Crea cliente autenticado para una cuenta específica
function getAuthClient(account) {
  const tokenKey = `GOOGLE_REFRESH_TOKEN_${account.toUpperCase()}`;
  const refreshToken = process.env[tokenKey];
  if (!refreshToken) {
    throw new Error(`No hay token para la cuenta "${account}". Autoriza en /auth/google?account=${account}`);
  }
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

// Lee eventos del calendario
export async function getGoogleCalendarEvents(account, days = 7) {
  try {
    const auth = getAuthClient(account);
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
    console.log(`📅 Google Calendar (${account}): ${events.length} eventos`);

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
    console.error(`Google Calendar error (${account}):`, error.message);
    return [];
  }
}

// Crea un evento en el calendario
export async function createGoogleCalendarEvent(account, { title, description, start_datetime, end_datetime, attendees, location }) {
  try {
    const auth = getAuthClient(account);
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

    console.log(`✅ Evento creado en Google Calendar (${account}): ${title}`);
    return {
      id: response.data.id,
      url: response.data.htmlLink,
      title,
    };
  } catch (error) {
    console.error(`Google Calendar create error (${account}):`, error.message);
    throw new Error(`No pude crear el evento: ${error.message}`);
  }
}
