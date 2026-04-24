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
      params: {
        'statuses[]': ['open', 'in progress'],
        archived: false,
        assignees: [process.env.CLICKUP_USER_ID],
      },
    });
    const tasks = response.data.tasks || [];
    return tasks;
  } catch (error) {
    console.error('ClickUp error:', error.message);
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
