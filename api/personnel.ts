import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  try {
    const { rows } = await sql`
      SELECT 
        id, personnel_code, first_name, last_name, father_name, national_id, id_number,
        birth_date, birth_place, issue_date, issue_place, marital_status, military_status,
        job_title, "position", employment_type, department, service_location, hire_date,
        education_level, field_of_study, status 
      FROM personnel 
      ORDER BY last_name, first_name;
    `;
    return response.status(200).json({ personnel: rows });
  } catch (error) {
    console.error('Database query failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Provide a more specific error if the table doesn't exist
    if (errorMessage.includes('relation "personnel" does not exist')) {
        return response.status(500).json({ 
            error: 'جدول پرسنل در پایگاه داده یافت نشد.', 
            details: 'به نظر می‌رسد جدول مورد نیاز ایجاد نشده است. لطفاً با مراجعه به آدرس /api/create-users-table از ایجاد جدول اطمینان حاصل کنید.' 
        });
    }

    return response.status(500).json({ error: 'Failed to fetch data from the database.', details: errorMessage });
  }
}
