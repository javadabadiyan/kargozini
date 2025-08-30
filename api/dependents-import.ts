import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Dependent } from '../types';

type NewDependent = Omit<Dependent, 'id'>;

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
    });
  }

  const allDependents = request.body as NewDependent[];

  if (!Array.isArray(allDependents)) {
    return response.status(400).json({ error: 'فرمت داده‌های ارسالی نامعتبر است.' });
  }

  // Filter for records that have the minimum required info
  const validList = allDependents.filter(d => d.personnel_code && d.first_name && d.last_name && d.national_id);

  if (validList.length === 0) {
    return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد. کد پرسنلی، نام، نام خانوادگی و کد ملی الزامی هستند.' });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const columns = [
      'personnel_code', 'relation_type', 'first_name', 'last_name', 
      'national_id', 'birth_date', 'gender'
    ];
    const columnNames = columns.join(', ');

    // On conflict, update all columns except the unique identifiers
    const updateSet = columns
      .filter(c => !['personnel_code', 'national_id'].includes(c))
      .map(c => `${c} = EXCLUDED.${c}`)
      .join(', ');

    const values: (string | null)[] = [];
    const valuePlaceholders: string[] = [];
    let paramIndex = 1;

    for (const d of validList) {
      const recordPlaceholders: string[] = [];
      for (const col of columns) {
        values.push(d[col as keyof NewDependent] ?? null);
        recordPlaceholders.push(`$${paramIndex++}`);
      }
      valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
    }

    const query = `
      INSERT INTO dependents (${columnNames})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (personnel_code, national_id) DO UPDATE SET ${updateSet};
    `;
    
    await client.query(query, values);
    await client.query('COMMIT');

    return response.status(200).json({ message: `عملیات موفق. ${validList.length} رکورد پردازش شد.` });
  
  } catch (error) {
    await client.query('ROLLBACK').catch(console.error);
    console.error('Database bulk insert/update for dependents failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

     if (errorMessage.includes('violates foreign key constraint')) {
        return response.status(400).json({ error: 'کد پرسنلی نامعتبر.', details: 'یک یا چند کد پرسنلی در فایل اکسل شما در لیست پرسنل اصلی وجود ندارد.' });
    }

    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  } finally {
    client.release();
  }
}
