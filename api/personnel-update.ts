import { db } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel } from '../types';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    return response.status(500).json({ error: "Database connection string is not configured.", details: "DATABASE_URL or POSTGRES_URL environment variable is missing." });
  }
  
  if (request.method !== 'PUT') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const p = request.body as Personnel;

  if (!p || !p.id) {
    return response.status(400).json({ error: 'اطلاعات پرسنل یا شناسه نامعتبر است.' });
  }

  const client = await db.connect();
  try {
    // Note: "position" is a reserved keyword in SQL, so it needs to be double-quoted.
    await client.sql`
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
      WHERE id = ${p.id};
    `;
    return response.status(200).json({ message: 'اطلاعات پرسنل با موفقیت به‌روزرسانی شد.', personnel: p });
  } catch (error) {
    console.error('Database update failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'خطا در به‌روزرسانی اطلاعات در پایگاه داده.', details: errorMessage });
  } finally {
    client.release();
  }
}
