import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel, Dependent, CommutingMember, DisciplinaryRecord, PerformanceReview, BonusData, BonusEditLog } from '../../types';

// --- Type Aliases for Payloads ---
type NewPersonnel = Omit<Personnel, 'id'>;
type NewDependent = Omit<Dependent, 'id'>;
type NewCommutingMember = Omit<CommutingMember, 'id'>;

// =================================================================================
// PERSONNEL HANDLERS
// =================================================================================
async function handleGetPersonnel(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  try {
    const page = parseInt(request.query.page as string) || 1;
    const pageSize = parseInt(request.query.pageSize as string) || 20;
    const searchTerm = (request.query.searchTerm as string) || '';
    const offset = (page - 1) * pageSize;
    const searchQuery = `%${searchTerm}%`;

    let countResult;
    let dataResult;

    if (searchTerm) {
        countResult = await (client as any).query(
            `SELECT COUNT(*) FROM personnel
             WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR personnel_code ILIKE $1 OR national_id ILIKE $1;`,
            [searchQuery]
        );
        const query = `
            SELECT * FROM personnel
            WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR personnel_code ILIKE $1 OR national_id ILIKE $1
            ORDER BY last_name, first_name
            LIMIT $2 OFFSET $3;
        `;
        dataResult = await (client as any).query(query, [searchQuery, String(pageSize), String(offset)]);
    } else {
        countResult = await (client as any).query('SELECT COUNT(*) FROM personnel;');
        const query = `
            SELECT * FROM personnel
            ORDER BY last_name, first_name
            LIMIT $1 OFFSET $2;
        `;
        dataResult = await (client as any).query(query, [String(pageSize), String(offset)]);
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

async function handlePostPersonnel(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const body = request.body;
    try {
        await client.query('BEGIN');
        if (Array.isArray(body)) { // Bulk insert
            const allPersonnel: NewPersonnel[] = body;
            
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
                
                totalProcessed += batch.length;
            }
            await client.query('COMMIT');
            return response.status(200).json({ message: `عملیات موفق. ${totalProcessed} رکورد پردازش شد.` });
        } else { // Single insert
            const p: NewPersonnel = body;
            if (!p || !p.personnel_code || !p.first_name || !p.last_name) return response.status(400).json({ error: 'کد پرسنلی، نام و نام خانوادگی الزامی هستند.' });
            const query = `
              INSERT INTO personnel (personnel_code, first_name, last_name, father_name, national_id, id_number, birth_year, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job_title, "position", employment_type, department, service_location, hire_date, education_level, field_of_study, job_group, sum_of_decree_factors, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
              RETURNING *;`;
            const values = [p.personnel_code, p.first_name, p.last_name, p.father_name, p.national_id, p.id_number, p.birth_year, p.birth_date, p.birth_place, p.issue_date, p.issue_place, p.marital_status, p.military_status, p.job_title, p.position, p.employment_type, p.department, p.service_location, p.hire_date, p.education_level, p.field_of_study, p.job_group, p.sum_of_decree_factors, p.status];
            const { rows } = await (client as any).query(query, values);
            await client.query('COMMIT');
            return response.status(201).json({ message: 'پرسنل جدید با موفقیت اضافه شد.', personnel: rows[0] });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error("Error in handlePostPersonnel:", error);
        if (errorMessage.includes('personnel_national_id_key')) return response.status(409).json({ error: 'خطا: کد ملی تکراری است.', details: 'یک یا چند کد ملی در فایل اکسل شما از قبل در سیستم وجود دارد.'});
        if (errorMessage.includes('personnel_personnel_code_key')) return response.status(409).json({ error: 'خطا: کد پرسنلی تکراری است.', details: 'سیستم هنگام به‌روزرسانی رکورد موجود با خطا مواجه شد.'});
        return response.status(500).json({ error: 'خطا در عملیات پایگاه داده. لطفاً فرمت فایل اکسل و مقادیر داخل آن را بررسی کنید.', details: `جزئیات فنی: ${errorMessage}` });
    }
}


async function handlePutPersonnel(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const p = request.body as Personnel;
    if (!p || !p.id) return response.status(400).json({ error: 'شناسه پرسنل نامعتبر است.' });
    const query = `
        UPDATE personnel SET 
            personnel_code = $1, first_name = $2, last_name = $3, father_name = $4, national_id = $5, id_number = $6,
            birth_year = $7, birth_date = $8, birth_place = $9, issue_date = $10, issue_place = $11, marital_status = $12,
            military_status = $13, job_title = $14, "position" = $15, employment_type = $16, department = $17,
            service_location = $18, hire_date = $19, education_level = $20, field_of_study = $21, job_group = $22,
            sum_of_decree_factors = $23, status = $24
        WHERE id = $25 RETURNING *;
    `;
    const values = [
        p.personnel_code, p.first_name, p.last_name, p.father_name, p.national_id, p.id_number, p.birth_year, p.birth_date,
        p.birth_place, p.issue_date, p.issue_place, p.marital_status, p.military_status, p.job_title, p.position,
        p.employment_type, p.department, p.service_location, p.hire_date, p.education_level, p.field_of_study,
        p.job_group, p.sum_of_decree_factors, p.status, String(p.id)
    ];
    const { rows } = await (client as any).query(query, values);
    if (rows.length === 0) return response.status(404).json({ error: 'پرسنلی با این شناسه یافت نشد.' });
    return response.status(200).json({ message: 'اطلاعات پرسنل به‌روزرسانی شد.', personnel: rows[0] });
}


async function handleDeletePersonnel(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const { id, deleteAll } = request.query;
  if (deleteAll === 'true') {
    await (client as any).query('TRUNCATE TABLE personnel RESTART IDENTITY CASCADE;');
    return response.status(200).json({ message: 'تمام اطلاعات پرسنل با موفقیت حذف شد.' });
  }
  if (id && typeof id === 'string') {
    const personId = parseInt(id, 10);
    if (isNaN(personId)) return response.status(400).json({ error: 'شناسه پرسنل نامعتبر است.' });
    const result = await (client as any).query('DELETE FROM personnel WHERE id = $1;', [String(personId)]);
    if (result.rowCount === 0) return response.status(404).json({ error: 'پرسنلی با این شناسه یافت نشد.' });
    return response.status(200).json({ message: 'پرسنل با موفقیت حذف شد.' });
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

async function handleGetJobGroupInfo(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const page = parseInt(request.query.page as string) || 1;
  const pageSize = parseInt(request.query.pageSize as string) || 20;
  const searchTerm = (request.query.searchTerm as string) || '';
  const offset = (page - 1) * pageSize;
  const searchQuery = `%${searchTerm}%`;

  const columnNames = JOB_GROUP_COLUMNS.map(c => c === 'position' ? `"${c}"` : c).join(', ');

  let countResult;
  let dataResult;

  if (searchTerm) {
    countResult = await (client as any).query(`
      SELECT COUNT(*) FROM personnel
      WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR personnel_code ILIKE $1 OR national_id ILIKE $1;
    `, [searchQuery]);
    dataResult = await (client as any).query(`
      SELECT ${columnNames} FROM personnel
      WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR personnel_code ILIKE $1 OR national_id ILIKE $1
      ORDER BY last_name, first_name
      LIMIT $2 OFFSET $3;
    `, [searchQuery, String(pageSize), String(offset)]);
  } else {
    countResult = await (client as any).query('SELECT COUNT(*) FROM personnel;');
    dataResult = await (client as any).query(`
      SELECT ${columnNames} FROM personnel
      ORDER BY last_name, first_name
      LIMIT $1 OFFSET $2;
    `, [String(pageSize), String(offset)]);
  }
  
  const totalCount = parseInt(countResult.rows[0].count, 10);
  return response.status(200).json({ records: dataResult.rows, totalCount });
}

async function handlePostJobGroupInfo(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const bodyData = request.body;
  
  try {
      await client.query('BEGIN');
      if (Array.isArray(bodyData)) {
          const allRecords: Personnel[] = bodyData;
          const validRecords = allRecords.filter(r => r.personnel_code && r.first_name && r.last_name);
          if (validRecords.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری یافت نشد.' });
          
          const allColumns = [...new Set([...Object.keys(validRecords[0]), ...JOB_GROUP_COLUMNS])].filter(c => c !== 'id');
          const columnNames = allColumns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
          const updateSet = allColumns.filter(c => c !== 'personnel_code').map(c => `${c === 'position' ? `"${c}"` : c} = EXCLUDED.${c === 'position' ? `"${c}"` : c}`).join(', ');

          const values: (string | null)[] = [];
          const valuePlaceholders: string[] = [];
          let paramIndex = 1;

          for (const record of validRecords) {
              const recordPlaceholders: string[] = [];
              for (const col of allColumns) {
                  // FIX: Ensure all values are strings or null to match the type of `values`.
                  const val = record[col as keyof Personnel];
                  values.push(val === null || val === undefined ? null : String(val));
                  recordPlaceholders.push(`$${paramIndex++}`);
              }
              valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
          }
          const query = `INSERT INTO personnel (${columnNames}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT (personnel_code) DO UPDATE SET ${updateSet};`;
          await (client as any).query(query, values);
          
          return response.status(200).json({ message: `عملیات موفق. ${validRecords.length} رکورد پردازش شد.` });

      } else {
          const p: Personnel = bodyData;
          if (!p.personnel_code || !p.first_name || !p.last_name) return response.status(400).json({ error: 'کد پرسنلی، نام و نام خانوادگی الزامی است.' });
          
          const columns = JOB_GROUP_COLUMNS.filter(c => c !== 'id');
          const values = columns.map(col => p[col as keyof Personnel] ?? null);
          const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
          
          const { rows } = await (client as any).query(`INSERT INTO personnel (${columnNames}) VALUES (${valuePlaceholders}) RETURNING *;`, values);
          return response.status(201).json({ message: 'رکورد با موفقیت اضافه شد.', record: rows[0] });
      }
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (errorMessage.includes('personnel_personnel_code_key')) return response.status(409).json({ error: 'کد پرسنلی تکراری است.' });
      return response.status(500).json({ error: 'خطا در عملیات پایگاه داده.', details: errorMessage });
  } finally {
      await client.query('COMMIT');
  }
}

async function handlePutJobGroupInfo(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const p = request.body as Personnel;
  if (!p || !p.id) return response.status(400).json({ error: 'شناسه رکورد نامعتبر است.' });

  // FIX: Refactor query building to avoid type inference issues.
  // Create an object with only the fields to be updated.
  const updateData: Record<string, string | null> = {};
  JOB_GROUP_UPDATE_COLUMNS.forEach(col => {
    // Check if the property exists on the incoming object to avoid updating with undefined
    if (p.hasOwnProperty(col as keyof Personnel)) {
        const val = p[col as keyof Personnel];
        updateData[col] = val === null || val === undefined ? null : String(val);
    }
  });

  // Build query parts from the updateData object.
  const updateFields = Object.keys(updateData).map((col, i) => `${col === 'position' ? `"${col}"` : col} = $${i + 1}`);
  const updateValues = Object.values(updateData);
  
  // Add the ID for the WHERE clause as the last parameter.
  updateValues.push(String(p.id));

  const query = `UPDATE personnel SET ${updateFields.join(', ')} WHERE id = $${updateValues.length} RETURNING *;`;
  
  const { rows } = await (client as any).query(query, updateValues);

  if (rows.length === 0) return response.status(404).json({ error: 'رکورد یافت نشد.'});
  return response.status(200).json({ message: 'اطلاعات به‌روزرسانی شد.', record: rows[0] });
}


// =================================================================================
// DEPENDENTS HANDLERS
// =================================================================================
async function handleGetDependents(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { personnel_code } = request.query;
    if (personnel_code && typeof personnel_code === 'string') {
        const result = await (client as any).query('SELECT * FROM dependents WHERE personnel_code = $1 ORDER BY last_name, first_name;', [personnel_code]);
        return response.status(200).json({ dependents: result.rows });
    }
    const page = parseInt(request.query.page as string) || 1;
    const pageSize = parseInt(request.query.pageSize as string) || 10;
    const searchTerm = (request.query.searchTerm as string) || '';
    const offset = (page - 1) * pageSize;
    const searchQuery = `%${searchTerm.trim()}%`;
    let countResult;
    let dataResult;
    if (searchTerm) {
        const countQuery = `SELECT COUNT(*) FROM dependents WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR (first_name || ' ' || last_name) ILIKE $1 OR national_id ILIKE $1 OR guardian_national_id ILIKE $1 OR personnel_code ILIKE $1;`;
        countResult = await (client as any).query(countQuery, [searchQuery]);
        const dataQuery = `SELECT * FROM dependents WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR (first_name || ' ' || last_name) ILIKE $1 OR national_id ILIKE $1 OR guardian_national_id ILIKE $1 OR personnel_code ILIKE $1 ORDER BY personnel_code, last_name, first_name LIMIT $2 OFFSET $3;`;
        dataResult = await (client as any).query(dataQuery, [searchQuery, String(pageSize), String(offset)]);
    } else {
        countResult = await (client as any).query('SELECT COUNT(*) FROM dependents;');
        dataResult = await (client as any).query('SELECT * FROM dependents ORDER BY personnel_code, last_name, first_name LIMIT $1 OFFSET $2;', [String(pageSize), String(offset)]);
    }
    const totalCount = parseInt(countResult.rows[0].count, 10);
    return response.status(200).json({ dependents: dataResult.rows, totalCount });
}

async function handlePostDependents(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const bodyData = request.body;
  try {
    await client.query('BEGIN');
    if (!Array.isArray(bodyData)) {
        const d = bodyData as NewDependent;
        if (!d.personnel_code || !d.national_id) return response.status(400).json({ error: 'کد پرسنلی و کد ملی بستگان الزامی است.' });
        const { rows: personnelCheck } = await (client as any).query('SELECT 1 FROM personnel WHERE personnel_code = $1;', [d.personnel_code]);
        if (personnelCheck.length === 0) return response.status(400).json({ error: 'خطا در ارتباط با پرسنل.', details: 'کد پرسنلی وارد شده در لیست پرسنل اصلی وجود ندارد.'});

        const columns = ['personnel_code', 'first_name', 'last_name', 'father_name', 'relation_type', 'birth_date', 'gender', 'birth_month', 'birth_day', 'id_number', 'national_id', 'guardian_national_id', 'issue_place', 'insurance_type'];
        const values = columns.map(col => d[col as keyof NewDependent] ?? null);
        const { rows } = await (client as any).query(`INSERT INTO dependents (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *;`, values);
        await client.query('COMMIT');
        return response.status(201).json({ message: 'وابسته با موفقیت اضافه شد.', dependent: rows[0] });
    }

    const allDependents = bodyData as NewDependent[];
    allDependents.forEach(d => { for (const key in d) { if (typeof d[key as keyof NewDependent] === 'string') (d as any)[key] = (d[key as keyof NewDependent] as string).replace(/[\u0000-\u001F\u200B-\u200D\u200E\u200F\uFEFF]/g, '').trim(); } });
    const validList = allDependents.filter(d => d.personnel_code && d.first_name && d.last_name && d.national_id);
    if (validList.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد. لطفاً از وجود ستون‌های کد پرسنلی، نام، نام خانوادگی و کد ملی بستگان اطمینان حاصل کنید.' });
  
    const BATCH_SIZE = 250;
    let totalProcessed = 0;
    const columns = ['personnel_code', 'first_name', 'last_name', 'father_name', 'relation_type', 'birth_date', 'gender', 'birth_month', 'birth_day', 'id_number', 'national_id', 'guardian_national_id', 'issue_place', 'insurance_type'];
    const columnNames = columns.join(', ');
    const updateSet = columns.filter(c => !['personnel_code', 'national_id'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ');

    for (let i = 0; i < validList.length; i += BATCH_SIZE) {
        const batch = validList.slice(i, i + BATCH_SIZE);
        if (batch.length === 0) continue;
        const values: (string | null)[] = [];
        const valuePlaceholders: string[] = [];
        let paramIndex = 1;
        for (const d of batch) {
          const recordPlaceholders: string[] = [];
          for (const col of columns) { values.push(d[col as keyof NewDependent] ?? null); recordPlaceholders.push(`$${paramIndex++}`); }
          valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
        }
        if (values.length > 0) {
            const query = `INSERT INTO dependents (${columnNames}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT (personnel_code, national_id) DO UPDATE SET ${updateSet};`;
            await (client as any).query(query, values);
        }
        totalProcessed += batch.length;
    }

    await client.query('COMMIT');
    return response.status(200).json({ message: `عملیات موفق. ${totalProcessed} رکورد پردازش شد.` });

  } catch (error) {
    await client.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Error in handlePostDependents:", error);
    if (errorMessage.includes('unique_dependent')) return response.status(409).json({ error: 'این وابسته (ترکیب کد پرسنلی و کد ملی) از قبل ثبت شده است.'});
    if (errorMessage.includes('violates foreign key constraint "fk_personnel"')) return response.status(400).json({ error: 'خطا در ارتباط با پرسنل.', details: 'یک یا چند کد پرسنلی در فایل اکسل شما در لیست پرسنل اصلی وجود ندارد. لطفاً ابتدا پرسنل مربوطه را ثبت کنید یا کد پرسنلی را در فایل اکسل اصلاح نمایید.' });
    return response.status(500).json({ error: 'خطا در عملیات پایگاه داده.', details: `این خطا ممکن است به دلیل فرمت نادرست فایل اکسل یا داده‌های نامعتبر باشد. جزئیات فنی: ${errorMessage}` });
  }
}

async function handlePutDependent(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const d = request.body as Dependent;
    if (!d || !d.id) return response.status(400).json({ error: 'شناسه وابسته برای ویرایش الزامی است.' });
    const query = `
        UPDATE dependents SET 
            first_name = $1, last_name = $2, father_name = $3, relation_type = $4, birth_date = $5, gender = $6,
            birth_month = $7, birth_day = $8, id_number = $9, guardian_national_id = $10, issue_place = $11, insurance_type = $12
        WHERE id = $13 RETURNING *;
    `;
    const values = [d.first_name, d.last_name, d.father_name, d.relation_type, d.birth_date, d.gender, d.birth_month, d.birth_day, d.id_number, d.guardian_national_id, d.issue_place, d.insurance_type, String(d.id)];
    const { rows } = await (client as any).query(query, values);
    if (rows.length === 0) return response.status(404).json({ error: 'وابسته‌ای با این شناسه یافت نشد.' });
    return response.status(200).json({ message: 'اطلاعات با موفقیت به‌روزرسانی شد.', dependent: rows[0] });
}

async function handleDeleteDependent(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'شناسه وابسته برای حذف الزامی است.' });
    const dependentId = parseInt(id, 10);
    if (isNaN(dependentId)) return response.status(400).json({ error: 'شناسه نامعتبر است.' });
    const result = await (client as any).query('DELETE FROM dependents WHERE id = $1;', [String(dependentId)]);
    if (result.rowCount === 0) return response.status(404).json({ error: 'وابسته‌ای با این شناسه یافت نشد.' });
    return response.status(200).json({ message: 'وابسته با موفقیت حذف شد.' });
}

// =================================================================================
// COMMUTING MEMBERS HANDLERS
// =================================================================================
async function handleGetCommutingMembers(response: VercelResponse, client: VercelPoolClient) {
    const result = await (client as any).query('SELECT * FROM commuting_members ORDER BY full_name;');
    return response.status(200).json({ members: result.rows });
}

async function handlePostCommutingMembers(body: any, response: VercelResponse, client: VercelPoolClient) {
    try {
        await client.query('BEGIN');
        if (Array.isArray(body)) {
            const allMembers: NewCommutingMember[] = body;
            const validList = allMembers.filter(m => m.personnel_code && m.full_name);
            if (validList.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری یافت نشد.' });
            
            const columns = ['personnel_code', 'full_name', 'department', 'position'];
            const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
            const updateSet = columns.filter(c => c !== 'personnel_code').map(c => `${c === 'position' ? `"${c}"` : c} = EXCLUDED.${c === 'position' ? `"${c}"` : c}`).join(', ');
            const values: (string | null)[] = [];
            let valuePlaceholders: string[] = [];
            let paramIndex = 1;
            for (const member of validList) {
                const recordPlaceholders: string[] = [];
                for (const col of columns) { values.push(member[col as keyof NewCommutingMember] ?? null); recordPlaceholders.push(`$${paramIndex++}`); }
                valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
            }
            const query = `INSERT INTO commuting_members (${columnNames}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT (personnel_code) DO UPDATE SET ${updateSet};`;
            await (client as any).query(query, values);
            await client.query('COMMIT');
            return response.status(200).json({ message: `عملیات موفق. ${validList.length} رکورد پردازش شد.` });
        } else {
            const m: NewCommutingMember = body;
            if (!m || !m.personnel_code || !m.full_name) return response.status(400).json({ error: 'کد پرسنلی و نام کامل الزامی است.' });
            const query = `
                INSERT INTO commuting_members (personnel_code, full_name, department, "position") 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (personnel_code) DO UPDATE SET full_name = EXCLUDED.full_name, department = EXCLUDED.department, "position" = EXCLUDED."position"
                RETURNING *;`;
            const { rows } = await (client as any).query(query, [m.personnel_code, m.full_name, m.department, m.position]);
            await client.query('COMMIT');
            return response.status(201).json({ message: 'عضو جدید اضافه یا به‌روزرسانی شد.', member: rows[0] });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        if (errorMessage.includes('duplicate key')) return response.status(409).json({ error: 'کد پرسنلی تکراری است.' });
        return response.status(500).json({ error: 'خطا در عملیات پایگاه داده.', details: errorMessage });
    }
}

// =================================================================================
// DOCUMENT HANDLERS
// =================================================================================
async function handleGetDocuments(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { personnel_code } = request.query;
    if (!personnel_code || typeof personnel_code !== 'string') return response.status(400).json({ error: 'کد پرسنلی الزامی است.' });
    const { rows } = await (client as any).query('SELECT id, personnel_code, title, file_name, file_type, uploaded_at FROM personnel_documents WHERE personnel_code = $1 ORDER BY uploaded_at DESC;', [personnel_code]);
    return response.status(200).json({ documents: rows });
}

async function handleGetDocumentData(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'شناسه مدرک الزامی است.' });
    const { rows } = await (client as any).query('SELECT file_name, file_type, file_data FROM personnel_documents WHERE id = $1;', [id]);
    if (rows.length === 0) return response.status(404).json({ error: 'مدرک یافت نشد.' });
    return response.status(200).json({ document: rows[0] });
}

async function handlePostDocument(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { personnel_code, title, file_name, file_type, file_data } = request.body;
    if (!personnel_code || !title || !file_name || !file_type || !file_data) return response.status(400).json({ error: 'اطلاعات ارسالی ناقص است.' });
    const query = 'INSERT INTO personnel_documents (personnel_code, title, file_name, file_type, file_data) VALUES ($1, $2, $3, $4, $5) RETURNING id, personnel_code, title, file_name, file_type, uploaded_at;';
    const { rows } = await (client as any).query(query, [personnel_code, title, file_name, file_type, file_data]);
    return response.status(201).json({ message: 'مدرک با موفقیت آپلود شد.', document: rows[0] });
}

async function handleDeleteDocument(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'شناسه مدرک الزامی است.' });
    const result = await (client as any).query('DELETE FROM personnel_documents WHERE id = $1;', [id]);
    if (result.rowCount === 0) return response.status(404).json({ error: 'مدرک یافت نشد.' });
    return response.status(200).json({ message: 'مدرک با موفقیت حذف شد.' });
}


// =================================================================================
// COMMITMENT LETTER HANDLERS
// =================================================================================
async function handleGetCommitmentLetters(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { guarantorCode, searchTerm } = request.query;
    if (guarantorCode && typeof guarantorCode === 'string') {
        const result = await (client as any).query('SELECT COALESCE(SUM(loan_amount), 0) as total FROM commitment_letters WHERE guarantor_personnel_code = $1;', [guarantorCode]);
        return response.status(200).json({ totalCommitted: result.rows[0].total });
    }
    if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim() !== '') {
        const searchQuery = `%${searchTerm.trim()}%`;
        const query = 'SELECT * FROM commitment_letters WHERE recipient_name ILIKE $1 OR recipient_national_id ILIKE $1 OR guarantor_name ILIKE $1 OR guarantor_personnel_code ILIKE $1 OR guarantor_national_id ILIKE $1 ORDER BY created_at DESC;';
        const { rows } = await (client as any).query(query, [searchQuery]);
        return response.status(200).json({ letters: rows });
    }
    const { rows } = await (client as any).query('SELECT * FROM commitment_letters ORDER BY created_at DESC;');
    return response.status(200).json({ letters: rows });
}

async function handlePostCommitmentLetter(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const letter = request.body;
    if (!letter.guarantor_personnel_code || !letter.recipient_name) return response.status(400).json({ error: 'اطلاعات ضامن و وام گیرنده الزامی است.'});
    const query = 'INSERT INTO commitment_letters (recipient_name, recipient_national_id, guarantor_personnel_code, guarantor_name, guarantor_national_id, loan_amount, sum_of_decree_factors, bank_name, branch_name, reference_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;';
    const values = [letter.recipient_name, letter.recipient_national_id, letter.guarantor_personnel_code, letter.guarantor_name, letter.guarantor_national_id, letter.loan_amount, letter.sum_of_decree_factors, letter.bank_name, letter.branch_name, letter.reference_number || null];
    const { rows } = await (client as any).query(query, values);
    return response.status(201).json({ message: 'نامه با موفقیت ثبت شد.', letter: rows[0] });
}

async function handlePutCommitmentLetter(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const letter = request.body;
    if (!letter.id) return response.status(400).json({ error: 'شناسه نامه الزامی است.' });
    const query = 'UPDATE commitment_letters SET recipient_name = $1, recipient_national_id = $2, loan_amount = $3, bank_name = $4, branch_name = $5, reference_number = $6 WHERE id = $7 RETURNING *;';
    const values = [letter.recipient_name, letter.recipient_national_id, letter.loan_amount, letter.bank_name, letter.branch_name, letter.reference_number, letter.id];
    const { rows } = await (client as any).query(query, values);
    return response.status(200).json({ message: 'نامه با موفقیت ویرایش شد.', letter: rows[0] });
}

async function handleDeleteCommitmentLetter(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'شناسه نامه الزامی است.' });
    const result = await (client as any).query('DELETE FROM commitment_letters WHERE id = $1;', [id]);
    if (result.rowCount === 0) return response.status(404).json({ error: 'نامه یافت نشد.' });
    return response.status(200).json({ message: 'نامه با موفقیت حذف شد.' });
}

// =================================================================================
// DISCIPLINARY RECORDS HANDLERS
// =================================================================================
async function handleGetDisciplinaryRecords(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { rows } = await (client as any).query('SELECT * FROM disciplinary_records ORDER BY created_at DESC;');
    return response.status(200).json({ records: rows });
}

async function handlePostDisciplinaryRecords(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const recordsData = request.body;
    try {
        await client.query('BEGIN');
        if (Array.isArray(recordsData)) {
            const allRecords = recordsData as Omit<DisciplinaryRecord, 'id'>[];
            const validList = allRecords.filter(r => r.full_name && r.personnel_code);
            if (validList.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری یافت نشد.' });
            const columns = ['full_name', 'personnel_code', 'meeting_date', 'letter_description', 'final_decision'];
            const values: (string | null)[] = [];
            const valuePlaceholders: string[] = [];
            let paramIndex = 1;
            for (const record of validList) {
                const recordPlaceholders: string[] = [];
                for (const col of columns) { values.push(record[col as keyof typeof record] ?? null); recordPlaceholders.push(`$${paramIndex++}`); }
                valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
            }
            const query = `INSERT INTO disciplinary_records (${columns.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
            await (client as any).query(query, values);
            await client.query('COMMIT');
            return response.status(200).json({ message: `عملیات موفق. ${validList.length} رکورد پردازش شد.` });
        } else {
            const record = recordsData as Omit<DisciplinaryRecord, 'id'>;
            if (!record || !record.full_name || !record.personnel_code) return response.status(400).json({ error: 'نام کامل و کد پرسنلی الزامی است.' });
            const query = 'INSERT INTO disciplinary_records (full_name, personnel_code, meeting_date, letter_description, final_decision) VALUES ($1, $2, $3, $4, $5) RETURNING *;';
            const values = [record.full_name, record.personnel_code, record.meeting_date || null, record.letter_description || null, record.final_decision || null];
            const { rows } = await (client as any).query(query, values);
            await client.query('COMMIT');
            return response.status(201).json({ message: 'رکورد با موفقیت اضافه شد.', record: rows[0] });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return response.status(500).json({ error: 'خطا در عملیات پایگاه داده.', details: errorMessage });
    }
}

async function handlePutDisciplinaryRecord(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const record = request.body as DisciplinaryRecord;
    if (!record || !record.id) return response.status(400).json({ error: 'شناسه رکورد الزامی است.' });
    const query = 'UPDATE disciplinary_records SET full_name = $1, personnel_code = $2, meeting_date = $3, letter_description = $4, final_decision = $5 WHERE id = $6 RETURNING *;';
    const values = [record.full_name, record.personnel_code, record.meeting_date, record.letter_description, record.final_decision, record.id];
    const { rows } = await (client as any).query(query, values);
    return response.status(200).json({ message: 'رکورد با موفقیت ویرایش شد.', record: rows[0] });
}

async function handleDeleteDisciplinaryRecord(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'شناسه رکورد الزامی است.' });
    const result = await (client as any).query('DELETE FROM disciplinary_records WHERE id = $1;', [id]);
    if (result.rowCount === 0) return response.status(404).json({ error: 'رکورد یافت نشد.' });
    return response.status(200).json({ message: 'رکورد با موفقیت حذف شد.' });
}

// =================================================================================
// PERFORMANCE REVIEW HANDLERS
// =================================================================================
async function handleGetPerformanceReviews(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { personnel_code, department, supervisor, year } = request.query;
    let query = `SELECT pr.*, p.first_name, p.last_name FROM performance_reviews pr LEFT JOIN personnel p ON pr.personnel_code = p.personnel_code`;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;
    if (personnel_code && typeof personnel_code === 'string') { conditions.push(`pr.personnel_code = $${paramIndex++}`); params.push(personnel_code); }
    if (department && typeof department === 'string' && department) { conditions.push(`pr.department = $${paramIndex++}`); params.push(department); }
    if (supervisor && typeof supervisor === 'string' && supervisor) { conditions.push(`pr.reviewer_name_and_signature = $${paramIndex++}`); params.push(supervisor); }
    if (year && typeof year === 'string' && year) { conditions.push(`pr.review_period_start LIKE $${paramIndex++}`); params.push(`${year}%`); }
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY pr.review_date DESC;`;
    const { rows } = await (client as any).query(query, params);
    const reviews = rows.map(r => ({ ...r, full_name: `${r.first_name || ''} ${r.last_name || ''}`.trim() }));
    return response.status(200).json({ reviews });
}

async function handlePostPerformanceReview(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const r = request.body as PerformanceReview;
    if (!r || !r.personnel_code) return response.status(400).json({ error: 'کد پرسنلی الزامی است.' });
    const query = `
        INSERT INTO performance_reviews (
            personnel_code, review_period_start, review_period_end, scores_functional, scores_behavioral, scores_ethical,
            total_score_functional, total_score_behavioral, total_score_ethical, overall_score, reviewer_comment, strengths,
            weaknesses_and_improvements, supervisor_suggestions, reviewer_name_and_signature, supervisor_signature,
            manager_signature, submitted_by_user, department
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *;`;
    const values = [
        r.personnel_code, r.review_period_start, r.review_period_end, JSON.stringify(r.scores_functional), JSON.stringify(r.scores_behavioral),
        JSON.stringify(r.scores_ethical), r.total_score_functional, r.total_score_behavioral, r.total_score_ethical, r.overall_score,
        r.reviewer_comment, r.strengths, r.weaknesses_and_improvements, r.supervisor_suggestions, r.reviewer_name_and_signature,
        r.supervisor_signature, r.manager_signature, r.submitted_by_user || null, r.department || null
    ];
    const { rows } = await (client as any).query(query, values);
    return response.status(201).json({ message: 'ارزیابی با موفقیت ثبت شد.', review: rows[0] });
}

async function handleDeletePerformanceReview(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'A review ID is required for deletion.' });
    const result = await (client as any).query('DELETE FROM performance_reviews WHERE id = $1;', [id]);
    if (result.rowCount === 0) return response.status(404).json({ error: 'Review not found.' });
    return response.status(200).json({ message: 'Review deleted successfully.' });
}

// =================================================================================
// BONUS HANDLERS
// =================================================================================
async function handleGetBonuses(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { year, user } = request.query;
    if (!year || typeof year !== 'string' || !user || typeof user !== 'string') return response.status(400).json({ error: 'سال و کاربر برای دریافت اطلاعات کارانه الزامی است.' });
    const query = `SELECT id, personnel_code, first_name, last_name, "position", service_location, monthly_data, submitted_by_user FROM bonuses WHERE "year" = $1 AND submitted_by_user = $2 ORDER BY last_name, first_name;`;
    const { rows } = await (client as any).query(query, [year, user]);
    return response.status(200).json({ bonuses: rows });
}


async function handlePostBonuses(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { year, month, data, submitted_by_user } = request.body;
    if (!year || !month || !Array.isArray(data) || data.length === 0 || !submitted_by_user) return response.status(400).json({ error: 'اطلاعات ارسالی برای ثبت کارانه ناقص یا نامعتبر است.' });
    try {
        await client.query('BEGIN');
        for (const record of data) {
            const { personnel_code, first_name, last_name, position, service_location, department, bonus_value } = record;
            if (!personnel_code || bonus_value === undefined) continue;
            const bonusValueNumber = Number(bonus_value);
            if (isNaN(bonusValueNumber)) continue;
            const monthlyUpdate = { [month]: { bonus: bonusValueNumber, department: department } };
            await (client as any).query(
                `INSERT INTO bonuses (personnel_code, "year", first_name, last_name, "position", service_location, monthly_data, submitted_by_user)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (personnel_code, "year", submitted_by_user) DO UPDATE
                 SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, "position" = EXCLUDED."position", service_location = EXCLUDED.service_location, monthly_data = bonuses.monthly_data || EXCLUDED.monthly_data;`,
                [personnel_code, year, first_name, last_name, position, service_location, JSON.stringify(monthlyUpdate), submitted_by_user]
            );
        }
        await client.query('COMMIT');
        return response.status(200).json({ message: `اطلاعات کارانه ماه '${month}' برای ${data.length} نفر با موفقیت ثبت/به‌روزرسانی شد.` });
    } catch (error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error("Error in handlePostBonuses:", error);
        return response.status(500).json({ error: 'Failed to save bonus data.', details: errorMessage });
    }
}

async function handlePutBonuses(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id, month, bonus_value, department, editor_name } = request.body;
    if (!id || !month || bonus_value === undefined || !department || !editor_name) return response.status(400).json({ error: 'اطلاعات برای ویرایش ناقص است (شامل نام ویرایشگر).' });
    try {
        await client.query('BEGIN');
        const { rows: oldDataRows } = await (client as any).query('SELECT personnel_code, monthly_data FROM bonuses WHERE id = $1', [id]);
        if (oldDataRows.length === 0) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'رکورد یافت نشد.'}); }
        const oldMonthData = oldDataRows[0].monthly_data?.[month];
        const bonusValueNumber = Number(bonus_value);
        if (isNaN(bonusValueNumber)) { await client.query('ROLLBACK'); return response.status(400).json({ error: 'مبلغ کارانه نامعتبر است.' }); }
        const { rows } = await (client as any).query(`UPDATE bonuses SET monthly_data = jsonb_set(monthly_data, '{${month}}', $1::jsonb) WHERE id = $2 RETURNING *;`, [JSON.stringify({ bonus: bonusValueNumber, department: department }), id]);
        const newMonthData = rows[0].monthly_data?.[month];
        if (oldMonthData?.bonus !== newMonthData?.bonus || oldMonthData?.department !== newMonthData?.department) {
             await (client as any).query(`INSERT INTO bonus_edit_logs (bonus_id, personnel_code, editor_name, month, old_bonus_value, new_bonus_value, old_department, new_department) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`, [id, rows[0].personnel_code, editor_name, month, oldMonthData?.bonus || null, newMonthData?.bonus, oldMonthData?.department || null, newMonthData?.department]);
        }
        await client.query('COMMIT');
        return response.status(200).json({ message: 'کارانه با موفقیت ویرایش شد.' });
    } catch(error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error("Error in handlePutBonuses:", error);
        return response.status(500).json({ error: 'خطا در ویرایش کارانه.', details: errorMessage });
    }
}

