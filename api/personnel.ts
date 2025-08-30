import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel } from '../types';

type NewPersonnel = Omit<Personnel, 'id'>;

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  try {
    const page = parseInt(request.query.page as string) || 1;
    const pageSize = parseInt(request.query.pageSize as string) || 20;
    const searchTerm = (request.query.searchTerm as string) || '';
    const offset = (page - 1) * pageSize;
    const searchQuery = `%${searchTerm}%`;
    
    let countResult;
    let dataResult;

    if (searchTerm) {
        countResult = await pool.sql`
            SELECT COUNT(*) FROM personnel
            WHERE first_name ILIKE ${searchQuery} OR last_name ILIKE ${searchQuery} OR personnel_code ILIKE ${searchQuery} OR national_id ILIKE ${searchQuery};
        `;
        dataResult = await pool.sql`
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
        countResult = await pool.sql`SELECT COUNT(*) FROM personnel;`;
        dataResult = await pool.sql`
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
    console.error('Database GET failed:', error);
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

// --- POST Handler (Single Add) ---
async function handleSinglePost(p: NewPersonnel, response: VercelResponse, pool: VercelPool) {
  if (!p || !p.personnel_code || !p.first_name || !p.last_name) {
    return response.status(400).json({ error: 'کد پرسنلی، نام و نام خانوادگی الزامی هستند.' });
  }
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
    console.error('Database POST failed:', error);
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

// --- POST Handler (Bulk Import) ---
async function handleBulkPost(allPersonnel: NewPersonnel[], response: VercelResponse, client: VercelPoolClient) {
  const BATCH_SIZE = 500;
  const validPersonnelList = allPersonnel.filter(p => p.personnel_code && p.first_name && p.last_name);

  if (validPersonnelList.length === 0) {
    return response.status(200).json({ message: 'هیچ رکورد معتبری برای ورود یافت نشد. لطفاً از وجود ستون‌های کد پرسنلی، نام و نام خانوادگی اطمینان حاصل کنید.' });
  }
  
  try {
    const columns = [
      'personnel_code', 'first_name', 'last_name', 'father_name', 'national_id', 'id_number',
      'birth_date', 'birth_place', 'issue_date', 'issue_place', 'marital_status', 'military_status',
      'job_title', 'position', 'employment_type', 'department', 'service_location', 'hire_date',
      'education_level', 'field_of_study', 'status'
    ];
    
    const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
    
    const updateSet = columns
      .filter(c => c !== 'personnel_code')
      .map(c => `${c === 'position' ? `"${c}"` : c} = EXCLUDED.${c === 'position' ? `"${c}"` : c}`)
      .join(', ');

    let totalProcessed = 0;
    for (let i = 0; i < validPersonnelList.length; i += BATCH_SIZE) {
        const batch = validPersonnelList.slice(i, i + BATCH_SIZE);
        if (batch.length === 0) continue;

        await (client as any).query('BEGIN');

        const values: (string | null)[] = [];
        const valuePlaceholders: string[] = [];
        let paramIndex = 1;

        for (const p of batch) {
          const recordPlaceholders: string[] = [];
          for (const col of columns) {
            values.push(p[col as keyof NewPersonnel] ?? null);
            recordPlaceholders.push(`$${paramIndex++}`);
          }
          valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
        }

        const query = `
          INSERT INTO personnel (${columnNames})
          VALUES ${valuePlaceholders.join(', ')}
          ON CONFLICT (personnel_code) DO UPDATE SET ${updateSet};
        `;
        
        await (client as any).query(query, values);
        await (client as any).query('COMMIT');
        totalProcessed += batch.length;
    }

    return response.status(200).json({ message: `عملیات موفق. ${totalProcessed} رکورد پردازش شد.` });
  
  } catch (error) {
    await (client as any).query('ROLLBACK').catch((rollbackError: any) => {
        console.error('Failed to rollback transaction:', rollbackError);
    });

    console.error('Database bulk insert/update failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

// --- PUT Handler (Update) ---
async function handlePut(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const p = request.body as Personnel;
  if (!p || !p.id) {
    return response.status(400).json({ error: 'اطلاعات پرسنل یا شناسه نامعتبر است.' });
  }
  try {
    const { rows } = await pool.sql`
      UPDATE personnel SET
        personnel_code = ${p.personnel_code}, first_name = ${p.first_name}, last_name = ${p.last_name},
        father_name = ${p.father_name}, national_id = ${p.national_id}, id_number = ${p.id_number},
        birth_date = ${p.birth_date}, birth_place = ${p.birth_place}, issue_date = ${p.issue_date},
        issue_place = ${p.issue_place}, marital_status = ${p.marital_status}, military_status = ${p.military_status},
        job_title = ${p.job_title}, "position" = ${p.position}, employment_type = ${p.employment_type},
        department = ${p.department}, service_location = ${p.service_location}, hire_date = ${p.hire_date},
        education_level = ${p.education_level}, field_of_study = ${p.field_of_study}, status = ${p.status}
      WHERE id = ${p.id}
      RETURNING *;
    `;
    if (rows.length === 0) {
        return response.status(404).json({ error: 'پرسنلی با این شناسه یافت نشد.'});
    }
    return response.status(200).json({ message: 'اطلاعات پرسنل با موفقیت به‌روزرسانی شد.', personnel: rows[0] });
  } catch (error) {
    console.error('Database PUT failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    if (errorMessage.includes('duplicate key value violates unique constraint "personnel_personnel_code_key"')) {
        return response.status(409).json({ error: 'کد پرسنلی وارد شده تکراری است.', details: 'یک پرسنل دیگر با این کد پرسنلی وجود دارد.' });
    }
    if (errorMessage.includes('duplicate key value violates unique constraint "personnel_national_id_key"')) {
        return response.status(409).json({ error: 'کد ملی وارد شده تکراری است.', details: 'یک پرسنل دیگر با این کد ملی وجود دارد.' });
    }
    return response.status(500).json({ error: 'خطا در به‌روزرسانی اطلاعات در پایگاه داده.', details: errorMessage });
  }
}

// --- Main Handler ---
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
        details: 'لطفاً تنظیمات پروژه خود را در Vercel بررسی کنید و از اتصال صحیح پایگاه داده اطمینان حاصل کنید.'
    });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });

  switch (request.method) {
    case 'GET':
      return await handleGet(request, response, pool);
    case 'POST': {
      const body = request.body;
      if (Array.isArray(body)) {
        const client = await pool.connect();
        try {
            return await handleBulkPost(body, response, client);
        } finally {
            client.release();
        }
      } else {
        return await handleSinglePost(body, response, pool);
      }
    }
    case 'PUT':
      return await handlePut(request, response, pool);
    default:
      response.setHeader('Allow', ['GET', 'POST', 'PUT']);
      return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }
}