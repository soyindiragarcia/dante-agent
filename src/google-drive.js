import { google } from 'googleapis';
import { getAuthClient, friendlyGoogleError } from './google-calendar.js';

// Busca archivos en Google Drive
export async function searchDrive(accountName, query, maxResults = 10) {
  try {
    const auth = await getAuthClient(accountName);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime, size)',
      pageSize: maxResults,
      orderBy: 'modifiedTime desc',
    });

    const files = response.data.files || [];
    console.log(`📁 Google Drive (${accountName}): ${files.length} archivos encontrados`);

    return files.map(f => ({
      id: f.id,
      name: f.name,
      type: mimeTypeToLabel(f.mimeType),
      url: f.webViewLink,
      modified: f.modifiedTime,
    }));
  } catch (error) {
    console.error(`Google Drive search error (${accountName}):`, error.message);
    return { error: friendlyGoogleError(accountName, error) };
  }
}

// Lee el contenido de texto de un archivo de Drive (Docs, Sheets, txt)
export async function readDriveFile(accountName, fileId) {
  try {
    const auth = await getAuthClient(accountName);
    const drive = google.drive({ version: 'v3', auth });

    // Primero obtenemos metadata
    const meta = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, webViewLink',
    });

    const { mimeType, name } = meta.data;

    let content = '';

    if (mimeType === 'application/vnd.google-apps.document') {
      const res = await drive.files.export({ fileId, mimeType: 'text/plain' });
      content = res.data;
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const res = await drive.files.export({ fileId, mimeType: 'text/csv' });
      content = res.data?.slice(0, 3000); // limitar tamaño
    } else if (mimeType.startsWith('text/')) {
      const res = await drive.files.get({ fileId, alt: 'media' });
      content = String(res.data).slice(0, 3000);
    } else {
      content = `[Archivo binario — no se puede leer el contenido de ${mimeType}]`;
    }

    console.log(`📄 Drive leído (${accountName}): ${name}`);
    return { name, url: meta.data.webViewLink, content };
  } catch (error) {
    console.error(`Google Drive read error (${accountName}):`, error.message);
    return { error: friendlyGoogleError(accountName, error) };
  }
}

// Crea un Google Doc con contenido
export async function createDriveDoc(accountName, title, content, folderId = null) {
  try {
    const auth = await getAuthClient(accountName);
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Crear el documento vacío
    const doc = await docs.documents.create({ requestBody: { title } });
    const docId = doc.data.documentId;

    // Insertar contenido
    if (content) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [{
            insertText: {
              location: { index: 1 },
              text: content,
            },
          }],
        },
      });
    }

    // Mover a carpeta si se especificó
    if (folderId) {
      const fileMeta = await drive.files.get({ fileId: docId, fields: 'parents' });
      const previousParents = fileMeta.data.parents?.join(',') || '';
      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        removeParents: previousParents,
        fields: 'id, parents',
      });
    }

    const url = `https://docs.google.com/document/d/${docId}/edit`;
    console.log(`✅ Google Doc creado (${accountName}): ${title}`);
    return { id: docId, url, title };
  } catch (error) {
    console.error(`Google Drive create error (${accountName}):`, error.message);
    throw new Error(`No pude crear el documento: ${error.message}`);
  }
}

// Mueve un archivo a la papelera (reversible)
export async function deleteDriveFile(accountName, fileId) {
  try {
    const auth = await getAuthClient(accountName);
    const drive = google.drive({ version: 'v3', auth });

    // Obtener nombre antes de borrar
    const meta = await drive.files.get({ fileId, fields: 'name' });
    const fileName = meta.data.name;

    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
    });

    console.log(`🗑️ Drive archivo eliminado (${accountName}): ${fileName}`);
    return { success: true, message: `"${fileName}" movido a la papelera.` };
  } catch (error) {
    console.error(`Drive delete error (${accountName}):`, error.message);
    return { error: friendlyGoogleError(accountName, error) };
  }
}

// Lista archivos de una carpeta o raíz con tamaño
export async function listDriveFiles(accountName, folderId = 'root', maxResults = 20) {
  try {
    const auth = await getAuthClient(accountName);
    const drive = google.drive({ version: 'v3', auth });

    const query = folderId === 'root'
      ? `'root' in parents and trashed = false`
      : `'${folderId}' in parents and trashed = false`;

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
      pageSize: maxResults,
      orderBy: 'modifiedTime desc',
    });

    const files = response.data.files || [];
    console.log(`📁 Drive list (${accountName}): ${files.length} archivos`);

    return files.map(f => ({
      id: f.id,
      name: f.name,
      type: mimeTypeToLabel(f.mimeType),
      size: f.size ? `${(parseInt(f.size) / 1024).toFixed(0)} KB` : '—',
      modified: f.modifiedTime?.split('T')[0],
      url: f.webViewLink,
    }));
  } catch (error) {
    console.error(`Drive list error (${accountName}):`, error.message);
    return { error: friendlyGoogleError(accountName, error) };
  }
}

function mimeTypeToLabel(mimeType) {
  const map = {
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.folder': 'Carpeta',
    'application/pdf': 'PDF',
    'image/jpeg': 'Imagen',
    'image/png': 'Imagen',
  };
  return map[mimeType] || mimeType.split('/')[1] || 'Archivo';
}
