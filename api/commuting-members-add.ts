import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CommutingMember } from '../types';

type NewCommutingMember = Omit<CommutingMember, 'id'>;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
  
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
    });
  }

  const m = request.body as NewCommutingMember;

  if (!m || !m.personnel_code || !m.full_name) {
    return response.status(400).json({ error: 'کد پرسنلی و نام و نام خانوادگی الزامی هستند.' });
  }

  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });

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
    console.error('Database insert failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage.includes('duplicate key value violates unique constraint "commuting_members_personnel_code_key"')) {
        return response.status(409).json({ error: 'کد پرسنلی وارد شده تکراری است.', details: 'یک عضو دیگر با این کد پرسنلی وجود دارد.' });
    }

    return response.status(500).json({ error: 'خطا در افزودن اطلاعات به پایگاه داده.', details: errorMessage });
  }
}
