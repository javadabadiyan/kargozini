import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
    });
  }

  const { personnelCode, guardName, action } = request.body;

  if (!personnelCode || !guardName || !action || !['entry', 'exit'].includes(action)) {
    return response.status(400).json({ error: 'اطلاعات ارسالی ناقص یا نامعتبر است.' });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });

  try {
    const { rows: openLogs } = await pool.sql`
        SELECT id FROM commute_logs 
        WHERE 
            personnel_code = ${personnelCode} AND 
            exit_time IS NULL AND 
            entry_time >= date_trunc('day', NOW());
    `;

    const openLog = openLogs[0];

    if (action === 'entry') {
        if (openLog) {
            return response.status(409).json({ error: 'برای این پرسنل یک ورود باز در امروز ثبت شده است. ابتدا باید خروج ثبت شود.' });
        }
        const { rows: newLog } = await pool.sql`
            INSERT INTO commute_logs (personnel_code, guard_name) 
            VALUES (${personnelCode}, ${guardName}) 
            RETURNING *;
        `;
        return response.status(201).json({ message: 'ورود با موفقیت ثبت شد.', log: newLog[0] });
    }
    
    // action === 'exit'
    if (!openLog) {
        return response.status(404).json({ error: 'هیچ ورود بازی برای این پرسنل در امروز یافت نشد تا خروج ثبت شود.' });
    }
    
    const { rows: updatedLog } = await pool.sql`
        UPDATE commute_logs 
        SET exit_time = NOW() 
        WHERE id = ${openLog.id}
        RETURNING *;
    `;
    return response.status(200).json({ message: 'خروج با موفقیت ثبت شد.', log: updatedLog[0] });

  } catch (error) {
    console.error('Database log commute failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}
