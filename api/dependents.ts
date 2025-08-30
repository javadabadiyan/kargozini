import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Dependent } from '../types';

type NewDependent = Omit<Dependent, 'id'>;

// --- GET Handler ---
async function handleGet(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { personnel_code } = request.query;
  try {
    let result;
    if (personnel_code && typeof personnel_code === 'string') {
      result = await pool.sql`
        SELECT * FROM dependents 
        WHERE personnel_code = ${personnel_code}
        ORDER BY last_name, first_name;
      `;
    } else {
      // Fetch all for export
      result = await pool.sql`SELECT * FROM dependents ORDER BY personnel_code, last_name, first_name;`;
    }

    return response.status(200).json({ dependents: result.rows });
  } catch (error) {
    console.error('Database query for dependents failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (errorMessage.includes('relation "dependents" does not exist')) {
        return response.status(500).json({ 
            error: 'جدول بستگان (dependents) در پایگاه داده یافت نشد.', 
            details: 'لطفاً با مراجعه به آدرس /api/create-users-table از ایجاد جدول اطمینان حاصل کنید.' 
        });
    }

    return response.status(500).json({ error: 'Failed to fetch dependents data.', details: errorMessage });
  }
}

// --- POST Handler (Bulk Import) ---
async function handlePost(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
  const allDependents = request.body as NewDependent[];

  if (!Array.isArray(allDependents)) {
    return response.status(400).json({ error: 'فرمت داده‌های ارسالی نامعتبر است.' });
  }

  const validList = allDependents.filter(d => d.personnel_code && d.first_name && d.last_name && d.national_id);

  if (validList.length === 0) {
    return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد. کد پرسنلی، نام، نام خانوادگی و کد ملی الزامی هستند.' });
  }
  
  try {
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query('BEGIN');

    const columns = [
      'personnel_code', 'relation_type', 'first_name', 'last_name', 
      'national_id', 'birth_date', 'gender'
    ];
    const columnNames = columns.join(', ');

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
    
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query(query, values);
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query('COMMIT');

    return response.status(200).json({ message: `عملیات موفق. ${validList.length} رکورد پردازش شد.` });
  
  } catch (error) {
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query('ROLLBACK').catch(console.error);
    console.error('Database bulk insert/update for dependents failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

     if (errorMessage.includes('violates foreign key constraint')) {
        return response.status(400).json({ error: 'کد پرسنلی نامعتبر.', details: 'یک یا چند کد پرسنلی در فایل اکسل شما در لیست پرسنل اصلی وجود ندارد.' });
    }

    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  }
}

// --- Main Handler ---
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
    });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });

  switch (request.method) {
    case 'GET':
      return await handleGet(request, response, pool);
    case 'POST': {
        const client = await pool.connect();
        try {
            return await handlePost(request, response, client);
        } finally {
            client.release();
        }
    }
    default:
      response.setHeader('Allow', ['GET', 'POST']);
      return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }
}