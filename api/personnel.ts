import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel, Dependent, CommutingMember } from '../types';

// --- Type Aliases for Payloads ---
type NewPersonnel = Omit<Personnel, 'id'>;
type NewDependent = Omit<Dependent, 'id'>;
type NewCommutingMember = Omit<CommutingMember, 'id'>;

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
        await client.sql`ROLLBACK`.catch(() => {});
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
// DEPENDENTS HANDLERS
// =================================================================================
async function handleGetDependents(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { personnel_code } = request.query;
  let result;
  if (personnel_code && typeof personnel_code === 'string') {
    result = await pool.sql`SELECT * FROM dependents WHERE personnel_code = ${personnel_code} ORDER BY last_name, first_name;`;
  } else {
    result = await pool.sql`SELECT * FROM dependents ORDER BY personnel_code, last_name, first_name;`;
  }
  return response.status(200).json({ dependents: result.rows });
}

async function handlePostDependents(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const allDependents = request.body as NewDependent[];
  if (!Array.isArray(allDependents)) return response.status(400).json({ error: 'فرمت داده‌های ارسالی نامعتبر است.' });
  
  // The 'personnel_code' field from the frontend now holds the head of household's NATIONAL ID.
  const validList = allDependents.filter(d => d.personnel_code && d.first_name && d.last_name && d.national_id);
  if (validList.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد.' });

  // Pre-flight check: Validate head of household national IDs and map them to personnel codes.
  const headNationalIdsInFile = [...new Set(validList.map(d => d.personnel_code))];
  
  if (headNationalIdsInFile.length > 0) {
      // FIX: The `sql` template literal from @vercel/postgres does not accept arrays as parameters, causing a type error.
      // Switched to `client.query` which correctly handles array parameters for `ANY` clauses.
      const { rows: existingHeads } = await client.query(
          `SELECT national_id, personnel_code FROM personnel WHERE national_id = ANY($1::text[])`,
          [headNationalIdsInFile]
      );
      
      const nationalIdToPersonnelCodeMap = new Map<string, string>();
      for (const p of existingHeads) {
          nationalIdToPersonnelCodeMap.set(p.national_id, p.personnel_code);
      }

      const missingNationalIds = headNationalIdsInFile.filter(id => !nationalIdToPersonnelCodeMap.has(id));

      if (missingNationalIds.length > 0) {
          return response.status(400).json({
              error: `کد ملی سرپرست برای برخی از رکوردها در سیستم یافت نشد.`,
              details: `لطفاً فایل اکسل خود را بررسی کنید. سرپرستی با کدهای ملی زیر در سیستم وجود ندارد: ${missingNationalIds.join(', ')}`
          });
      }
      
      // Replace the head national ID with the correct personnel_code for insertion.
      for(const dependent of validList) {
          const correctPersonnelCode = nationalIdToPersonnelCodeMap.get(dependent.personnel_code);
          if (correctPersonnelCode) {
              dependent.personnel_code = correctPersonnelCode;
          } else {
              // This case should be caught by the check above, but as a safeguard:
              return response.status(500).json({ error: 'خطای داخلی سرور هنگام مپ کردن کد ملی به کد پرسنلی.' });
          }
      }
  }
  
  try {
    await client.sql`BEGIN`;
    const BATCH_SIZE = 250; // Reduced batch size for safety
    let totalProcessed = 0;

    const columns = ['personnel_code', 'first_name', 'last_name', 'father_name', 'relation_type', 'birth_date', 'gender', 'birth_month', 'birth_day', 'id_number', 'national_id', 'issue_place', 'insurance_type'];
    const quotedColumns = columns.map(c => `"${c}"`);
    const updateSet = columns
      .filter(c => !['personnel_code', 'national_id'].includes(c))
      .map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

    for (let i = 0; i < validList.length; i += BATCH_SIZE) {
        const batch = validList.slice(i, i + BATCH_SIZE);
        if (batch.length === 0) continue;
        
        const values: (string | null)[] = [];
        const valuePlaceholders: string[] = [];
        let paramIndex = 1;
        for (const d of batch) {
          const recordPlaceholders: string[] = [];
          for (const col of columns) { 
            values.push(d[col as keyof NewDependent] ?? null); 
            recordPlaceholders.push(`$${paramIndex++}`); 
          }
          valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
        }

        if (values.length > 0) {
            const query = `INSERT INTO dependents (${quotedColumns.join(', ')}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT ("personnel_code", "national_id") DO UPDATE SET ${updateSet};`;
            await (client as any).query(query, values);
        }
        
        totalProcessed += batch.length;
    }

    await client.sql`COMMIT`;
    return response.status(200).json({ message: `عملیات موفق. ${totalProcessed} رکورد پردازش شد.` });
  } catch (error) {
    await client.sql`ROLLBACK`.catch(() => {});
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Error in handlePostDependents:", error);
    return response.status(500).json({ 
        error: 'خطا در عملیات پایگاه داده.', 
        details: `این خطا ممکن است به دلیل فرمت نادرست فایل اکسل یا داده‌های نامعتبر باشد. جزئیات فنی: ${errorMessage}` 
    });
  }
}

// =================================================================================
// COMMUTING MEMBERS HANDLERS
// =================================================================================
async function handleGetCommutingMembers(response: VercelResponse, pool: VercelPool) {
    const result = await pool.sql`SELECT * FROM commuting_members ORDER BY full_name;`;
    return response.status(200).json({ members: result.rows });
}

async function handlePostCommutingMembers(body: any, response: VercelResponse, client: VercelPoolClient) {
    if (Array.isArray(body)) { // Bulk
        const allMembers: NewCommutingMember[] = body;
        const validList = allMembers.filter(m => m.personnel_code && m.full_name);
        if (validList.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری یافت نشد.' });
        
        try {
            await client.sql`BEGIN`;
            const columns = ['personnel_code', 'full_name', 'department', 'position'];
            const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
            const updateSet = columns.filter(c => c !== 'personnel_code').map(c => `${c === 'position' ? `"${c}"` : c} = EXCLUDED.${c === 'position' ? `"${c}"` : c}`).join(', ');
            const values: (string | null)[] = [];
            const valuePlaceholders: string[] = [];
            let paramIndex = 1;
            for (const member of validList) {
                const recordPlaceholders: string[] = [];
                for (const col of columns) { values.push(member[col as keyof NewCommutingMember] ?? null); recordPlaceholders.push(`$${paramIndex++}`); }
                valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
            }
            const query = `INSERT INTO commuting_members (${columnNames}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT (personnel_code) DO UPDATE SET ${updateSet};`;
            await (client as any).query(query, values);
            await client.sql`COMMIT`;
            return response.status(200).json({ message: `عملیات موفق. ${validList.length} رکورد پردازش شد.` });
        } catch (error) {
            await client.sql`ROLLBACK`.catch(() => {});
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            if (errorMessage.includes('duplicate key')) return response.status(409).json({ error: 'کد پرسنلی تکراری است.' });
            return response.status(500).json({ error: 'خطا در عملیات پایگاه داده.', details: errorMessage });
        }
    } else { // Single
        const m: NewCommutingMember = body;
        if (!m || !m.personnel_code || !m.full_name) return response.status(400).json({ error: 'کد پرسنلی و نام کامل الزامی است.' });
        const { rows } = await client.sql`
            INSERT INTO commuting_members (personnel_code, full_name, department, "position") 
            VALUES (${m.personnel_code}, ${m.full_name}, ${m.department}, ${m.position})
            ON CONFLICT (personnel_code) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                department = EXCLUDED.department,
                "position" = EXCLUDED."position"
            RETURNING *;`;
        return response.status(201).json({ message: 'عضو جدید اضافه یا به‌روزرسانی شد.', member: rows[0] });
    }
}

// =================================================================================
// DOCUMENT HANDLERS
// =================================================================================
async function handleGetDocuments(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { personnel_code } = request.query;
    if (!personnel_code || typeof personnel_code !== 'string') {
        return response.status(400).json({ error: 'کد پرسنلی الزامی است.' });
    }
    const { rows } = await pool.sql`
        SELECT id, personnel_code, title, file_name, file_type, uploaded_at 
        FROM personnel_documents WHERE personnel_code = ${personnel_code} 
        ORDER BY uploaded_at DESC;
    `;
    return response.status(200).json({ documents: rows });
}

async function handleGetDocumentData(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') {
        return response.status(400).json({ error: 'شناسه مدرک الزامی است.' });
    }
    const { rows } = await pool.sql`
        SELECT file_name, file_type, file_data FROM personnel_documents WHERE id = ${parseInt(id, 10)};
    `;
    if (rows.length === 0) {
        return response.status(404).json({ error: 'مدرک یافت نشد.' });
    }
    return response.status(200).json({ document: rows[0] });
}

async function handlePostDocument(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { personnel_code, title, file_name, file_type, file_data } = request.body;
    if (!personnel_code || !title || !file_name || !file_type || !file_data) {
        return response.status(400).json({ error: 'تمام فیلدها الزامی هستند.' });
    }
    const { rows } = await pool.sql`
        INSERT INTO personnel_documents (personnel_code, title, file_name, file_type, file_data)
        VALUES (${personnel_code}, ${title}, ${file_name}, ${file_type}, ${file_data})
        RETURNING id, personnel_code, title, file_name, file_type, uploaded_at;
    `;
    return response.status(201).json({ message: 'مدرک با موفقیت آپلود شد.', document: rows[0] });
}

async function handleDeleteDocument(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') {
        return response.status(400).json({ error: 'شناسه مدرک الزامی است.' });
    }
    const result = await pool.sql`DELETE FROM personnel_documents WHERE id = ${parseInt(id, 10)};`;
    if (result.rowCount === 0) {
        return response.status(404).json({ error: 'مدرک برای حذف یافت نشد.' });
    }
    return response.status(200).json({ message: 'مدرک با موفقیت حذف شد.' });
}


