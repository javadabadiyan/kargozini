import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
    const todayInTehran = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    const searchDate = (request.query.date as string) || todayInTehran;

    const result = await pool.sql`
        SELECT 
            cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time 
        FROM commute_logs cl
        LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') = ${searchDate}
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
async function handleSinglePost(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { personnelCode, guardName, action, timestampOverride } = request.body;

  if (!personnelCode || !guardName || !action || !['entry', 'exit'].includes(action)) {
    return response.status(400).json({ error: 'اطلاعات ارسالی ناقص یا نامعتبر است.' });
  }
  
  const effectiveTime = timestampOverride ? new Date(timestampOverride).toISOString() : 'NOW()';

  try {
    const { rows: openLogs } = await pool.sql`
        SELECT id FROM commute_logs 
        WHERE personnel_code = ${personnelCode} AND exit_time IS NULL AND log_type = 'main' AND
              DATE(entry_time AT TIME ZONE 'Asia/Tehran') = DATE(${effectiveTime}::timestamptz AT TIME ZONE 'Asia/Tehran');
    `;
    const openLog = openLogs[0];

    if (action === 'entry') {
        if (openLog) {
            const { rows: updatedLog } = await pool.sql`
                UPDATE commute_logs SET entry_time = ${effectiveTime}, guard_name = ${guardName} WHERE id = ${openLog.id} RETURNING *;
            `;
            return response.status(200).json({ message: 'ورود باز با موفقیت به‌روزرسانی شد.', log: updatedLog[0] });
        }
        const { rows: newLog } = await pool.sql`
            INSERT INTO commute_logs (personnel_code, guard_name, entry_time) VALUES (${personnelCode}, ${guardName}, ${effectiveTime}) RETURNING *;
        `;
        return response.status(201).json({ message: 'ورود با موفقیت ثبت شد.', log: newLog[0] });
    }
    
    if (action === 'exit') {
        if (!openLog) {
            return response.status(404).json({ error: 'هیچ ورود بازی برای این پرسنل در این روز یافت نشد تا خروج ثبت شود.' });
        }
        const { rows: updatedLog } = await pool.sql`UPDATE commute_logs SET exit_time = ${effectiveTime} WHERE id = ${openLog.id} RETURNING *;`;
        return response.status(200).json({ message: 'خروج با موفقیت ثبت شد.', log: updatedLog[0] });
    }
    
    return response.status(400).json({ error: 'عملیات نامعتبر است.' });

  } catch (error) {
    console.error('Database POST for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

// --- POST Handler (Bulk Import) ---
async function handleBulkPost(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const logs = request.body as { personnel_code: string, entry_time: string, exit_time: string | null }[];

  if (!Array.isArray(logs)) return response.status(400).json({ error: 'فرمت داده‌های ارسالی نامعتبر است.' });
  const validLogs = logs.filter(log => log.personnel_code && log.entry_time);
  if (validLogs.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد.' });

  try {
    await (client as any).query('BEGIN');
    const values: (string | null)[] = [];
    const valuePlaceholders: string[] = [];
    let paramIndex = 1;

    for (const log of validLogs) {
      values.push(log.personnel_code, log.entry_time, log.exit_time, 'وارد شده از اکسل', 'main');
      valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}::timestamptz, $${paramIndex++}::timestamptz, $${paramIndex++}, $${paramIndex++})`);
    }
    
    const query = `
      INSERT INTO commute_logs (personnel_code, entry_time, exit_time, guard_name, log_type)
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (personnel_code, (DATE(entry_time AT TIME ZONE 'Asia/Tehran'))) WHERE log_type = 'main'
      DO UPDATE SET
        entry_time = EXCLUDED.entry_time,
        exit_time = EXCLUDED.exit_time,
        guard_name = EXCLUDED.guard_name;
    `;

    await (client as any).query(query, values);
    await (client as any).query('COMMIT');
    return response.status(200).json({ message: `عملیات موفق. ${validLogs.length} رکورد پردازش شد.` });
  } catch (error) {
    await (client as any).query('ROLLBACK').catch(rbError => console.error('Rollback failed:', rbError));
    console.error('Database bulk insert for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

// --- PUT Handler (Update) ---
async function handlePut(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id, entry_time, exit_time } = request.body;
  if (!id || !entry_time) {
    return response.status(400).json({ error: 'شناسه و زمان ورود برای ویرایش الزامی است.' });
  }
  try {
    await pool.sql`
      UPDATE commute_logs SET entry_time = ${entry_time}, exit_time = ${exit_time} WHERE id = ${id};
    `;
    const { rows: updatedLog } = await pool.sql`
        SELECT cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time 
        FROM commute_logs cl LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE cl.id = ${id};
    `;
    return response.status(200).json({ message: 'رکورد با موفقیت ویرایش شد.', log: updatedLog[0] });
  } catch (error) {
    console.error('Database PUT for commute_logs failed:', error);
    return response.status(500).json({ error: 'خطا در به‌روزرسانی اطلاعات.', details: (error as Error).message });
  }
}

// --- DELETE Handler ---
async function handleDelete(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id } = request.body;
  if (!id) return response.status(400).json({ error: 'شناسه رکورد برای حذف مورد نیاز است.' });
  try {
    const result = await pool.sql`DELETE FROM commute_logs WHERE id = ${id};`;
    if (result.rowCount === 0) return response.status(404).json({ error: 'رکوردی برای حذف یافت نشد.' });
    return response.status(200).json({ message: 'رکورد با موفقیت حذف شد.' });
  } catch (error) {
    console.error('Database DELETE for commute_logs failed:', error);
    return response.status(500).json({ error: 'خطا در حذف رکورد.', details: (error as Error).message });
  }
}

// --- Main Handler ---
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
  }
  
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });

  switch (request.method) {
    case 'GET': return await handleGet(request, response, pool);
    case 'PUT': return await handlePut(request, response, pool);
    case 'DELETE': return await handleDelete(request, response, pool);
    case 'POST': {
      const client = await pool.connect();
      try {
        return Array.isArray(request.body)
          ? await handleBulkPost(request, response, client)
          : await handleSinglePost(request, response, pool);
      } finally {
        client.release();
      }
    }
    default:
      response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }
}