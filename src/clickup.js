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
    if (tasks.length > 0) {
      console.log('📋 Primera tarea:', tasks[0].name, '| Asignados:', JSON.stringify(tasks[0].assignees?.map(a => a.id)));
    }
    return tasks;
  } catch (error) {
    console.error('ClickUp error:', error.response?.data || error.message);
    return [];
  }
}

export async function createClickUpTask(listId, name, description = '') {
  try {
    const response = await clickupClient.post(`/list/${listId}/task`, {
      name,
      description,
      status: 'open',
    });
    return response.data;
  } catch (error) {
    console.error('ClickUp create error:', error.message);
    return null;
  }
}
