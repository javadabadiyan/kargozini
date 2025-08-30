import { createPool, VercelPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CommutingMember } from '../types';

type NewCommutingMember = Omit<CommutingMember, 'id'>;

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
    const result = await pool.sql`
        SELECT id, full_name, personnel_code, department, "position" 
        FROM commuting_members 
        ORDER BY full_name;
    `;
    return response.status(200).json({ members: result.rows });
  } catch (error) {
    console.error('Database GET for commuting_members failed:', error);
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

// --- POST Handler (Add) ---
async function handlePost(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const m = request.body as NewCommutingMember;
  if (!m || !m.personnel_code || !m.full_name) {
    return response.status(400).json({ error: 'کد پرسنلی و نام و نام خانوادگی الزامی هستند.' });
  }
  try {
    const { rows } = await pool.sql`
      INSERT INTO commuting_members (
        personnel_code, full_name, department, "position"
      ) VALUES (
        ${m.personnel_code}, ${m.full_name}, ${m.department}, ${m.position}
      )
      RETURNING *;
    `;
    return response.status(201).json({ message: 'عضو جدید با موفقیت اضافه شد.', member: rows[0] });
  } catch (error) {
    console.error('Database POST for commuting_members failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    if (errorMessage.includes('duplicate key value violates unique constraint "commuting_members_personnel_code_key"')) {
        return response.status(409).json({ error: 'کد پرسنلی وارد شده تکراری است.', details: 'یک عضو دیگر با این کد پرسنلی وجود دارد.' });
    }
    return response.status(500).json({ error: 'خطا در افزودن اطلاعات به پایگاه داده.', details: errorMessage });
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
    default:
      response.setHeader('Allow', ['GET', 'POST']);
      return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }
}
