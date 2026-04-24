import { google } from 'googleapis';
import { getAuthClient } from './google-calendar.js';

// Lee los últimos emails de una cuenta
export async function getEmails(accountName, maxResults = 10, query = '') {
  try {
    const auth = await getAuthClient(accountName);
    const gmail = google.gmail({ version: 'v1', auth });

    const searchQuery = query || 'in:inbox';
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults,
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) return [];

    // Obtener detalles de cada mensaje en paralelo
    const details = await Promise.all(
      messages.map(m => gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      }))
    );

    console.log(`📧 Gmail (${accountName}): ${details.length} emails`);

    return details.map(res => {
      const headers = res.data.payload?.headers || [];
      const get = (name) => headers.find(h => h.name === name)?.value || '';
      return {
        id: res.data.id,
        subject: get('Subject') || '(Sin asunto)',
        from: get('From'),
        date: get('Date'),
        snippet: res.data.snippet || '',
        unread: res.data.labelIds?.includes('UNREAD') || false,
      };
    });
  } catch (error) {
    console.error(`Gmail error (${accountName}):`, error.message);
    return { error: error.message };
  }
}

// Lee el cuerpo completo de un email específico
export async function readEmail(accountName, messageId) {
  try {
    const auth = await getAuthClient(accountName);
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = res.data.payload?.headers || [];
    const get = (name) => headers.find(h => h.name === name)?.value || '';

    const body = extractBody(res.data.payload);

    return {
      id: res.data.id,
      subject: get('Subject'),
      from: get('From'),
      to: get('To'),
      date: get('Date'),
      body: body.slice(0, 4000),
    };
  } catch (error) {
    console.error(`Gmail read error (${accountName}):`, error.message);
    return { error: error.message };
  }
}

// Envía un email
export async function sendEmail(accountName, { to, subject, body, replyToMessageId }) {
  try {
    const auth = await getAuthClient(accountName);
    const gmail = google.gmail({ version: 'v1', auth });

    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ];

    const raw = Buffer.from(emailLines.join('\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const requestBody = { raw };
    if (replyToMessageId) {
      requestBody.threadId = replyToMessageId;
    }

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody,
    });

    console.log(`✅ Email enviado (${accountName}) → ${to}`);
    return { success: true, id: res.data.id, to, subject };
  } catch (error) {
    console.error(`Gmail send error (${accountName}):`, error.message);
    throw new Error(`No pude enviar el email: ${error.message}`);
  }
}

// Extrae el texto plano del payload del mensaje
function extractBody(payload) {
  if (!payload) return '';

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    }
    // Si no hay text/plain, buscar text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64').toString('utf8');
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      // Recursivo para partes anidadas
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  return '';
}
