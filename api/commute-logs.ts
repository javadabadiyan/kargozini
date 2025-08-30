import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CommuteLog } from '../types';

const PAGE_SIZE = 20;

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
    const page = parseInt(request.query.page as string) || 1;
    const offset = (page - 1) * PAGE_SIZE;

    const searchDate = request.query.searchDate as string; // Expects YYYY-MM-DD
    const searchTerm = (request.query.searchTerm as string) || '';
    
    const params: any[] = [];
    let paramIndex = 1;

    let dateFilterClause = '';
    if (searchDate) {
        // Use Asia/Tehran timezone to correctly define the day's boundaries
        dateFilterClause = `cl.entry_time >= ($${paramIndex++}::date AT TIME ZONE 'Asia/Tehran') AND cl.entry_time < ($${paramIndex++}::date + INTERVAL '1 day' AT TIME ZONE 'Asia/Tehran')`;
        params.push(searchDate, searchDate);
    } else {
        // Default to the current day in Asia/Tehran timezone
        dateFilterClause = `cl.entry_time >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Tehran')) AND cl.entry_time < (date_trunc('day', NOW() AT TIME ZONE 'Asia/Tehran') + INTERVAL '1 day')`;
    }

    let searchTermClause = '';
    if (searchTerm) {
      searchTermClause = `AND (cm.full_name ILIKE $${paramIndex++} OR cl.personnel_code ILIKE $${paramIndex++})`;
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    const baseQuery = `
        FROM commute_logs cl
        LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE ${dateFilterClause} ${searchTermClause}
    `;

    const countQuery = `SELECT COUNT(cl.id) ${baseQuery}`;
    // The pool from createPool doesn't directly support parameterized queries in this manner,
    // so we use the client's query method which does.
    const client = await pool.connect();
    try {
        const countResult = await client.query(countQuery, params);
        const totalCount = parseInt(countResult.rows[0].count, 10);
        
        const dataParams = [...params, PAGE_SIZE, offset];
        const dataQuery = `
            SELECT cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time 
            ${baseQuery}
            ORDER BY cl.entry_time DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2};
        `;
        const dataResult = await client.query(dataQuery, dataParams);
        
        return response.status(200).json({ logs: dataResult.rows, totalCount });
    } finally {
        client.release();
    }

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
    // Find an open log for the specific day of the effectiveTime, considering Tehran's timezone
    const { rows: openLogs } = await pool.sql`
        SELECT id FROM commute_logs 
        WHERE 
            personnel_code = ${personnelCode} AND 
            exit_time IS NULL AND 
            entry_time >= date_trunc('day', ${effectiveTime}::timestamptz AT TIME ZONE 'Asia/Tehran') AND
            entry_time < date_trunc('day', ${effectiveTime}::timestamptz AT TIME ZONE 'Asia/Tehran') + interval '1 day';
    `;
    const openLog = openLogs[0];

    if (action === 'entry') {
        if (openLog) {
            return response.status(409).json({ error: 'برای این پرسنل یک ورود باز در این روز ثبت شده است. ابتدا باید خروج ثبت شود.' });
        }
        const { rows: newLog } = await pool.sql`
            INSERT INTO commute_logs (personnel_code, guard_name, entry_time) 
            VALUES (${personnelCode}, ${guardName}, ${effectiveTime}) 
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
            SET exit_time = ${effectiveTime}
            WHERE id = ${openLog.id}
            RETURNING *;
        `;
        return response.status(200).json({ message: 'خروج با موفقیت ثبت شد.', log: updatedLog[0] });
    }
    
    return response.status(400).json({ error: 'عملیات نامعتبر است.' });

  } catch (error) {
    console.error('Database POST for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

type BulkLog = Omit<CommuteLog, 'id' | 'full_name'>;

async function handleBulkPost(allLogs: BulkLog[], response: VercelResponse, client: VercelPoolClient) {
    const validList = allLogs.filter(log => log.personnel_code && log.guard_name && log.entry_time);

    if (validList.length === 0) {
        return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد. کد پرسنلی، نام نگهبان و زمان ورود الزامی هستند.'});
    }

    try {
        await (client as any).query('BEGIN');

        const values: (string | null)[] = [];
        const valuePlaceholders: string[] = [];
        let paramIndex = 1;

        for (const log of validList) {
            values.push(log.personnel_code, log.guard_name, log.entry_time, log.exit_time || null);
            valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        }
        
        const query = `
            INSERT INTO commute_logs (personnel_code, guard_name, entry_time, exit_time)
            VALUES ${valuePlaceholders.join(', ')}
            ON CONFLICT (personnel_code, entry_time) 
            DO UPDATE SET 
                exit_time = EXCLUDED.exit_time, 
                guard_name = EXCLUDED.guard_name;
        `;

        await (client as any).query(query, values);
        await (client as any).query('COMMIT');

        return response.status(200).json({ message: `عملیات موفق. ${validList.length} رکورد پردازش شد.`});

    } catch(error) {
        await (client as any).query('ROLLBACK').catch((rbError: any) => console.error('Rollback failed:', rbError));
        console.error('Database bulk POST for commute_logs failed:', error);
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

  if (request.method === 'POST') {
      const client = await pool.connect();
      try {
          if (Array.isArray(request.body)) {
              return await handleBulkPost(request.body, response, client);
          }
          return await handleSinglePost(request, response, pool);
      } finally {
          client.release();
      }
  }

  if (request.method === 'GET') {
      return await handleGet(request, response, pool);
  }

  response.setHeader('Allow', ['GET', 'POST']);
  return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
}