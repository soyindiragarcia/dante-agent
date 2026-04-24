import axios from 'axios';

const notionClient = axios.create({
  baseURL: 'https://api.notion.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  },
});

export async function searchNotion(query) {
  try {
    const response = await notionClient.post('/search', {
      query,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 5,
    });

    const results = response.data.results || [];
    return results.map(item => ({
      id: item.id,
      type: item.object,
      title: getTitle(item),
      url: item.url,
      last_edited: item.last_edited_time,
    }));
  } catch (error) {
    console.error('Notion search error:', error.response?.data || error.message);
    return [];
  }
}

export async function createNotionPage(title, content, due_date = null, priority = null) {
  try {
    const properties = {
      Nombre: {
        title: [{ type: 'text', text: { content: title } }],
      },
      Descripción: {
        rich_text: [{ type: 'text', text: { content: content.slice(0, 2000) } }],
      },
      Estatus: {
        status: { name: 'Inbox' },
      },
    };

    if (due_date) {
      properties.Fecha = { date: { start: due_date } };
    }

    if (priority) {
      properties.Prioridad = { select: { name: priority } };
    }

    const response = await notionClient.post('/pages', {
      parent: { type: 'database_id', database_id: process.env.NOTION_INBOX_DB_ID },
      properties,
    });

    console.log(`✅ Entrada creada en Notion: ${title}`);
    return {
      id: response.data.id,
      url: response.data.url,
      title,
    };
  } catch (error) {
    console.error('Notion create error:', error.response?.data || error.message);
    throw new Error(`No pude crear en Notion: ${JSON.stringify(error.response?.data || error.message)}`);
  }
}

export async function updateNotionPage(pageId, updates) {
  try {
    const properties = {};

    if (updates.title) {
      properties.Nombre = { title: [{ type: 'text', text: { content: updates.title } }] };
    }
    if (updates.description) {
      properties.Descripción = { rich_text: [{ type: 'text', text: { content: updates.description.slice(0, 2000) } }] };
    }
    if (updates.status) {
      properties.Estatus = { status: { name: updates.status } };
    }
    if (updates.priority) {
      properties.Prioridad = { select: { name: updates.priority } };
    }
    if (updates.due_date) {
      properties.Fecha = { date: { start: updates.due_date } };
    }
    if (updates.project_id) {
      properties.Proyectos = { relation: [{ id: updates.project_id }] };
    }
    if (updates.resource_id) {
      properties.Recursos = { relation: [{ id: updates.resource_id }] };
    }

    const response = await notionClient.patch(`/pages/${pageId}`, { properties });
    console.log(`✅ Página actualizada en Notion: ${pageId}`);
    return { id: response.data.id, url: response.data.url };
  } catch (error) {
    console.error('Notion update error:', error.response?.data || error.message);
    throw new Error(`No pude editar la página: ${JSON.stringify(error.response?.data || error.message)}`);
  }
}

export async function findProjectByName(name) {
  try {
    const dbId = process.env.NOTION_PROJECTS_DB_ID;
    if (!dbId) return null;

    const response = await notionClient.post(`/databases/${dbId}/query`, {
      page_size: 50,
    });

    const results = response.data.results || [];
    for (const item of results) {
      const titleProp = Object.values(item.properties).find(v => v.type === 'title');
      const title = titleProp?.title?.[0]?.plain_text || '';
      if (title.toLowerCase().includes(name.toLowerCase())) {
        console.log(`✅ Proyecto encontrado: ${title} (${item.id})`);
        return { id: item.id, title };
      }
    }
    console.warn(`⚠️ Proyecto no encontrado: ${name}`);
    return null;
  } catch (error) {
    console.error('Notion find project error:', error.message);
    return null;
  }
}

export async function findResourceByName(name) {
  try {
    const dbId = process.env.NOTION_RECURSOS_DB_ID;
    if (!dbId) return null;

    const response = await notionClient.post(`/databases/${dbId}/query`, { page_size: 50 });
    const results = response.data.results || [];
    for (const item of results) {
      const titleProp = Object.values(item.properties).find(v => v.type === 'title');
      const title = titleProp?.title?.[0]?.plain_text || '';
      if (title.toLowerCase().includes(name.toLowerCase())) {
        console.log(`✅ Recurso encontrado: ${title} (${item.id})`);
        return { id: item.id, title };
      }
    }
    return null;
  } catch (error) {
    console.error('Notion find resource error:', error.message);
    return null;
  }
}

export async function getNotionPage(pageId) {
  try {
    const [page, blocks] = await Promise.all([
      notionClient.get(`/pages/${pageId}`),
      notionClient.get(`/blocks/${pageId}/children`),
    ]);

    const title = getTitle(page.data);
    const text = blocksToText(blocks.data.results || []);
    return { title, content: text, url: page.data.url };
  } catch (error) {
    console.error('Notion get error:', error.response?.data || error.message);
    return null;
  }
}

function getTitle(item) {
  if (item.object === 'database') {
    const titleProp = Object.values(item.title || {})[0];
    return titleProp?.plain_text || 'Sin título';
  }
  const titleProp = item.properties?.title || item.properties?.Name;
  if (titleProp?.title) {
    return titleProp.title.map(t => t.plain_text).join('') || 'Sin título';
  }
  return 'Sin título';
}

function contentToBlocks(content) {
  return content.split('\n').filter(line => line.trim()).map(line => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: line } }],
    },
  }));
}

function blocksToText(blocks) {
  return blocks.map(block => {
    const type = block.type;
    const richText = block[type]?.rich_text || [];
    return richText.map(t => t.plain_text).join('');
  }).filter(t => t).join('\n');
}