async function handleDeleteSingleBonus(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { id, month, editor_name } = request.body;
    if (!id || !month || !editor_name) return response.status(400).json({ error: 'اطلاعات برای حذف ناقص است (شامل نام ویرایشگر).' });
    try {
        await client.query('BEGIN');
        const { rows: oldDataRows } = await (client as any).query('SELECT personnel_code, monthly_data FROM bonuses WHERE id = $1', [id]);
        if (oldDataRows.length === 0) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'رکورد یافت نشد.' }); }
        const oldData = oldDataRows[0];
        const oldMonthData = oldData.monthly_data?.[month];
        const { rows } = await (client as any).query('UPDATE bonuses SET monthly_data = monthly_data - $1 WHERE id = $2 RETURNING *;', [month, id]);
        if (oldMonthData) {
            await (client as any).query(`INSERT INTO bonus_edit_logs (bonus_id, personnel_code, editor_name, month, old_bonus_value, new_bonus_value, old_department, new_department) VALUES ($1, $2, $3, $4, $5, NULL, $6, NULL);`, [id, oldData.personnel_code, editor_name, month, oldMonthData.bonus, oldMonthData.department]);
        }
        if (Object.keys(rows[0].monthly_data || {}).length === 0) {
            await (client as any).query('DELETE FROM bonuses WHERE id = $1;', [id]);
        }
        await client.query('COMMIT');
        return response.status(200).json({ message: 'کارانه با موفقیت حذف شد.' });
    } catch(error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'خطا در حذف کارانه.', details: errorMessage });
    }
}

