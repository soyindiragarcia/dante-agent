import axios from 'axios';

const clickupClient = axios.create({
  baseURL: 'https://api.clickup.com/api/v2',
  headers: {
    Authorization: process.env.CLICKUP_API_KEY,
  },
});

export async function getClickUpTasks(teamId = process.env.CLICKUP_TEAM_ID) {
  try {
    const response = await clickupClient.get(`/team/${teamId}/task`, {
      params: { archived: false },
    });
    const tasks = response.data.tasks || [];
    console.log(`📋 ClickUp: ${tasks.length} tareas encontradas`);
    return tasks;
  } catch (error) {
    console.error('ClickUp error:', error.response?.data || error.message);
    return [];
  }
}

// Busca tareas por nombre en el workspace
export async function searchClickUpTasks(query) {
  try {
    const response = await clickupClient.get(`/team/${process.env.CLICKUP_TEAM_ID}/task`, {
      params: { archived: false, page: 0 },
    });
    const tasks = response.data.tasks || [];
    const lower = query.toLowerCase();
    const matches = tasks.filter(t => t.name.toLowerCase().includes(lower));
    console.log(`🔍 ClickUp search "${query}": ${matches.length} resultado(s)`);
    return matches.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status?.status || 'unknown',
      url: t.url,
      assignees: (t.assignees || []).map(a => a.username),
    }));
  } catch (error) {
    console.error('ClickUp search error:', error.response?.data || error.message);
    return [];
  }
}

// Lee los detalles completos de una tarea por ID
export async function getTaskDetails(taskId) {
  try {
    const response = await clickupClient.get(`/task/${taskId}`);
    const t = response.data;
    return {
      id: t.id,
      name: t.name,
      status: t.status?.status || 'unknown',
      description: t.description || '(sin descripción)',
      url: t.url,
      assignees: (t.assignees || []).map(a => a.username),
      due_date: t.due_date ? new Date(parseInt(t.due_date)).toISOString().split('T')[0] : null,
    };
  } catch (error) {
    console.error('ClickUp task details error:', error.response?.data || error.message);
    throw new Error(`No pude leer la tarea: ${error.response?.data?.err || error.message}`);
  }
}

// Lee los comentarios de una tarea (donde Julia y Martha dejan sus respuestas)
export async function getTaskComments(taskId) {
  try {
    const response = await clickupClient.get(`/task/${taskId}/comment`);
    const comments = response.data.comments || [];
    return comments.map(c => ({
      id: c.id,
      author: c.user?.username || 'Desconocido',
      text: c.comment_text || '',
      date: new Date(parseInt(c.date)).toISOString(),
    }));
  } catch (error) {
    console.error('ClickUp comments error:', error.response?.data || error.message);
    return [];
  }
}

export async function createClickUpTask({ name, description = '', due_date = null }) {
  try {
    const listId = process.env.CLICKUP_LIST_ID;
    const userId = process.env.CLICKUP_USER_ID;

    const body = {
      name,
      description,
      assignees: userId ? [parseInt(userId)] : [],
    };

    if (due_date) {
      body.due_date = new Date(due_date).getTime();
    }

    const response = await clickupClient.post(`/list/${listId}/task`, body);
    console.log(`✅ Tarea creada en ClickUp: ${name}`);
    return {
      id: response.data.id,
      name: response.data.name,
      url: response.data.url,
    };
  } catch (error) {
    const detail = JSON.stringify(error.response?.data || error.message);
    console.error('ClickUp create error detail:', detail);
    throw new Error(`No pude crear la tarea: ${detail}`);
  }
}
