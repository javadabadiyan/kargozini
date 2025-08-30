import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
    
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
    });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });

  try {
    // Fetches logs where the entry time was within the current day (in the server's timezone)
    const result = await pool.sql`
        SELECT 
            cl.id, 
            cl.personnel_code, 
            cm.full_name, 
            cl.guard_name, 
            cl.entry_time, 
            cl.exit_time 
        FROM commute_logs cl
        LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE cl.entry_time >= date_trunc('day', NOW())
        ORDER BY cl.entry_time DESC;
    `;
    return response.status(200).json({ logs: result.rows });
  } catch (error) {
    console.error('Database query for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (errorMessage.includes('relation "commute_logs" does not exist')) {
        return response.status(500).json({ 
            error: 'جدول تردد (commute_logs) در پایگاه داده یافت نشد.', 
            details: 'لطفاً با مراجعه به آدرس /api/create-users-table از ایجاد جدول اطمینان حاصل کنید.' 
        });
    }

    return response.status(500).json({ error: 'Failed to fetch commute logs data.', details: errorMessage });
  }
}
