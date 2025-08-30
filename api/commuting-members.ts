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

  try {
    const result = await pool.sql`
        SELECT id, full_name, personnel_code, department, "position" 
        FROM commuting_members 
        ORDER BY full_name;
    `;
    return response.status(200).json({ members: result.rows });
  } catch (error) {
    console.error('Database query for commuting_members failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (errorMessage.includes('relation "commuting_members" does not exist')) {
        return response.status(500).json({ 
            error: 'جدول کارمندان عضو تردد در پایگاه داده یافت نشد.', 
            details: 'لطفاً با مراجعه به آدرس /api/create-users-table از ایجاد جدول اطمینان حاصل کنید.' 
        });
    }

    return response.status(500).json({ error: 'Failed to fetch commuting members data.', details: errorMessage });
  }
}