// =================================================================================
// MAIN HANDLER
// =================================================================================
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
  }
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });
  const type = request.query.type as string || 'personnel';

  try {
    switch (request.method) {
      case 'GET':
        if (type === 'personnel') return await handleGetPersonnel(request, response, pool);
        if (type === 'dependents') return await handleGetDependents(request, response, pool);
        if (type === 'commuting_members') return await handleGetCommutingMembers(response, pool);
        if (type === 'documents') return await handleGetDocuments(request, response, pool);
        if (type === 'document_data') return await handleGetDocumentData(request, response, pool);
        return response.status(400).json({ error: 'نوع داده نامعتبر است.' });

      case 'POST': {
        const client = await pool.connect();
        try {
          if (type === 'personnel') return await handlePostPersonnel(request.body, response, pool); // Uses its own client logic
          if (type === 'dependents') return await handlePostDependents(request, response, client);
          if (type === 'commuting_members') return await handlePostCommutingMembers(request.body, response, client);
          if (type === 'documents') return await handlePostDocument(request, response, pool);
          return response.status(400).json({ error: 'نوع داده نامعتبر است.' });
        } finally {
          client.release();
        }
      }

      case 'PUT':
        if (type === 'personnel') return await handlePutPersonnel(request, response, pool);
        // Other types don't have PUT handlers for now
        return response.status(400).json({ error: 'نوع داده نامعتبر است.' });
      
      case 'DELETE':
        if (type === 'personnel') return await handleDeletePersonnel(request, response, pool);
        if (type === 'documents') return await handleDeleteDocument(request, response, pool);
        return response.status(400).json({ error: 'نوع داده برای حذف نامعتبر است.' });

      default:
        response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    if (errorMessage.includes('does not exist')) {
        return response.status(500).json({ error: 'جدول مورد نظر در پایگاه داده یافت نشد.', details: 'لطفاً از طریق /api/create-users-table از ایجاد جداول اطمینان حاصل کنید.'});
    }
    if (errorMessage.includes('duplicate key')) return response.status(409).json({ error: 'مقدار تکراری.', details: 'یک رکورد دیگر با این شناسه یکتا (مانند کد پرسنلی یا کد ملی) وجود دارد.' });
    if (errorMessage.includes('foreign key constraint')) return response.status(400).json({ error: 'کد پرسنلی نامعتبر.', details: 'یک یا چند کد پرسنلی در فایل شما در لیست پرسنل اصلی وجود ندارد.' });
    return response.status(500).json({ error: 'خطای داخلی سرور.', details: errorMessage });
  }
}