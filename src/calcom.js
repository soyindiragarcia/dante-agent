import axios from 'axios';

const calClient = axios.create({
  baseURL: 'https://api.cal.com/v2',
  headers: {
    Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
    'cal-api-version': '2024-08-13',
  },
});

export async function getUpcomingBookings(days = 7) {
  try {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const response = await calClient.get('/bookings', {
      params: {
        status: 'upcoming',
        afterStart: now.toISOString(),
        beforeStart: future.toISOString(),
        take: 10,
      },
    });

    const bookings = response.data?.data?.bookings || response.data?.bookings || [];
    console.log(`📅 Cal.com: ${bookings.length} reuniones encontradas`);

    return bookings.map(b => ({
      id: b.id,
      title: b.title || b.eventType?.title || 'Reunión',
      start: b.start,
      end: b.end,
      attendees: (b.attendees || []).map(a => a.name || a.email).join(', '),
      meetingUrl: b.meetingUrl || b.location || '',
    }));
  } catch (error) {
    console.error('Cal.com bookings error:', error.response?.data || error.message);
    return [];
  }
}

export async function getEventTypes() {
  try {
    const response = await calClient.get('/event-types');
    const types = response.data?.data?.eventTypeGroups?.[0]?.eventTypes ||
                  response.data?.data || [];
    return types.map(t => ({
      id: t.id,
      title: t.title,
      duration: t.length,
      slug: t.slug,
    }));
  } catch (error) {
    console.error('Cal.com event types error:', error.response?.data || error.message);
    return [];
  }
}

export async function getAvailability(days = 7) {
  try {
    const eventTypes = await getEventTypes();
    if (!eventTypes.length) return [];

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const response = await calClient.get('/slots/available', {
      params: {
        eventTypeId: eventTypes[0].id,
        startTime: now.toISOString(),
        endTime: future.toISOString(),
      },
    });

    const slots = response.data?.data?.slots || {};
    const available = [];
    for (const [date, times] of Object.entries(slots)) {
      if (times?.length) {
        available.push({ date, slots: times.slice(0, 3).map(t => t.time) });
      }
    }
    return available;
  } catch (error) {
    console.error('Cal.com availability error:', error.response?.data || error.message);
    return [];
  }
}
