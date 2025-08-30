import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel } from '../types';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'PUT') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const p = request.body as Personnel;

  if (!p || !p.id) {
    return response.status(400).json({ error: 'اطلاعات پرسنل یا شناسه نامعتبر است.' });
  }

  try {
    const { rows } = await sql`
      UPDATE personnel SET
        personnel_code = ${p.personnel_code},
        first_name = ${p.first_name},
        last_name = ${p.last_name},
        father_name = ${p.father_name},
        national_id = ${p.national_id},
        id_number = ${p.id_number},
        birth_date = ${p.birth_date},
        birth_place = ${p.birth_place},
        issue_date = ${p.issue_date},
        issue_place = ${p.issue_place},
        marital_status = ${p.marital_status},
        military_status = ${p.military_status},
        job_title = ${p.job_title},
        "position" = ${p.position},
        employment_type = ${p.employment_type},
        department = ${p.department},
        service_location = ${p.service_location},
        hire_date = ${p.hire_date},
        education_level = ${p.education_level},
        field_of_study = ${p.field_of_study},
        status = ${p.status}
      WHERE id = ${p.id}
      RETURNING *;
    `;
    
    if (rows.length === 0) {
        return response.status(404).json({ error: 'پرسنلی با این شناسه یافت نشد.'});
    }

    return response.status(200).json({ message: 'اطلاعات پرسنل با موفقیت به‌روزرسانی شد.', personnel: rows[0] });
  } catch (error) {
    console.error('Database update failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    // Handle unique constraint violation on personnel_code
    if (errorMessage.includes('duplicate key value violates unique constraint "personnel_personnel_code_key"')) {
        return response.status(409).json({ error: 'کد پرسنلی وارد شده تکراری است.', details: 'یک پرسنل دیگر با این کد پرسنلی وجود دارد.' });
    }
    // Handle unique constraint violation on national_id
    if (errorMessage.includes('duplicate key value violates unique constraint "personnel_national_id_key"')) {
        return response.status(409).json({ error: 'کد ملی وارد شده تکراری است.', details: 'یک پرسنل دیگر با این کد ملی وجود دارد.' });
    }

    return response.status(500).json({ error: 'خطا در به‌روزرسانی اطلاعات در پایگاه داده.', details: errorMessage });
  }
}
