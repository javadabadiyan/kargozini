import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  try {
    const { rows } = await sql`SELECT NOW();`;
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
