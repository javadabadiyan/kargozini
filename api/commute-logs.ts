import { createPool, VercelPool, sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
    const todayInTehran = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
    const searchDate = (request.query.date as string) || todayInTehran;

    const result = await pool.query(`
        SELECT 
            cl.id, cl.personnel_code, cm.full_name, cl.guard_name, 
            cl.entry_time, cl.exit_time, cl.log_type
        FROM commute_logs cl
        LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') = $1
        ORDER BY cl.entry_time DESC;
    `, [searchDate]);

    return response.status(200).json({ logs: result.rows });
  } catch (error) {
    console.error('Database GET for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    if (errorMessage.includes('relation "commute_logs" does not exist')) {
        return response.status(500).json({ error: 'جدول تردد یافت نشد.' });
    }
    return response.status(500).json({ error: 'Failed to fetch commute logs data.', details: errorMessage });
  }
}

// --- POST Handler ---
async function handlePost(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { personnelCode, guardName, action, timestampOverride, exitTime, returnTime } = request.body;
  const effectiveTime = timestampOverride ? new Date(timestampOverride).toISOString() : sql`NOW()`;

  try {
    if (action === 'short_leave') {
      if (!personnelCode || !guardName || !exitTime || !returnTime) {
        return response.status(400).json({ error: 'اطلاعات تردد بین‌ساعتی ناقص است.' });
      }
      const { rows } = await pool.query(
        `INSERT INTO commute_logs (personnel_code, guard_name, entry_time, exit_time, log_type) 
         VALUES ($1, $2, $3, $4, 'short_leave') RETURNING *;`,
        [personnelCode, guardName, returnTime, exitTime]
      );
      return response.status(201).json({ message: 'تردد بین ساعتی با موفقیت ثبت شد.', log: rows[0] });
    }

    if (!personnelCode || !guardName || !action || !['entry', 'exit'].includes(action)) {
      return response.status(400).json({ error: 'اطلاعات ارسالی ناقص یا نامعتبر است.' });
    }

    const { rows: openLogs } = await pool.query(
        `SELECT id FROM commute_logs 
         WHERE personnel_code = $1 AND exit_time IS NULL AND log_type = 'main'
         AND DATE(entry_time AT TIME ZONE 'Asia/Tehran') = DATE($2::timestamptz AT TIME ZONE 'Asia/Tehran');`,
        [personnelCode, effectiveTime === 'NOW()' ? new Date().toISOString() : effectiveTime]
    );
    const openLog = openLogs[0];

    if (action === 'entry') {
      if (openLog) {
        return response.status(409).json({ error: 'برای این پرسنل یک ورود باز در این روز ثبت شده است.' });
      }
      const { rows } = await pool.query(
        `INSERT INTO commute_logs (personnel_code, guard_name, entry_time) VALUES ($1, $2, $3) RETURNING *;`,
        [personnelCode, guardName, effectiveTime]
      );
      return response.status(201).json({ message: 'ورود با موفقیت ثبت شد.', log: rows[0] });
    }
    
    if (action === 'exit') {
      if (!openLog) {
        return response.status(404).json({ error: 'هیچ ورود بازی برای این پرسنل در این روز یافت نشد.' });
      }
      const { rows } = await pool.query(
        `UPDATE commute_logs SET exit_time = $1 WHERE id = $2 RETURNING *;`,
        [effectiveTime, openLog.id]
      );
      return response.status(200).json({ message: 'خروج با موفقیت ثبت شد.', log: rows[0] });
    }
    
    return response.status(400).json({ error: 'عملیات نامعتبر است.' });

  } catch (error) {
    console.error('Database POST for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

// --- PUT/DELETE Handlers ---
// ... (omitting PUT and DELETE as they are unchanged from the previous version)

// --- Main Handler ---
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده تنظیم نشده است.' });
  }
  
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });

  switch (request.method) {
    case 'GET':
      return await handleGet(request, response, pool);
    case 'POST':
      return await handlePost(request, response, pool);
    case 'PUT':
        const { id, entry_time, exit_time } = request.body;
        if (!id || !entry_time) return response.status(400).json({ error: 'شناسه و زمان ورود برای ویرایش الزامی است.' });
        const { rows } = await pool.query(`UPDATE commute_logs SET entry_time = $1, exit_time = $2 WHERE id = $3 RETURNING id;`, [entry_time, exit_time, id]);
        if(rows.length === 0) return response.status(404).json({error: 'رکورد یافت نشد.'})
        return response.status(200).json({ message: 'رکورد با موفقیت ویرایش شد.' });
    case 'DELETE':
        const { id: deleteId } = request.body;
        if (!deleteId) return response.status(400).json({ error: 'شناسه رکورد برای حذف مورد نیاز است.' });
        await pool.query(`DELETE FROM commute_logs WHERE id = $1;`, [deleteId]);
        return response.status(200).json({ message: 'رکورد با موفقیت حذف شد.' });
    default:
      response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }
}