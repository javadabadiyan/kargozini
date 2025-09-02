import { createPool, VercelPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { personnel_code, date } = request.query;
  if (!personnel_code || !date || typeof personnel_code !== 'string' || typeof date !== 'string') {
    return response.status(400).json({ error: 'کد پرسنلی و تاریخ برای جستجو الزامی است.' });
  }

  try {
    // This query now correctly fetches logs if either the exit_time OR entry_time falls on the specified date.
    const result = await pool.sql`
        SELECT * FROM hourly_commute_logs
        WHERE 
            personnel_code = ${personnel_code} AND 
            DATE(COALESCE(exit_time, entry_time) AT TIME ZONE 'Asia/Tehran') = ${date}
        ORDER BY COALESCE(exit_time, entry_time) DESC;
    `;
    return response.status(200).json({ logs: result.rows });
  } catch (error) {
    console.error('Database GET for hourly_commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'Failed to fetch hourly commute logs.', details: errorMessage });
  }
}

// --- POST Handler (Log Exit or Entry) ---
async function handlePost(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { personnel_code, full_name, guard_name, exit_time, entry_time, reason } = request.body;

  if (!personnel_code || !full_name || !guard_name || (!exit_time && !entry_time)) {
    return response.status(400).json({ error: 'اطلاعات ارسالی ناقص است. زمان ورود یا خروج باید مشخص باشد.' });
  }
  
  try {
    const { rows } = await pool.sql`
        INSERT INTO hourly_commute_logs (personnel_code, full_name, guard_name, exit_time, entry_time, reason)
        VALUES (${personnel_code}, ${full_name}, ${guard_name}, ${exit_time || null}, ${entry_time || null}, ${reason || null})
        RETURNING *;
    `;
    const message = exit_time ? 'خروج ساعتی با موفقیت ثبت شد.' : 'ورود ساعتی با موفقیت ثبت شد.';
    return response.status(201).json({ message, log: rows[0] });
  } catch (error) {
    console.error('Database POST for hourly_commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

// --- PUT Handler (Update/Log Entry) ---
async function handlePut(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id } = request.query;
  if (!id || typeof id !== 'string') {
    return response.status(400).json({ error: 'شناسه رکورد برای ویرایش الزامی است.' });
  }

  const { exit_time, entry_time, reason, guard_name } = request.body;

  try {
    const { rows: existingLog } = await pool.sql`SELECT * FROM hourly_commute_logs WHERE id = ${id}`;
    if (existingLog.length === 0) {
      return response.status(404).json({ error: 'رکوردی برای ویرایش یافت نشد.' });
    }

    const updatedLog = { ...existingLog[0], ...request.body };
    
    const { rows } = await pool.sql`
      UPDATE hourly_commute_logs 
      SET 
        exit_time = ${updatedLog.exit_time},
        entry_time = ${updatedLog.entry_time},
        reason = ${updatedLog.reason},
        guard_name = ${updatedLog.guard_name}
      WHERE id = ${id}
      RETURNING *;
    `;
    
    return response.status(200).json({ message: 'رکورد با موفقیت ویرایش شد.', log: rows[0] });
  } catch (error) {
    console.error('Database PUT for hourly_commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'خطا در به‌روزرسانی اطلاعات در پایگاه داده.', details: errorMessage });
  }
}

// --- DELETE Handler ---
async function handleDelete(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id } = request.query;
  if (!id || typeof id !== 'string') {
    return response.status(400).json({ error: 'شناسه رکورد برای حذف مورد نیاز است.' });
  }
  try {
    const result = await pool.sql`DELETE FROM hourly_commute_logs WHERE id = ${id};`;
    if (result.rowCount === 0) {
      return response.status(404).json({ error: 'رکوردی برای حذف یافت نشد.' });
    }
    return response.status(200).json({ message: 'رکورد با موفقیت حذف شد.' });
  } catch (error) {
    console.error('Database DELETE for hourly_commute_logs failed:', error);
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