async function handleGetSubmittedBonuses(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { year } = request.query;
    if (!year || typeof year !== 'string') return response.status(400).json({ error: 'سال الزامی است.' });
    try {
        const query = `
            SELECT id, personnel_code, first_name, last_name, "position", service_location, monthly_data, submitted_by_user
            FROM submitted_bonuses WHERE "year" = $1 ORDER BY last_name, first_name;
        `;
        const { rows } = await (client as any).query(query, [parseInt(year, 10)]);
        return response.status(200).json({ bonuses: rows });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to fetch submitted bonus data.', details: errorMessage });
    }
}

async function handleFinalizeBonuses(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { year, user } = request.body;
    if (!year || !user) return response.status(400).json({ error: 'سال و کاربر برای ارسال نهایی الزامی است.' });
    try {
        await client.query('BEGIN');
        const { rows: userBonuses } = await (client as any).query('SELECT * FROM bonuses WHERE "year" = $1 AND submitted_by_user = $2;', [String(year), user]);
        if (userBonuses.length === 0) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'هیچ داده‌ای برای ارسال نهایی یافت نشد.' }); }
        for (const bonus of userBonuses) {
             await (client as any).query(
                `INSERT INTO submitted_bonuses (personnel_code, "year", first_name, last_name, "position", service_location, monthly_data, submitted_by_user)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (personnel_code, "year") DO UPDATE
                 SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, "position" = EXCLUDED."position", service_location = EXCLUDED.service_location, monthly_data = submitted_bonuses.monthly_data || EXCLUDED.monthly_data, submitted_by_user = submitted_bonuses.submitted_by_user || ', ' || EXCLUDED.submitted_by_user;`,
                [bonus.personnel_code, bonus.year, bonus.first_name, bonus.last_name, bonus.position, bonus.service_location, JSON.stringify(bonus.monthly_data), bonus.submitted_by_user]
            );
        }
        await (client as any).query('DELETE FROM bonuses WHERE "year" = $1 AND submitted_by_user = $2;', [String(year), user]);
        await client.query('COMMIT');
        return response.status(200).json({ message: 'کارانه با موفقیت ارسال نهایی و در بایگانی ثبت شد. اطلاعات از صفحه فعلی پاک شد.' });
    } catch (error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'خطا در عملیات ارسال نهایی.', details: errorMessage });
    }
}

