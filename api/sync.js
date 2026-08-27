// Serverless In-Memory Cloud Sync State for URSPantropiko Ticket Suite
const DEFAULT_CLEAN_ATTENDEES = [
  { 
    id: 'CB-01', 
    ticket_code: 'URS-20001', 
    student_id: '2024-01001', 
    full_name: 'Abad, Christian Paul', 
    department: 'College of Business', 
    year_level: '1st Year', 
    program_section: 'BSBA 1-A', 
    payment_status: 'paid', 
    day1_status: 'attended', 
    day1_time: '08:14 AM', 
    day2_status: 'not_attended', 
    day2_time: null, 
    attendance_status: 'attended',
    created_at: '2026-08-27T08:14:00.000Z'
  },
  { 
    id: 'COED-01', 
    ticket_code: 'URS-30001', 
    student_id: '2024-02001', 
    full_name: 'Alano, Kimberly Joyce', 
    department: 'College of Education', 
    year_level: '1st Year', 
    program_section: 'BSED 1-A', 
    payment_status: 'paid', 
    day1_status: 'attended', 
    day1_time: '08:10 AM', 
    day2_status: 'not_attended', 
    day2_time: null, 
    attendance_status: 'attended',
    created_at: '2026-08-27T08:10:00.000Z'
  },
  { 
    id: 'CSS-01', 
    ticket_code: 'URS-40001', 
    student_id: '2024-03001', 
    full_name: 'Agustin, Cedric Liam', 
    department: 'College of Social Sciences', 
    year_level: '1st Year', 
    program_section: 'BS-PSYCH 1-A', 
    payment_status: 'unpaid', 
    day1_status: 'not_attended', 
    day1_time: null, 
    day2_status: 'not_attended', 
    day2_time: null, 
    attendance_status: 'not_attended',
    created_at: '2026-08-27T08:05:00.000Z'
  }
];

let cachedAttendees = DEFAULT_CLEAN_ATTENDEES;
let cachedRegistrationLocked = false;

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
      } else if (data && data.attendee) {
        if (!cachedAttendees) cachedAttendees = [];
        cachedAttendees = [data.attendee, ...cachedAttendees.filter(a => a.ticket_code !== data.attendee.ticket_code && a.student_id !== data.attendee.student_id)];
      }

      if (data && typeof data.registrationLocked === 'boolean') {
        cachedRegistrationLocked = data.registrationLocked;
      }

      return res.status(200).json({
        success: true,
        count: (cachedAttendees || []).length,
        data: cachedAttendees,
        registrationLocked: cachedRegistrationLocked
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  // GET: Pure state fetch with NO stale event replay
  return res.status(200).json({
    success: true,
    data: cachedAttendees || DEFAULT_CLEAN_ATTENDEES,
    registrationLocked: cachedRegistrationLocked
  });
}
