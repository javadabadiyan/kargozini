import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  if (!process.env.STORAGE_URL) {
    return response.status(500).json({
        status: 'خطا',
        error: 'متغیر اتصال به پایگاه داده (STORAGE_URL) تنظیم نشده است.',
        details: 'لطفاً تنظیمات پروژه خود را در Vercel بررسی کنید و از اتصال صحیح پایگاه داده اطمینان حاصل کنید.'
    });
  }

  const pool = createPool({
    connectionString: process.env.STORAGE_URL,
  });

  try {
    const { rows } = await pool.sql`SELECT NOW();`;
    const dbTime = rows[0].now;
    return response.status(200).json({ 
        status: 'موفق', 
        message: 'اتصال به پایگاه داده با موفقیت برقرار شد.',
        databaseTime: dbTime 
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ 
        status: 'خطا',
        error: 'اتصال به پایگاه داده برقرار نشد.', 
        details: errorMessage 
    });
  }
}