async function handleGetBonusEditLogs(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const query = `
        SELECT bel.*, COALESCE(b.first_name, sb.first_name, p.first_name) || ' ' || COALESCE(b.last_name, sb.last_name, p.last_name) as full_name
        FROM bonus_edit_logs bel
        LEFT JOIN bonuses b ON bel.bonus_id = b.id
        LEFT JOIN submitted_bonuses sb ON bel.personnel_code = sb.personnel_code AND sb.year = (SELECT year FROM bonuses WHERE id = bel.bonus_id LIMIT 1)
        LEFT JOIN personnel p ON bel.personnel_code = p.personnel_code
        ORDER BY bel.edit_timestamp DESC;
    `;
    const { rows } = await (client as any).query(query);
    return response.status(200).json({ logs: rows });
}

// =================================================================================
// MAIN API HANDLER
// =================================================================================
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.POSTGRES_URL) return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();

  try {
    const { type } = request.query;

    if (type === 'personnel') {
        switch (request.method) {
            case 'GET': return await handleGetPersonnel(request, response, client);
            case 'POST': return await handlePostPersonnel(request, response, client);
            case 'PUT': return await handlePutPersonnel(request, response, client);
            case 'DELETE': return await handleDeletePersonnel(request, response, client);
            default: response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); return response.status(405).end();
        }
    } else if (type === 'job_group_info') {
        switch (request.method) {
            case 'GET': return await handleGetJobGroupInfo(request, response, client);
            case 'POST': return await handlePostJobGroupInfo(request, response, client);
            case 'PUT': return await handlePutJobGroupInfo(request, response, client);
            case 'DELETE': return await handleDeletePersonnel(request, response, client);
            default: response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); return response.status(405).end();
        }
    } else if (type === 'dependents') {
        switch (request.method) {
            case 'GET': return await handleGetDependents(request, response, client);
            case 'POST': return await handlePostDependents(request, response, client);
            case 'PUT': return await handlePutDependent(request, response, client);
            case 'DELETE': return await handleDeleteDependent(request, response, client);
            default: response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); return response.status(405).end();
        }
    } else if (type === 'commuting_members') {
         switch (request.method) {
            case 'GET': return await handleGetCommutingMembers(response, client);
            case 'POST': return await handlePostCommutingMembers(request.body, response, client);
            default: response.setHeader('Allow', ['GET', 'POST']); return response.status(405).end();
        }
    } else if (type === 'documents') {
        switch (request.method) {
            case 'GET': return await handleGetDocuments(request, response, client);
            case 'POST': return await handlePostDocument(request, response, client);
            case 'DELETE': return await handleDeleteDocument(request, response, client);
            default: response.setHeader('Allow', ['GET', 'POST', 'DELETE']); return response.status(405).end();
        }
    } else if (type === 'document_data') {
        if (request.method === 'GET') return await handleGetDocumentData(request, response, client);
        else { response.setHeader('Allow', ['GET']); return response.status(405).end(); }
    } else if (type === 'commitment_letters') {
        switch (request.method) {
            case 'GET': return await handleGetCommitmentLetters(request, response, client);
            case 'POST': return await handlePostCommitmentLetter(request, response, client);
            case 'PUT': return await handlePutCommitmentLetter(request, response, client);
            case 'DELETE': return await handleDeleteCommitmentLetter(request, response, client);
            default: response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); return response.status(405).end();
        }
    } else if (type === 'disciplinary_records') {
        switch (request.method) {
            case 'GET': return await handleGetDisciplinaryRecords(request, response, client);
            case 'POST': return await handlePostDisciplinaryRecords(request, response, client);
            case 'PUT': return await handlePutDisciplinaryRecord(request, response, client);
            case 'DELETE': return await handleDeleteDisciplinaryRecord(request, response, client);
            default: response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); return response.status(405).end();
        }
    } else if (type === 'performance_reviews') {
        switch (request.method) {
            case 'GET': return await handleGetPerformanceReviews(request, response, client);
            case 'POST': return await handlePostPerformanceReview(request, response, client);
            case 'DELETE': return await handleDeletePerformanceReview(request, response, client);
            default: response.setHeader('Allow', ['GET', 'POST', 'DELETE']); return response.status(405).end();
        }
    } else if (type === 'bonuses') {
        switch (request.method) {
            case 'GET': return await handleGetBonuses(request, response, client);
            case 'POST': return await handlePostBonuses(request, response, client);
            case 'PUT': return await handlePutBonuses(request, response, client);
            case 'DELETE': 
                const { deleteAllForUser, year, user } = request.query;
                if (deleteAllForUser === 'true') {
                    if (!year || typeof year !== 'string' || !user || typeof user !== 'string') return response.status(400).json({ error: 'Year and user are required to delete all data.' });
                    await (client as any).query('DELETE FROM bonuses WHERE "year" = $1 AND submitted_by_user = $2;', [year, user]);
                    return response.status(200).json({ message: 'تمام اطلاعات کارانه این کاربر برای سال انتخاب شده حذف شد.' });
                } else {
                    return await handleDeleteSingleBonus(request, response, client);
                }
            default: response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); return response.status(405).end();
        }
    } else if (type === 'submitted_bonuses') {
        if (request.method === 'GET') return await handleGetSubmittedBonuses(request, response, client);
        else { response.setHeader('Allow', ['GET']); return response.status(405).end(); }
    } else if (type === 'finalize_bonuses') {
        if (request.method === 'POST') return await handleFinalizeBonuses(request, response, client);
        else { response.setHeader('Allow', ['POST']); return response.status(405).end(); }
    } else if (type === 'bonus_edit_logs') {
        if (request.method === 'GET') return await handleGetBonusEditLogs(request, response, client);
        else { response.setHeader('Allow', ['GET']); return response.status(405).end(); }
    }


    return response.status(400).json({ error: `نوع "${type}" نامعتبر است.` });
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
      if (errorMessage.includes('does not exist')) {
        return response.status(500).json({ error: 'یکی از جداول مورد نیاز در پایگاه داده یافت نشد.', details: 'لطفاً از طریق /api/create-users-table از ایجاد جداول اطمینان حاصل کنید.'});
      }
      return response.status(500).json({ error: 'خطای داخلی سرور.', details: errorMessage });
  } finally {
      client.release();
  }
}