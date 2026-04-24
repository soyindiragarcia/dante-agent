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
