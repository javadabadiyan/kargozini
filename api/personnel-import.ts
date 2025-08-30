import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel } from '../types';

type NewPersonnel = Omit<Personnel, 'id'>;

const BATCH_SIZE = 500; // Process records in batches to avoid timeouts and memory limits

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
  
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
        details: 'لطفاً تنظیمات پروژه خود را در Vercel بررسی کنید و از اتصال صحیح پایگاه داده اطمینان حاصل کنید.'
    });
  }

  const allPersonnel = request.body as NewPersonnel[];

  if (!Array.isArray(allPersonnel)) {
    return response.status(400).json({ error: 'لیست پرسنل نامعتبر است.' });
  }

  const validPersonnelList = allPersonnel.filter(p => p.personnel_code && p.first_name && p.last_name);

  if (validPersonnelList.length === 0) {
    return response.status(200).json({ message: 'هیچ رکورد معتبری برای ورود یافت نشد. لطفاً از وجود ستون‌های کد پرسنلی، نام و نام خانوادگی اطمینان حاصل کنید.' });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });
  const client = await pool.connect();

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

        // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
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
        
        // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
        await (client as any).query(query, values);
        // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
        await (client as any).query('COMMIT');
        totalProcessed += batch.length;
    }

    return response.status(200).json({ message: `عملیات موفق. ${totalProcessed} رکورد پردازش شد.` });
  
  } catch (error) {
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query('ROLLBACK').catch(rollbackError => {
        console.error('Failed to rollback transaction:', rollbackError);
    });

    console.error('Database bulk insert/update failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  } finally {
    client.release();
  }
}