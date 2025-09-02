import { createPool, VercelPool, sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
    const todayInTehran = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    const searchDate = (request.query.date as string) || todayInTehran;
    const personnelCode = request.query.personnel_code as string;

    // FIX: The dynamic query composition was incorrect. 
    // Replaced with a conditional approach using sql fragments for better readability and correctness.
    const selectFromJoin = sql`
        SELECT 
            cl.id, cl.personnel_code, cm.full_name, 
            cl.guard_name, cl.entry_time, cl.exit_time, cl.description
        FROM commute_logs cl
        LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
    `;
    
    const whereDate = sql`WHERE DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') = ${searchDate}`;

    let result;
    if (personnelCode) {
        // For the modal, we want to see the logs in chronological order.
        result = await pool.sql`${selectFromJoin} ${whereDate} AND cl.personnel_code = ${personnelCode} ORDER BY cl.entry_time ASC`;
    } else {
        // For the main page, descending.
        result = await pool.sql`${selectFromJoin} ${whereDate} ORDER BY cl.entry_time DESC`;
    }

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
  const { personnelCode, guardName, action, timestampOverride, description } = request.body;

  if (!personnelCode || !guardName || !action || !['entry', 'exit'].includes(action)) {
    return response.status(400).json({ error: 'اطلاعات ارسالی ناقص یا نامعتبر است.' });
  }
  
  const effectiveTime = timestampOverride ? new Date(timestampOverride).toISOString() : 'NOW()';

  try {
    const { rows: openLogs } = await pool.sql`
        SELECT id FROM commute_logs 
        WHERE personnel_code = ${personnelCode} AND exit_time IS NULL
        ORDER BY entry_time DESC LIMIT 1;
    `;
    const openLog = openLogs[0];

    if (action === 'entry') {
        if (openLog) {
            return response.status(409).json({ error: 'برای این پرسنل یک ورود باز ثبت شده است. ابتدا باید خروج ثبت شود.' });
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
            return response.status(404).json({ error: 'هیچ ورود بازی برای این پرسنل یافت نشد تا خروج ثبت شود.' });
        }
        const { rows: updatedLog } = await pool.sql`
            UPDATE commute_logs 
            SET exit_time = ${effectiveTime}, description = ${description || null}
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

// --- PUT Handler (Update) ---
async function handlePut(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id, entry_time, exit_time, description } = request.body;
  if (!id || !entry_time) {
    return response.status(400).json({ error: 'شناسه و زمان ورود برای ویرایش الزامی است.' });
  }
  try {
    const { rows } = await pool.sql`
      UPDATE commute_logs 
      SET entry_time = ${entry_time}, exit_time = ${exit_time}, description = ${description || null}
      WHERE id = ${id}
      RETURNING id;
    `;
    if (rows.length === 0) {
      return response.status(404).json({ error: 'رکوردی برای ویرایش یافت نشد.' });
    }
    
    const { rows: updatedLogWithDetails } = await pool.sql`
        SELECT 
            cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time, cl.description
        FROM commute_logs cl
        LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE cl.id = ${id};
    `;

    return response.status(200).json({ message: 'رکورد با موفقیت ویرایش شد.', log: updatedLogWithDetails[0] });
  } catch (error) {
    console.error('Database PUT for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'خطا در به‌روزرسانی اطلاعات در پایگاه داده.', details: errorMessage });
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
    console.error('Database DELETE for commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'خطا در حذف رکورد از پایگاه داده.', details: errorMessage });
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
    case 'PUT':
      return await handlePut(request, response, pool);
    case 'DELETE':
      return await handleDelete(request, response, pool);
    default:
      response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }
}