import { db } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel } from '../types';

type NewPersonnel = Omit<Personnel, 'id'>;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    return response.status(500).json({ error: "Database connection string is not configured.", details: "DATABASE_URL or POSTGRES_URL environment variable is missing." });
  }
  
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const personnelList = request.body as NewPersonnel[];

  if (!Array.isArray(personnelList) || personnelList.length === 0) {
    return response.status(400).json({ error: 'لیست پرسنل نامعتبر یا خالی است.' });
  }

  const client = await db.connect();
  try {
    await client.sql`BEGIN`;

    for (const p of personnelList) {
      if (!p.personnel_code || !p.first_name || !p.last_name) {
           console.warn('Skipping record due to missing required fields (personnel_code, first_name, last_name):', p);
           continue; // Skip this record
      }
      
      await client.sql`
        INSERT INTO personnel (
          personnel_code, first_name, last_name, father_name, national_id, id_number,
          birth_date, birth_place, issue_date, issue_place, marital_status, military_status,
          job_title, "position", employment_type, department, service_location, hire_date,
          education_level, field_of_study, status
        ) VALUES (
          ${p.personnel_code || null}, ${p.first_name || null}, ${p.last_name || null}, ${p.father_name || null}, ${p.national_id || null}, ${p.id_number || null},
          ${p.birth_date || null}, ${p.birth_place || null}, ${p.issue_date || null}, ${p.issue_place || null}, ${p.marital_status || null}, ${p.military_status || null},
          ${p.job_title || null}, ${p.position || null}, ${p.employment_type || null}, ${p.department || null}, ${p.service_location || null}, ${p.hire_date || null},
          ${p.education_level || null}, ${p.field_of_study || null}, ${p.status || null}
        )
        ON CONFLICT (personnel_code) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          father_name = EXCLUDED.father_name,
          national_id = EXCLUDED.national_id,
          id_number = EXCLUDED.id_number,
          birth_date = EXCLUDED.birth_date,
          birth_place = EXCLUDED.birth_place,
          issue_date = EXCLUDED.issue_date,
          issue_place = EXCLUDED.issue_place,
          marital_status = EXCLUDED.marital_status,
          military_status = EXCLUDED.military_status,
          job_title = EXCLUDED.job_title,
          "position" = EXCLUDED."position",
          employment_type = EXCLUDED.employment_type,
          department = EXCLUDED.department,
          service_location = EXCLUDED.service_location,
          hire_date = EXCLUDED.hire_date,
          education_level = EXCLUDED.education_level,
          field_of_study = EXCLUDED.field_of_study,
          status = EXCLUDED.status;
      `;
    }
    
    await client.sql`COMMIT`;

    return response.status(200).json({ message: `اطلاعات با موفقیت پردازش شد. رکوردهای جدید اضافه و رکوردهای موجود به‌روزرسانی شدند.` });
  } catch (error) {
    await client.sql`ROLLBACK`;
    console.error('Database transaction failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'تراکنش پایگاه داده با شکست مواجه شد.', details: errorMessage });
  } finally {
    client.release();
  }
}
