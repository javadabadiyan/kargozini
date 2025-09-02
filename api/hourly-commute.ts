import { createPool, VercelPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { status, date } = request.query;
  try {
    let result;
    if (status === 'active') {
      result = await pool.sql`
        SELECT * FROM hourly_commute_logs
        WHERE return_time IS NULL
        ORDER BY exit_time DESC;
      `;
    } else if (date && typeof date === 'string') {
      result = await pool.sql`
        SELECT * FROM hourly_commute_logs
        WHERE DATE(exit_time AT TIME ZONE 'Asia/Tehran') = ${date} AND return_time IS NOT NULL
        ORDER BY exit_time DESC;
      `;
    } else {
        return response.status(400).json({ error: 'Query parameter "status=active" or "date=YYYY-MM-DD" is required.' });
    }
    return response.status(200).json({ logs: result.rows });
  } catch (error) {
    console.error('Database GET for hourly_commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    if (errorMessage.includes('relation "hourly_commute_logs" does not exist')) {
        return response.status(500).json({ 
            error: 'جدول تردد ساعتی در پایگاه داده یافت نشد.', 
            details: 'لطفاً با مراجعه به آدرس /api/create-users-table از ایجاد جدول اطمینان حاصل کنید.' 
        });
    }
    return response.status(500).json({ error: 'Failed to fetch hourly commute logs.', details: errorMessage });
  }
}

// --- POST Handler (Log Exit) ---
async function handlePost(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { personnel_code, full_name, reason, guard_name } = request.body;

  if (!personnel_code || !full_name || !guard_name) {
    return response.status(400).json({ error: 'کد پرسنلی، نام و نام نگهبان الزامی است.' });
  }

  try {
    const { rows: activeLogs } = await pool.sql`
        SELECT id FROM hourly_commute_logs
        WHERE personnel_code = ${personnel_code} AND return_time IS NULL;
    `;
    if (activeLogs.length > 0) {
        return response.status(409).json({ error: 'این پرسنل در حال حاضر یک خروج ساعتی فعال دارد.' });
    }

    const { rows: newLog } = await pool.sql`
      INSERT INTO hourly_commute_logs (personnel_code, full_name, reason, guard_name) 
      VALUES (${personnel_code}, ${full_name}, ${reason}, ${guard_name}) 
      RETURNING *;
    `;
    return response.status(201).json({ message: 'خروج ساعتی با موفقیت ثبت شد.', log: newLog[0] });
  } catch (error) {
    console.error('Database POST for hourly_commute_logs failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

// --- PUT Handler (Log Return) ---
async function handlePut(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id } = request.body;
  if (!id) {
    return response.status(400).json({ error: 'شناسه رکورد برای ثبت بازگشت الزامی است.' });
  }
  try {
    const { rows } = await pool.sql`
      UPDATE hourly_commute_logs 
      SET return_time = NOW()
      WHERE id = ${id} AND return_time IS NULL
      RETURNING *;
    `;
    if (rows.length === 0) {
      return response.status(404).json({ error: 'رکورد خروج فعالی برای بروزرسانی یافت نشد.' });
    }
    return response.status(200).json({ message: 'بازگشت با موفقیت ثبت شد.', log: rows[0] });
  } catch (error) {
    console.error('Database PUT for hourly_commute_logs failed:', error);
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
    return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
  }
  
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });

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
