import { createPool, VercelPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
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
    console.error('Database GET for commute_logs failed:', error);
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

// --- POST Handler (Log Commute) ---
async function handlePost(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { personnelCode, guardName, action, timestampOverride } = request.body;

  if (!personnelCode || !guardName || !action || !['entry', 'exit'].includes(action)) {
    return response.status(400).json({ error: 'اطلاعات ارسالی ناقص یا نامعتبر است.' });
  }
  
  const effectiveTime = timestampOverride ? new Date(timestampOverride) : new Date();

  try {
    const { rows: openLogs } = await pool.sql`
        SELECT id FROM commute_logs 
        WHERE 
            personnel_code = ${personnelCode} AND 
            exit_time IS NULL AND 
            entry_time >= date_trunc('day', ${effectiveTime.toISOString()}::timestamptz) AND
            entry_time < date_trunc('day', ${effectiveTime.toISOString()}::timestamptz) + interval '1 day';
    `;
    const openLog = openLogs[0];

    if (action === 'entry') {
        if (openLog) {
            return response.status(409).json({ error: 'برای این پرسنل یک ورود باز در این روز ثبت شده است. ابتدا باید خروج ثبت شود.' });
        }
        const { rows: newLog } = await pool.sql`
            INSERT INTO commute_logs (personnel_code, guard_name, entry_time) 
            VALUES (${personnelCode}, ${guardName}, ${effectiveTime.toISOString()}) 
            RETURNING *;
        `;
        return response.status(201).json({ message: 'ورود با موفقیت ثبت شد.', log: newLog[0] });
    }
    
    if (action === 'exit') {
        if (!openLog) {
            return response.status(404).json({ error: 'هیچ ورود بازی برای این پرسنل در این روز یافت نشد تا خروج ثبت شود.' });
        }
        const { rows: updatedLog } = await pool.sql`
            UPDATE commute_logs 
            SET exit_time = ${effectiveTime.toISOString()}
            WHERE id = ${openLog.id}
            RETURNING *;
        `;
        return response.status(200).json({ message: 'خروج با موفقیت ثبت شد.', log: updatedLog[0] });
    }
    
    // Fallback for safety, though logic above should cover all cases.
    return response.status(400).json({ error: 'عملیات نامعتبر است.' });

  } catch (error) {
    console.error('Database POST for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

// --- Main Handler ---
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
    });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });

  switch (request.method) {
    case 'GET':
      return await handleGet(request, response, pool);
    case 'POST':
      return await handlePost(request, response, pool);
    default:
      response.setHeader('Allow', ['GET', 'POST']);
      return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }
}