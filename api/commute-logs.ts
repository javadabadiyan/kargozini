import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CommuteLog } from '../types';

type NewCommuteLog = Omit<CommuteLog, 'id'>;

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
    const todayInTehran = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
    const searchDate = (request.query.date as string) || todayInTehran;
    const searchTerm = (request.query.searchTerm as string) || '';
    const searchQuery = `%${searchTerm}%`;

    let result;
    if (searchTerm) {
      result = await pool.sql`
        SELECT cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time, cl.log_type 
        FROM commute_logs cl
        LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') = ${searchDate}
        AND (cm.full_name ILIKE ${searchQuery} OR cl.personnel_code ILIKE ${searchQuery})
        ORDER BY cl.entry_time DESC;
      `;
    } else {
      result = await pool.sql`
        SELECT cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time, cl.log_type 
        FROM commute_logs cl
        LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') = ${searchDate}
        ORDER BY cl.entry_time DESC;
      `;
    }
    return response.status(200).json({ logs: result.rows });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'Failed to fetch commute logs data.', details: errorMessage });
  }
}


// --- POST Handler (Single Action) ---
async function handleSinglePost(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { personnelCodes, guardName, action, timestampOverride, logType, exitTime: shortLeaveExitTime, entryTime: shortLeaveEntryTime } = request.body;
  
    if (!personnelCodes || !Array.isArray(personnelCodes) || personnelCodes.length === 0 || !guardName || !action) {
      return response.status(400).json({ error: 'اطلاعات ارسالی ناقص یا نامعتبر است.' });
    }
  
    const effectiveTime = timestampOverride ? new Date(timestampOverride).toISOString() : new Date().toISOString();
  
    if (logType === 'short_leave') {
        const personnelCode = personnelCodes[0];
        try {
            const { rows } = await pool.sql`
                INSERT INTO commute_logs (personnel_code, guard_name, entry_time, exit_time, log_type)
                VALUES (${personnelCode}, ${guardName}, ${shortLeaveEntryTime}, ${shortLeaveExitTime}, 'short_leave')
                RETURNING *;
            `;
            return response.status(201).json({ message: 'تردد بین ساعتی با موفقیت ثبت شد.', log: rows[0] });
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
             return response.status(500).json({ error: 'خطا در ثبت تردد بین ساعتی.', details: errorMessage });
        }
    }
  
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let successCount = 0;
      const errors = [];
  
      for (const personnelCode of personnelCodes) {
        if (action === 'entry') {
          const { rows: newLog } = await client.sql`
            INSERT INTO commute_logs (personnel_code, guard_name, entry_time) 
            VALUES (${personnelCode}, ${guardName}, ${effectiveTime}) 
            ON CONFLICT (personnel_code, (DATE(entry_time AT TIME ZONE 'Asia/Tehran'))) DO NOTHING
            RETURNING id;
          `;
          if (newLog.length > 0) successCount++;
        } else if (action === 'exit') {
          const { rows: updatedLog } = await client.sql`
            UPDATE commute_logs 
            SET exit_time = ${effectiveTime}
            WHERE personnel_code = ${personnelCode}
              AND DATE(entry_time AT TIME ZONE 'Asia/Tehran') = DATE(${effectiveTime}::timestamptz AT TIME ZONE 'Asia/Tehran')
              AND exit_time IS NULL
              AND log_type = 'main'
            RETURNING id;
          `;
          if (updatedLog.length > 0) successCount++;
        }
      }
  
      await client.query('COMMIT');
      return response.status(200).json({ message: `عملیات برای ${successCount} نفر با موفقیت انجام شد.` });
  
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
    } finally {
      client.release();
    }
}


// --- POST Handler (Bulk Import from Excel) ---
async function handleBulkPost(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const logs = request.body as NewCommuteLog[];
    if (!Array.isArray(logs) || logs.length === 0) {
        return response.status(400).json({ error: 'هیچ رکوردی برای ورود یافت نشد.' });
    }
  
    try {
      await client.query('BEGIN');
  
      const values: (string | null)[] = [];
      let paramIndex = 1;
      const valuePlaceholders: string[] = [];
  
      for (const log of logs) {
        values.push(log.personnel_code, log.guard_name, log.entry_time, log.exit_time);
        valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}::timestamptz, $${paramIndex++}::timestamptz)`);
      }
  
      const query = `
        INSERT INTO commute_logs (personnel_code, guard_name, entry_time, exit_time)
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (personnel_code, (DATE(entry_time AT TIME ZONE 'Asia/Tehran'))) 
        DO UPDATE SET 
            guard_name = EXCLUDED.guard_name,
            entry_time = EXCLUDED.entry_time,
            exit_time = EXCLUDED.exit_time,
            updated_at = NOW();
      `;
      
      await (client as any).query(query, values);
      await client.query('COMMIT');
      
      return response.status(200).json({ message: `عملیات موفق. ${logs.length} رکورد پردازش شد.` });
  
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (errorMessage.includes('violates foreign key constraint')) {
        return response.status(400).json({ error: 'یک یا چند کد پرسنلی در فایل اکسل نامعتبر است.' });
      }
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
    const { rows } = await pool.sql`
      UPDATE commute_logs SET entry_time = ${entry_time}, exit_time = ${exit_time} WHERE id = ${id} RETURNING id;
    `;
    if (rows.length === 0) {
      return response.status(404).json({ error: 'رکوردی برای ویرایش یافت نشد.' });
    }
    const { rows: updatedLog } = await pool.sql`
        SELECT cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time, cl.log_type
        FROM commute_logs cl LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code WHERE cl.id = ${id};
    `;
    return response.status(200).json({ message: 'رکورد با موفقیت ویرایش شد.', log: updatedLog[0] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'خطا در به‌روزرسانی اطلاعات.', details: errorMessage });
  }
}

// --- DELETE Handler ---
async function handleDelete(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id } = request.body;
  if (!id) {
    return response.status(400).json({ error: 'شناسه رکورد برای حذف مورد نیاز است.' });
  }
  try {
    const result = await pool.sql`DELETE FROM commute_logs WHERE id = ${id};`;
    if (result.rowCount === 0) {
      return response.status(404).json({ error: 'رکوردی برای حذف یافت نشد.' });
    }
    return response.status(200).json({ message: 'رکورد با موفقیت حذف شد.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'خطا در حذف رکورد.', details: errorMessage });
  }
}

// --- Main Handler ---
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
  }
  
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();

  try {
    switch (request.method) {
      case 'GET':
        return await handleGet(request, response, pool);
      case 'POST':
        // Differentiate between bulk import and single action based on structure
        if (Array.isArray(request.body) && request.body[0]?.entry_time) {
             return await handleBulkPost(request, response, client);
        }
        return await handleSinglePost(request, response, pool);
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