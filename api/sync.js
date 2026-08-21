// Serverless In-Memory Cloud Sync State for URSPantropiko Ticket Suite
let cachedAttendees = null;
let cachedEvent = null;
let lastSenderId = null;

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (Array.isArray(data)) {
        cachedAttendees = data;
      } else if (data && data.tickets && Array.isArray(data.tickets)) {
        cachedAttendees = data.tickets;
        cachedEvent = data.event || null;
        lastSenderId = data.senderId || null;
      } else if (data && data.attendee) {
        if (!cachedAttendees) cachedAttendees = [];
        cachedAttendees = [data.attendee, ...cachedAttendees.filter(a => a.ticket_code !== data.attendee.ticket_code && a.student_id !== data.attendee.student_id)];
        cachedEvent = data.event || null;
        lastSenderId = data.senderId || null;
      }
      return res.status(200).json({ success: true, count: (cachedAttendees || []).length, data: cachedAttendees, event: cachedEvent, senderId: lastSenderId });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  return res.status(200).json({ success: true, data: cachedAttendees || [], event: cachedEvent, senderId: lastSenderId });
}
