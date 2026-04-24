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
        'statuses[]': ['OPEN', 'IN_PROGRESS'],
        archived: false,
      },
    });
    return response.data.tasks || [];
  } catch (error) {
    console.error('ClickUp error:', error.message);
    return [];
  }
}