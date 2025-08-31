import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CommuteLog } from '../types';

const PAGE_SIZE = 10;

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
    const page = parseInt(request.query.page as string) || 1;
    const pageSize = parseInt(request.query.pageSize as string) || PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const searchDate = request.query.searchDate as string; // Expects YYYY-MM-DD
    const searchTerm = (request.query.searchTerm as string) || '';
    
    const params: any[] = [];
    let paramIndex = 1;

    let dateFilterClause = '';
    if (searchDate) {
        dateFilterClause = `cl.entry_time >= ($${paramIndex++}::date AT TIME ZONE 'Asia/Tehran') AND cl.entry_time < ($${paramIndex++}::date + INTERVAL '1 day' AT TIME ZONE 'Asia/Tehran')`;
        params.push(searchDate, searchDate);
    } else {
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
    const client = await pool.connect();
    try {
        const countResult = await client.query(countQuery, params);
        const totalCount = parseInt(countResult.rows[0].count, 10);
        
        const dataParams = [...params, pageSize, offset];
        const dataQuery = `
            SELECT cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time, cl.log_type
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
async function handlePost(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const { personnelCode, personnelCodes, guardName, action, timestampOverride, leaveTime, returnTime } = request.body;

  if (!guardName || !action) {
    return response.status(400).json({ error: 'اطلاعات ارسالی ناقص یا نامعتبر است.' });
  }
  
  try {
    if (action === 'entry') {
        const codesToProcess = personnelCodes || (personnelCode ? [personnelCode] : []);
        if (codesToProcess.length === 0) {
            return response.status(400).json({ error: 'کد پرسنلی برای ثبت ورود الزامی است.' });
        }
        
        const effectiveTime = timestampOverride ? new Date(timestampOverride) : new Date();
        
        await client.query('BEGIN');
        
        const openLogsResult = await client.query(`
            SELECT personnel_code FROM commute_logs 
            WHERE 
                personnel_code = ANY($1) AND 
                exit_time IS NULL AND 
                entry_time >= date_trunc('day', $2::timestamptz AT TIME ZONE 'Asia/Tehran') AND
                entry_time < date_trunc('day', $2::timestamptz AT TIME ZONE 'Asia/Tehran') + interval '1 day';
        `, [codesToProcess, effectiveTime]);

        if (openLogsResult.rows.length > 0) {
            await client.query('ROLLBACK');
            const duplicateCodes = openLogsResult.rows.map(r => r.personnel_code).join(', ');
            return response.status(409).json({ error: `برای پرسنل با کدهای (${duplicateCodes}) یک ورود باز در این روز ثبت شده است.` });
        }
        
        for (const code of codesToProcess) {
           await client.query(`
            INSERT INTO commute_logs (personnel_code, guard_name, entry_time) 
            VALUES ($1, $2, $3);
           `, [code, guardName, effectiveTime]);
        }

        await client.query('COMMIT');
        return response.status(201).json({ message: `ورود برای ${codesToProcess.length} نفر با موفقیت ثبت شد.` });
    }
    
    if (action === 'exit') {
        const codesToProcess = personnelCodes || (personnelCode ? [personnelCode] : []);
        if (codesToProcess.length === 0) {
            return response.status(400).json({ error: 'کد پرسنلی برای ثبت خروج الزامی است.' });
        }
        const effectiveTime = timestampOverride ? new Date(timestampOverride) : new Date();

        await client.query('BEGIN');
        
        const updatedLogs = [];
        const notFoundCodes = [];

        for (const code of codesToProcess) {
            const { rows: openLogs } = await client.query(`
                SELECT id FROM commute_logs 
                WHERE 
                    personnel_code = $1 AND 
                    exit_time IS NULL AND 
                    entry_time >= date_trunc('day', $2::timestamptz AT TIME ZONE 'Asia/Tehran') AND
                    entry_time < date_trunc('day', $2::timestamptz AT TIME ZONE 'Asia/Tehran') + interval '1 day'
                ORDER BY entry_time DESC LIMIT 1;
            `, [code, effectiveTime]);
            
            if (openLogs.length > 0) {
                const logIdToUpdate = openLogs[0].id;
                const { rows: updated } = await client.query(`
                    UPDATE commute_logs 
                    SET exit_time = $1, guard_name = $2
                    WHERE id = $3
                    RETURNING *;
                `, [effectiveTime, guardName, logIdToUpdate]);
                updatedLogs.push(updated[0]);
            } else {
                notFoundCodes.push(code);
            }
        }

        await client.query('COMMIT');
        
        let message = `خروج برای ${updatedLogs.length} نفر با موفقیت ثبت شد.`;
        if (notFoundCodes.length > 0) {
            message += ` برای پرسنل با کدهای (${notFoundCodes.join(', ')}) ورود بازی در این روز یافت نشد.`;
        }

        return response.status(200).json({ message, updatedLogs });
    }

    if (action === 'short_leave') {
      if (!personnelCode || !guardName || !leaveTime || !returnTime) {
        return response.status(400).json({ error: 'برای تردد بین‌ساعتی، پرسنل، نگهبان، زمان خروج و بازگشت الزامی است.' });
      }
      const { rows } = await client.query(
        `INSERT INTO commute_logs (personnel_code, guard_name, entry_time, exit_time, log_type)
         VALUES ($1, $2, $3, $4, 'short_leave') RETURNING *;`,
        [personnelCode, guardName, returnTime, leaveTime]
      );
      return response.status(201).json({ message: 'تردد بین‌ساعتی ثبت شد.', log: rows[0] });
    }
    
    return response.status(400).json({ error: 'عملیات نامعتبر است.' });

  } catch (error) {
    await client.query('ROLLBACK').catch(rbError => console.error('Rollback failed:', rbError));
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
            values.push(log.personnel_code, log.guard_name, log.entry_time, log.exit_time || null, log.log_type || 'main');
            valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        }
        
        const query = `
            INSERT INTO commute_logs (personnel_code, guard_name, entry_time, exit_time, log_type)
            VALUES ${valuePlaceholders.join(', ')}
            ON CONFLICT (personnel_code, entry_time) 
            DO UPDATE SET 
                exit_time = EXCLUDED.exit_time, 
                guard_name = EXCLUDED.guard_name,
                log_type = EXCLUDED.log_type;
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

// --- PUT Handler (Update) ---
async function handlePut(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id, personnel_code, guard_name, entry_time, exit_time, log_type } = request.body;
  if (!id || !personnel_code || !guard_name || !entry_time) {
      return response.status(400).json({ error: 'اطلاعات ارسالی برای ویرایش ناقص است.' });
  }
  try {
      const { rows } = await pool.sql`
          UPDATE commute_logs SET
              personnel_code = ${personnel_code},
              guard_name = ${guard_name},
              entry_time = ${entry_time},
              exit_time = ${exit_time},
              log_type = ${log_type || 'main'}
          WHERE id = ${id}
          RETURNING *;
      `;
      if (rows.length === 0) {
          return response.status(404).json({ error: 'لاگ مورد نظر برای ویرایش یافت نشد.' });
      }
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT cl.*, cm.full_name 
           FROM commute_logs cl 
           LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code 
           WHERE cl.id = $1`, [id]
        );
        return response.status(200).json({ message: 'تردد با موفقیت ویرایش شد.', log: result.rows[0] });
      } finally {
        client.release();
      }
  } catch (error) {
      console.error('Database PUT for commute_logs failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (errorMessage.includes('unique_commute_log')) {
        return response.status(409).json({ error: 'رکورد تکراری', details: 'یک تردد دیگر برای این پرسنل در همین زمان ورود وجود دارد.' });
      }
      return response.status(500).json({ error: 'خطا در ویرایش تردد.', details: errorMessage });
  }
}


// --- DELETE Handler ---
async function handleDelete(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id } = request.query;
  if (!id || typeof id !== 'string') {
      return response.status(400).json({ error: 'شناسه لاگ برای حذف مورد نیاز است.' });
  }
  try {
      const result = await pool.sql`DELETE FROM commute_logs WHERE id = ${parseInt(id, 10)};`;
      if (result.rowCount === 0) {
          return response.status(404).json({ error: 'لاگ مورد نظر برای حذف یافت نشد.' });
      }
      return response.status(200).json({ message: 'تردد با موفقیت حذف شد.' });
  } catch (error) {
      console.error('Database DELETE for commute_logs failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return response.status(500).json({ error: 'خطا در حذف تردد.', details: errorMessage });
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
  const client = await pool.connect();
  try {
    switch (request.method) {
      case 'GET':
          return await handleGet(request, response, pool);
      case 'POST': {
          if (Array.isArray(request.body)) {
              return await handleBulkPost(request.body, response, client);
          }
          return await handlePost(request, response, client);
      }
      case 'PUT':
          return await handlePut(request, response, pool);
      case 'DELETE':
          return await handleDelete(request, response, pool);
      default:
          response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
          return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
    }
  } finally {
      client.release();
  }
}