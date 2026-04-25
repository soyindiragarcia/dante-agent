import { google } from 'googleapis';
import { getAuthClient, friendlyGoogleError } from './google-calendar.js';

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
    return { error: friendlyGoogleError(accountName, error) };
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
    return { error: friendlyGoogleError(accountName, error) };
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

// Cuenta emails que coincidan con una búsqueda
export async function countEmails(accountName, query) {
  try {
    const auth = await getAuthClient(accountName);
    const gmail = google.gmail({ version: 'v1', auth });

    let total = 0;
    let pageToken = null;
    do {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 500,
        pageToken,
        fields: 'nextPageToken,resultSizeEstimate',
      });
      total += res.data.resultSizeEstimate || 0;
      pageToken = res.data.nextPageToken;
      // Solo contar, no paginar demasiado
      break;
    } while (pageToken);

    console.log(`📊 Gmail count (${accountName}): ~${total} emails para "${query}"`);
    return { count: total, query, account: accountName };
  } catch (error) {
    console.error(`Gmail count error (${accountName}):`, error.message);
    return { error: friendlyGoogleError(accountName, error) };
  }
}

// Mueve a papelera emails en lote (hasta 500 por llamada)
export async function trashEmailsBulk(accountName, query, maxToTrash = 500) {
  try {
    const auth = await getAuthClient(accountName);
    const gmail = google.gmail({ version: 'v1', auth });

    // Obtener IDs
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxToTrash, 500),
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) return { deleted: 0, message: 'No se encontraron correos con ese filtro.' };

    // Borrar en lote
    await gmail.users.messages.batchDelete({
      userId: 'me',
      requestBody: { ids: messages.map(m => m.id) },
    });

    console.log(`🗑️ Gmail bulk delete (${accountName}): ${messages.length} emails eliminados`);
    return {
      deleted: messages.length,
      query,
      account: accountName,
      message: `${messages.length} correos eliminados permanentemente.`,
    };
  } catch (error) {
    console.error(`Gmail bulk delete error (${accountName}):`, error.message);
    return { error: friendlyGoogleError(accountName, error) };
  }
}

// Lista los remitentes con más correos (para identificar qué limpiar)
export async function listTopSenders(accountName, maxResults = 20) {
  try {
    const auth = await getAuthClient(accountName);
    const gmail = google.gmail({ version: 'v1', auth });

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox',
      maxResults: 200,
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) return [];

    // Obtener detalles en lote (solo headers)
    const details = await Promise.all(
      messages.slice(0, 100).map(m =>
        gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From'],
        }).catch(() => null)
      )
    );

    const senderCount = {};
    for (const res of details) {
      if (!res) continue;
      const from = res.data.payload?.headers?.find(h => h.name === 'From')?.value || 'Desconocido';
      const email = from.match(/<(.+)>/)?.[1] || from;
      senderCount[email] = (senderCount[email] || 0) + 1;
    }

    const sorted = Object.entries(senderCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([sender, count]) => ({ sender, count }));

    console.log(`📊 Top senders (${accountName}): ${sorted.length} remitentes`);
    return sorted;
  } catch (error) {
    console.error(`Gmail top senders error (${accountName}):`, error.message);
    return { error: friendlyGoogleError(accountName, error) };
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
