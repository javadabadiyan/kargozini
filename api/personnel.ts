import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    const page = parseInt(request.query.page as string) || 1;
    const pageSize = parseInt(request.query.pageSize as string) || 20; // Set a default page size
    const searchTerm = (request.query.searchTerm as string) || '';
    const offset = (page - 1) * pageSize;

    // Use '%' for wildcard matching in SQL ILIKE for case-insensitive search
    const searchQuery = `%${searchTerm}%`;
    
    // Fix: The `sql` tag from `@vercel/postgres` returns a Promise and its results cannot be composed.
    // The query logic has been rewritten to conditionally build the entire query.
    let countResult;
    let dataResult;

    if (searchTerm) {
        countResult = await sql`
            SELECT COUNT(*) FROM personnel
            WHERE first_name ILIKE ${searchQuery} OR last_name ILIKE ${searchQuery} OR personnel_code ILIKE ${searchQuery} OR national_id ILIKE ${searchQuery};
        `;
        dataResult = await sql`
            SELECT 
                id, personnel_code, first_name, last_name, father_name, national_id, id_number,
                birth_date, birth_place, issue_date, issue_place, marital_status, military_status,
                job_title, "position", employment_type, department, service_location, hire_date,
                education_level, field_of_study, status 
            FROM personnel
            WHERE first_name ILIKE ${searchQuery} OR last_name ILIKE ${searchQuery} OR personnel_code ILIKE ${searchQuery} OR national_id ILIKE ${searchQuery}
            ORDER BY last_name, first_name
            LIMIT ${pageSize} OFFSET ${offset};
        `;
    } else {
        countResult = await sql`SELECT COUNT(*) FROM personnel;`;
        dataResult = await sql`
            SELECT 
                id, personnel_code, first_name, last_name, father_name, national_id, id_number,
                birth_date, birth_place, issue_date, issue_place, marital_status, military_status,
                job_title, "position", employment_type, department, service_location, hire_date,
                education_level, field_of_study, status 
            FROM personnel
            ORDER BY last_name, first_name
            LIMIT ${pageSize} OFFSET ${offset};
        `;
    }

    const totalCount = parseInt(countResult.rows[0].count, 10);
    const { rows } = dataResult;

    return response.status(200).json({ personnel: rows, totalCount });
  } catch (error) {
    console.error('Database query failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (errorMessage.includes('relation "personnel" does not exist')) {
        return response.status(500).json({ 
            error: 'جدول پرسنل در پایگاه داده یافت نشد.', 
            details: 'به نظر می‌رسد جدول مورد نیاز ایجاد نشده است. لطفاً با مراجعه به آدرس /api/create-users-table از ایجاد جدول اطمینان حاصل کنید.' 
        });
    }

    return response.status(500).json({ error: 'Failed to fetch data from the database.', details: errorMessage });
  }
}