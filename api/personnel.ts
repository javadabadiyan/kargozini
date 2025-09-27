import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel, Dependent, CommutingMember, DisciplinaryRecord } from '../types';

// --- Type Aliases for Payloads ---
type NewPersonnel = Omit<Personnel, 'id'>;
type NewDependent = Omit<Dependent, 'id'>;
type NewCommutingMember = Omit<CommutingMember, 'id'>;

// FIX: Define TABLE_COLUMNS to resolve reference error in handlePostJobGroupInfo
const TABLE_COLUMNS: { [key: string]: string[] } = {
  personnel: [
    'personnel_code', 'first_name', 'last_name', 'father_name', 'national_id', 'id_number',
    'birth_year', 'birth_date', 'birth_place', 'issue_date', 'issue_place', 'marital_status', 'military_status',
    'job_title', 'position', 'employment_type', 'department', 'service_location', 'hire_date',
    'education_level', 'field_of_study', 'job_group', 'sum_of_decree_factors', 'status',
    'hire_month', 'total_insurance_history', 'mining_history', 'non_mining_history',
    'group_distance_from_1404', 'next_group_distance'
  ]
};

// =================================================================================
// PERSONNEL HANDLERS
// =================================================================================
async function handleGetPersonnel(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
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
            SELECT * FROM personnel
            WHERE first_name ILIKE ${searchQuery} OR last_name ILIKE ${searchQuery} OR personnel_code ILIKE ${searchQuery} OR national_id ILIKE ${searchQuery}
            ORDER BY last_name, first_name
            LIMIT ${pageSize} OFFSET ${offset};
        `;
    } else {
        countResult = await pool.sql`SELECT COUNT(*) FROM personnel;`;
        dataResult = await pool.sql`
            SELECT * FROM personnel
            ORDER BY last_name, first_name
            LIMIT ${pageSize} OFFSET ${offset};
        `;
    }
    const totalCount = parseInt(countResult.rows[0].count, 10);
    return response.status(200).json({ personnel: dataResult.rows, totalCount });
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during fetch';
      console.error("Error in handleGetPersonnel:", errorMessage);
      if (errorMessage.includes('does not exist')) {
          return response.status(500).json({ error: 'جدول "personnel" در پایگاه داده یافت نشد.', details: 'لطفاً مطمئن شوید که جداول پایگاه داده به درستی ایجاد شده‌اند.'});
      }
      return response.status(500).json({ error: 'خطا در دریافت لیست پرسنل از پایگاه داده.', details: errorMessage });
  }
}

async function handlePostPersonnel(body: any, response: VercelResponse, pool: VercelPool) {
    const client = await pool.connect();
    try {
        if (Array.isArray(body)) { // Bulk insert
            const allPersonnel: NewPersonnel[] = body;
            
            // Data sanitization on the backend as a safety measure
            for (const p of allPersonnel) {
                for (const key in p) {
                    const typedKey = key as keyof NewPersonnel;
                    if (typeof p[typedKey] === 'string') {
                        (p as any)[typedKey] = (p[typedKey] as string)
                            .replace(/[\u0000-\u001F\u200B-\u200D\u200E\u200F\uFEFF]/g, '')
                            .trim();
                    }
                }
            }
            
            const BATCH_SIZE = 500;
            const validPersonnelList = allPersonnel.filter(p => p.personnel_code && p.first_name && p.last_name);
            if (validPersonnelList.length === 0) return response.status(200).json({ message: 'هیچ رکورد معتبری برای ورود یافت نشد.' });
            
            const columns = ['personnel_code', 'first_name', 'last_name', 'father_name', 'national_id', 'id_number', 'birth_year', 'birth_date', 'birth_place', 'issue_date', 'issue_place', 'marital_status', 'military_status', 'job_title', 'position', 'employment_type', 'department', 'service_location', 'hire_date', 'education_level', 'field_of_study', 'job_group', 'sum_of_decree_factors', 'status'];
            const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
            const updateSet = columns.filter(c => c !== 'personnel_code').map(c => `${c === 'position' ? `"${c}"` : c} = EXCLUDED.${c === 'position' ? `"${c}"` : c}`).join(', ');
            
            let totalProcessed = 0;
            for (let i = 0; i < validPersonnelList.length; i += BATCH_SIZE) {
                const batch = validPersonnelList.slice(i, i + BATCH_SIZE);
                if (batch.length === 0) continue;
                await client.sql`BEGIN`;
                const values: (string | null)[] = [];
                const valuePlaceholders: string[] = [];
                let paramIndex = 1;
                for (const p of batch) {
                    const recordPlaceholders: string[] = [];
                    for (const col of columns) { values.push(p[col as keyof NewPersonnel] ?? null); recordPlaceholders.push(`$${paramIndex++}`); }
                    valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
                }
                const query = `INSERT INTO personnel (${columnNames}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT (personnel_code) DO UPDATE SET ${updateSet};`;
                await (client as any).query(query, values);
                await client.sql`COMMIT`;
                totalProcessed += batch.length;
            }
            return response.status(200).json({ message: `عملیات موفق. ${totalProcessed} رکورد پردازش شد.` });
        } else { // Single insert
            const p: NewPersonnel = body;
            if (!p || !p.personnel_code || !p.first_name || !p.last_name) return response.status(400).json({ error: 'کد پرسنلی، نام و نام خانوادگی الزامی هستند.' });
            const { rows } = await pool.sql`
              INSERT INTO personnel (personnel_code, first_name, last_name, father_name, national_id, id_number, birth_year, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job_title, "position", employment_type, department, service_location, hire_date, education_level, field_of_study, job_group, sum_of_decree_factors, status)
              VALUES (${p.personnel_code}, ${p.first_name}, ${p.last_name}, ${p.father_name}, ${p.national_id}, ${p.id_number}, ${p.birth_year}, ${p.birth_date}, ${p.birth_place}, ${p.issue_date}, ${p.issue_place}, ${p.marital_status}, ${p.military_status}, ${p.job_title}, ${p.position}, ${p.employment_type}, ${p.department}, ${p.service_location}, ${p.hire_date}, ${p.education_level}, ${p.field_of_study}, ${p.job_group}, ${p.sum_of_decree_factors}, ${p.status})
              RETURNING *;`;
            return response.status(201).json({ message: 'پرسنل جدید با موفقیت اضافه شد.', personnel: rows[0] });
        }
    } catch (error) {
        await client.sql`ROLLBACK;`.catch(() => {});
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error("Error in handlePostPersonnel:", error);

        if (errorMessage.includes('personnel_national_id_key')) {
            return response.status(409).json({ 
                error: 'خطا: کد ملی تکراری است.',
                details: 'یک یا چند کد ملی در فایل اکسل شما از قبل در سیستم وجود دارد.'
            });
        }
        
        if (errorMessage.includes('personnel_personnel_code_key')) {
             return response.status(409).json({ 
                error: 'خطا: کد پرسنلی تکراری است.',
                details: 'سیستم هنگام به‌روزرسانی رکورد موجود با خطا مواجه شد.'
            });
        }

        return response.status(500).json({ 
            error: 'خطا در عملیات پایگاه داده. لطفاً فرمت فایل اکسل و مقادیر داخل آن را بررسی کنید.',
            details: `جزئیات فنی: ${errorMessage}` 
        });
    } finally {
        client.release();
    }
}

async function handlePutPersonnel(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const p = request.body as Personnel;
  if (!p || !p.id) return response.status(400).json({ error: 'شناسه پرسنل نامعتبر است.' });
  const { rows } = await pool.sql`
    UPDATE personnel SET 
      personnel_code = ${p.personnel_code}, first_name = ${p.first_name}, last_name = ${p.last_name}, father_name = ${p.father_name}, 
      national_id = ${p.national_id}, id_number = ${p.id_number}, birth_year = ${p.birth_year}, birth_date = ${p.birth_date}, birth_place = ${p.birth_place}, 
      issue_date = ${p.issue_date}, issue_place = ${p.issue_place}, marital_status = ${p.marital_status}, 
      military_status = ${p.military_status}, job_title = ${p.job_title}, "position" = ${p.position}, 
      employment_type = ${p.employment_type}, department = ${p.department}, service_location = ${p.service_location}, 
      hire_date = ${p.hire_date}, education_level = ${p.education_level}, field_of_study = ${p.field_of_study}, 
      job_group = ${p.job_group}, sum_of_decree_factors = ${p.sum_of_decree_factors}, status = ${p.status}
    WHERE id = ${p.id} RETURNING *;`;
  if (rows.length === 0) return response.status(404).json({ error: 'پرسنلی با این شناسه یافت نشد.'});
  return response.status(200).json({ message: 'اطلاعات پرسنل به‌روزرسانی شد.', personnel: rows[0] });
}

async function handleDeletePersonnel(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id, deleteAll } = request.query;

  if (deleteAll === 'true') {
    try {
      await pool.sql`TRUNCATE TABLE personnel RESTART IDENTITY CASCADE;`;
      return response.status(200).json({ message: 'تمام اطلاعات پرسنل با موفقیت حذف شد.' });
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       return response.status(500).json({ error: 'خطا در حذف کلی اطلاعات پرسنل.', details: errorMessage });
    }
  }

  if (id && typeof id === 'string') {
    const personId = parseInt(id, 10);
    if (isNaN(personId)) {
      return response.status(400).json({ error: 'شناسه پرسنل نامعتبر است.' });
    }
    try {
      const result = await pool.sql`DELETE FROM personnel WHERE id = ${personId};`;
      if (result.rowCount === 0) {
        return response.status(404).json({ error: 'پرسنلی با این شناسه یافت نشد.' });
      }
      return response.status(200).json({ message: 'پرسنل با موفقیت حذف شد.' });
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       return response.status(500).json({ error: 'خطا در حذف پرسنل.', details: errorMessage });
    }
  }

  return response.status(400).json({ error: 'برای حذف، شناسه پرسنل یا پارامتر حذف کلی الزامی است.' });
}

// =================================================================================
// JOB GROUP INFO HANDLERS (using personnel table)
// =================================================================================

const JOB_GROUP_COLUMNS = [
  'id', 'personnel_code', 'first_name', 'last_name', 'national_id', 'education_level',
  'hire_date', 'hire_month', 'total_insurance_history', 'mining_history', 'non_mining_history',
  'job_group', 'group_distance_from_1404', 'next_group_distance', 'job_title', 'position'
];
const JOB_GROUP_UPDATE_COLUMNS = JOB_GROUP_COLUMNS.filter(c => !['id', 'personnel_code']);

async function handleGetJobGroupInfo(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const page = parseInt(request.query.page as string) || 1;
  const pageSize = parseInt(request.query.pageSize as string) || 20;
  const searchTerm = (request.query.searchTerm as string) || '';
  const offset = (page - 1) * pageSize;
  const searchQuery = `%${searchTerm}%`;

  const columnNames = JOB_GROUP_COLUMNS.map(c => c === 'position' ? `"${c}"` : c).join(', ');

  let countResult;
  let dataResult;

  if (searchTerm) {
    countResult = await pool.sql`
      SELECT COUNT(*) FROM personnel
      WHERE first_name ILIKE ${searchQuery} OR last_name ILIKE ${searchQuery} OR personnel_code ILIKE ${searchQuery} OR national_id ILIKE ${searchQuery};
    `;
    dataResult = await (pool as any).query(`
      SELECT ${columnNames} FROM personnel
      WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR personnel_code ILIKE $1 OR national_id ILIKE $1
      ORDER BY last_name, first_name
      LIMIT $2 OFFSET $3;
    `, [searchQuery, pageSize, offset]);
  } else {
    countResult = await pool.sql`SELECT COUNT(*) FROM personnel;`;
    dataResult = await (pool as any).query(`
      SELECT ${columnNames} FROM personnel
      ORDER BY last_name, first_name
      LIMIT $1 OFFSET $2;
    `, [pageSize, offset]);
  }
  
  const totalCount = parseInt(countResult.rows[0].count, 10);
  return response.status(200).json({ records: dataResult.rows, totalCount });
}

async function handlePostJobGroupInfo(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const bodyData = request.body;
  
  try {
      if (Array.isArray(bodyData)) { // Bulk insert from Excel
          const allRecords: Personnel[] = bodyData;
          const validRecords = allRecords.filter(r => r.personnel_code && r.first_name && r.last_name);
          if (validRecords.length === 0) {
              return response.status(400).json({ error: 'هیچ رکورد معتبری یافت نشد.' });
          }
          await client.sql`BEGIN`;
          const allColumns = [...new Set([...Object.keys(validRecords[0]), ...JOB_GROUP_COLUMNS])].filter(c => c !== 'id');
          const columnNames = allColumns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
          const updateSet = allColumns.filter(c => c !== 'personnel_code').map(c => `${c === 'position' ? `"${c}"` : c} = EXCLUDED.${c === 'position' ? `"${c}"` : c}`).join(', ');

          const values: (string | null)[] = [];
          const valuePlaceholders: string[] = [];
          let paramIndex = 1;

          for (const record of validRecords) {
              const recordPlaceholders: string[] = [];
              for (const col of allColumns) {
                values.push((record as any)[col] ?? null);
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
          await client.sql`COMMIT`;
          return response.status(200).json({ message: `${validRecords.length} رکورد با موفقیت پردازش شد.` });
      } else { // Single insert/update
          const record = bodyData as Partial<Personnel>;
          if (!record.personnel_code) return response.status(400).json({ error: 'کد پرسنلی الزامی است.' });
          
          const columns = Object.keys(record).filter(k => k !== 'id' && TABLE_COLUMNS.personnel.includes(k));
          if (columns.length === 0) return response.status(400).json({ error: 'هیچ فیلد معتبری برای ذخیره وجود ندارد.' });
          
          const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
          const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const values = columns.map(c => (record as any)[c]);
          const updateSet = columns.filter(c => c !== 'personnel_code').map((c, i) => `${c === 'position' ? `"${c}"` : c} = $${i + 2}`).join(', ');

          await client.sql`BEGIN`;
          const updateQuery = `
              UPDATE personnel SET ${updateSet}
              WHERE personnel_code = $1 RETURNING *;
          `;
          const updateResult = await (client as any).query(updateQuery, [record.personnel_code, ...values.filter((_, i) => columns[i] !== 'personnel_code')]);

          if (updateResult.rows.length === 0) { // If not updated, it means it doesn't exist, so insert.
              const insertQuery = `
                  INSERT INTO personnel (${columnNames})
                  VALUES (${valuePlaceholders}) RETURNING *;
              `;
              const insertResult = await (client as any).query(insertQuery, values);
              await client.sql`COMMIT`;
              return response.status(201).json({ message: 'رکورد جدید با موفقیت اضافه شد.', record: insertResult.rows[0] });
          } else {
              await client.sql`COMMIT`;
              return response.status(200).json({ message: 'اطلاعات با موفقیت به‌روزرسانی شد.', record: updateResult.rows[0] });
          }
      }
  } catch (error) {
      await client.sql`ROLLBACK;`.catch(() => {});
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in handlePostJobGroupInfo:', error);
      return response.status(500).json({ error: 'خطا در عملیات پایگاه داده', details: errorMessage });
  }
}

async function handlePutJobGroupInfo(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const record = request.body as Partial<Personnel>;
    if (!record.id) return response.status(400).json({ error: 'شناسه رکورد الزامی است.' });

    const updateFields = JOB_GROUP_UPDATE_COLUMNS.filter(col => record.hasOwnProperty(col));
    if (updateFields.length === 0) return response.status(400).json({ error: 'هیچ فیلدی برای بروزرسانی مشخص نشده است.' });
    
    const setClauses = updateFields.map((field, index) => `${field === 'position' ? '"position"' : field} = $${index + 1}`);
    const updateValues = updateFields.map(field => record[field as keyof Personnel]);

    const query = `UPDATE personnel SET ${setClauses.join(', ')} WHERE id = $${updateFields.length + 1} RETURNING *;`;
    updateValues.push(record.id);

    try {
        const { rows } = await (client as any).query(query, updateValues as any[]);
        if (rows.length === 0) return response.status(404).json({ error: 'رکورد مورد نظر یافت نشد.' });
        return response.status(200).json({ message: 'اطلاعات با موفقیت بروزرسانی شد.', record: rows[0] });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in handlePutJobGroupInfo:', error);
        return response.status(500).json({ error: 'خطا در بروزرسانی اطلاعات', details: errorMessage });
    }
}

async function handleDeleteJobGroupInfo(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'شناسه رکورد الزامی است.' });

    try {
        const { rowCount } = await client.sql`DELETE FROM personnel WHERE id = ${id}`;
        if (rowCount === 0) return response.status(404).json({ error: 'رکورد مورد نظر یافت نشد.' });
        return response.status(200).json({ message: 'رکورد با موفقیت حذف شد.' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in handleDeleteJobGroupInfo:', error);
        return response.status(500).json({ error: 'خطا در حذف رکورد', details: errorMessage });
    }
}


// =================================================================================
// DEPENDENTS HANDLERS
// =================================================================================
// (Handlers for dependents would go here, following a similar pattern)
// ...

// =================================================================================
// COMMUTING MEMBERS HANDLERS
// =================================================================================
// (Handlers for commuting members would go here, following a similar pattern)
// ...

// =================================================================================
// MAIN HANDLER
// =================================================================================
export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (!process.env.POSTGRES_URL) {
        return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
    }
    const pool = createPool({ connectionString: process.env.POSTGRES_URL });
    const client = await pool.connect();
    
    try {
        const { type } = request.query;

        if (type === 'personnel') {
            switch (request.method) {
                case 'GET': return await handleGetPersonnel(request, response, pool);
                case 'POST': return await handlePostPersonnel(request.body, response, pool);
                case 'PUT': return await handlePutPersonnel(request, response, pool);
                case 'DELETE': return await handleDeletePersonnel(request, response, pool);
            }
        }
        
        if (type === 'job_group_info') {
             switch (request.method) {
                case 'GET': return await handleGetJobGroupInfo(request, response, pool);
                case 'POST': return await handlePostJobGroupInfo(request, response, client);
                case 'PUT': return await handlePutJobGroupInfo(request, response, client);
                case 'DELETE': return await handleDeleteJobGroupInfo(request, response, client);
            }
        }
        
        // Add other type handlers here...
        // e.g., if (type === 'dependents') { ... }

        response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return response.status(405).json({ error: `Method ${request.method} Not Allowed for type ${type}` });

    } catch (error) {
        console.error('API Error in /api/personnel:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
        return response.status(500).json({ error: 'خطای داخلی سرور.', details: errorMessage });
    } finally {
        client.release();
    }
}