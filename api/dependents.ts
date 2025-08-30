import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
    });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });

  const { personnel_code } = request.query;

  try {
    let result;
    if (personnel_code && typeof personnel_code === 'string') {
      result = await pool.sql`
        SELECT * FROM dependents 
        WHERE personnel_code = ${personnel_code}
        ORDER BY last_name, first_name;
      `;
    } else {
      // Fetch all for export
      result = await pool.sql`SELECT * FROM dependents ORDER BY personnel_code, last_name, first_name;`;
    }

    return response.status(200).json({ dependents: result.rows });
  } catch (error) {
    console.error('Database query for dependents failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (errorMessage.includes('relation "dependents" does not exist')) {
        return response.status(500).json({ 
            error: 'جدول بستگان (dependents) در پایگاه داده یافت نشد.', 
            details: 'لطفاً با مراجعه به آدرس /api/create-users-table از ایجاد جدول اطمینان حاصل کنید.' 
        });
    }

    return response.status(500).json({ error: 'Failed to fetch dependents data.', details: errorMessage });
  }
}
