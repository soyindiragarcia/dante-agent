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

export async function queryDatabase(dbId, searchName = null) {
  try {
    const response = await notionClient.post(`/databases/${dbId}/query`, { page_size: 50 });
    const results = response.data.results || [];
    return results.map(item => {
      const titleProp = Object.values(item.properties).find(v => v.type === 'title');
      const title = titleProp?.title?.[0]?.plain_text || 'sin título';
      return { id: item.id, title, url: item.url };
    }).filter(item =>
      !searchName || item.title.toLowerCase().includes(searchName.toLowerCase())
    );
  } catch (error) {
    console.error('Notion queryDatabase error:', error.message);
    return [];
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

// ============================================================
// LISTA DE COMPRAS (página Notion con estructura por categorías)
// ============================================================

// Extrae el texto plano de un bloque de Notion
function getBlockPlainText(block) {
  const content = block[block.type];
  const richText = content?.rich_text || content?.title || [];
  return richText.map(t => t.plain_text).join('').toLowerCase();
}

// Agrega un ítem como to-do dentro del bloque de categoría correcto
async function addItemToShoppingPage(pageId, itemText, category) {
  let targetId = pageId; // por defecto se agrega al final de la página

  if (category) {
    try {
      const blocksRes = await notionClient.get(`/blocks/${pageId}/children`);
      const blocks = blocksRes.data.results || [];

      // Buscar el bloque (toggle, heading, bullet) que coincida con la categoría
      for (const block of blocks) {
        const blockText = getBlockPlainText(block);
        if (blockText.includes(category.toLowerCase())) {
          targetId = block.id;
          break;
        }
      }
    } catch (e) {
      console.warn('No pude leer los bloques de la lista de compras:', e.message);
    }
  }

  const todoBlock = {
    object: 'block',
    type: 'to_do',
    to_do: {
      rich_text: [{ type: 'text', text: { content: itemText } }],
      checked: false,
    },
  };

  const response = await notionClient.patch(`/blocks/${targetId}/children`, {
    children: [todoBlock],
  });

  const newBlock = response.data.results?.[0];
  const cleanPageId = pageId.replace(/-/g, '');
  return {
    id: newBlock?.id,
    url: `https://www.notion.so/${cleanPageId}`,
    item: itemText,
    category: category || 'sin categoría',
  };
}

export async function addToShoppingList(item, quantity = null, category = null) {
  try {
    const itemText = `${item}${quantity ? ` (${quantity})` : ''}`;
    const pageId = process.env.NOTION_SHOPPING_PAGE_ID;

    if (pageId) {
      // Página dedicada con estructura de categorías (modo principal)
      return await addItemToShoppingPage(pageId, itemText, category);
    }

    // Fallback: base de datos o inbox
    const dbId = process.env.NOTION_SHOPPING_DB_ID || process.env.NOTION_INBOX_DB_ID;
    const title = `🛒 ${category ? `[${category}] ` : ''}${itemText}`;
    const properties = {
      Nombre: { title: [{ type: 'text', text: { content: title } }] },
    };
    if (!process.env.NOTION_SHOPPING_DB_ID) {
      properties.Estatus = { status: { name: 'Inbox' } };
    }
    const response = await notionClient.post('/pages', {
      parent: { type: 'database_id', database_id: dbId },
      properties,
    });
    return { id: response.data.id, url: response.data.url, item: title };

  } catch (error) {
    console.error('Notion shopping add error:', error.response?.data || error.message);
    throw new Error(`No pude agregar a la lista de compras: ${JSON.stringify(error.response?.data || error.message)}`);
  }
}

export async function getShoppingList() {
  try {
    const pageId = process.env.NOTION_SHOPPING_PAGE_ID;

    if (pageId) {
      // Leer la página de compras: recorrer categorías y sus to-dos pendientes
      const items = [];
      const blocksRes = await notionClient.get(`/blocks/${pageId}/children`);
      const topBlocks = blocksRes.data.results || [];

      for (const block of topBlocks) {
        const categoryText = block[block.type]?.rich_text?.map(t => t.plain_text).join('') || '';
        const blockType = block.type;

        // Si es toggle, heading o bullet → puede tener hijos (categorías)
        if (['toggle', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item'].includes(blockType)) {
          try {
            const childRes = await notionClient.get(`/blocks/${block.id}/children`);
            const children = childRes.data.results || [];
            for (const child of children) {
              if (child.type === 'to_do' && !child.to_do.checked) {
                const childText = child.to_do.rich_text.map(t => t.plain_text).join('');
                items.push({ id: child.id, item: childText, category: categoryText });
              }
            }
          } catch (_) { /* bloque sin hijos */ }
        }

        // To-do directo en la raíz de la página
        if (blockType === 'to_do' && !block.to_do.checked) {
          const text = block.to_do.rich_text.map(t => t.plain_text).join('');
          items.push({ id: block.id, item: text, category: 'Sin categoría' });
        }
      }

      return items;
    }

    // Fallback: base de datos
    const dbId = process.env.NOTION_SHOPPING_DB_ID || process.env.NOTION_INBOX_DB_ID;
    const response = await notionClient.post(`/databases/${dbId}/query`, { page_size: 100 });
    return (response.data.results || [])
      .filter(item => !item.archived)
      .filter(item => {
        if (process.env.NOTION_SHOPPING_DB_ID) return true;
        const titleProp = Object.values(item.properties).find(v => v.type === 'title');
        return (titleProp?.title?.[0]?.plain_text || '').startsWith('🛒');
      })
      .map(item => {
        const titleProp = Object.values(item.properties).find(v => v.type === 'title');
        return { id: item.id, item: (titleProp?.title?.[0]?.plain_text || '').replace(/^🛒\s*/, ''), url: item.url };
      });

  } catch (error) {
    console.error('Notion get shopping list error:', error.message);
    return [];
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
