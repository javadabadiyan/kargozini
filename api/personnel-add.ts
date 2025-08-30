import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel } from '../types';

type NewPersonnel = Omit<Personnel, 'id'>;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
  
  if (!process.env.STORAGE_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (STORAGE_URL) تنظیم نشده است.',
        details: 'لطفاً تنظیمات پروژه خود را در Vercel بررسی کنید و از اتصال صحیح پایگاه داده اطمینان حاصل کنید.'
    });
  }

  const p = request.body as NewPersonnel;

  if (!p || !p.personnel_code || !p.first_name || !p.last_name) {
    return response.status(400).json({ error: 'کد پرسنلی، نام و نام خانوادگی الزامی هستند.' });
  }

  const pool = createPool({
    connectionString: process.env.STORAGE_URL,
  });

  try {
    const { rows } = await pool.sql`
      INSERT INTO personnel (
        personnel_code, first_name, last_name, father_name, national_id, id_number,
        birth_date, birth_place, issue_date, issue_place, marital_status, military_status,
        job_title, "position", employment_type, department, service_location, hire_date,
        education_level, field_of_study, status
      ) VALUES (
        ${p.personnel_code}, ${p.first_name}, ${p.last_name}, ${p.father_name}, ${p.national_id}, ${p.id_number},
        ${p.birth_date}, ${p.birth_place}, ${p.issue_date}, ${p.issue_place}, ${p.marital_status}, ${p.military_status},
        ${p.job_title}, ${p.position}, ${p.employment_type}, ${p.department}, ${p.service_location}, ${p.hire_date},
        ${p.education_level}, ${p.field_of_study}, ${p.status}
      )
      RETURNING *;
    `;
    
    return response.status(201).json({ message: 'پرسنل جدید با موفقیت اضافه شد.', personnel: rows[0] });
  } catch (error) {
    console.error('Database insert failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage.includes('duplicate key value violates unique constraint "personnel_personnel_code_key"')) {
        return response.status(409).json({ error: 'کد پرسنلی وارد شده تکراری است.', details: 'یک پرسنل دیگر با این کد پرسنلی وجود دارد.' });
    }
    if (errorMessage.includes('duplicate key value violates unique constraint "personnel_national_id_key"')) {
        return response.status(409).json({ error: 'کد ملی وارد شده تکراری است.', details: 'یک پرسنل دیگر با این کد ملی وجود دارد.' });
    }

    return response.status(500).json({ error: 'خطا در افزودن اطلاعات به پایگاه داده.', details: errorMessage });
  }
}