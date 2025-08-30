import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CommutingMember } from '../types';

type NewCommutingMember = Omit<CommutingMember, 'id'>;

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

  const allMembers = request.body as NewCommutingMember[];

  if (!Array.isArray(allMembers)) {
    return response.status(400).json({ error: 'فرمت داده‌های ارسالی نامعتبر است.' });
  }

  const validList = allMembers.filter(m => m.personnel_code && m.full_name);

  if (validList.length === 0) {
    return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد. کد پرسنلی و نام و نام خانوادگی الزامی هستند.' });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });
  const client = await pool.connect();

  try {
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query('BEGIN');

    const columns = ['personnel_code', 'full_name', 'department', 'position'];
    const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');

    const updateSet = columns
      .filter(c => c !== 'personnel_code')
      .map(c => `${c === 'position' ? `"${c}"` : c} = EXCLUDED.${c === 'position' ? `"${c}"` : c}`)
      .join(', ');

    const values: (string | null)[] = [];
    const valuePlaceholders: string[] = [];
    let paramIndex = 1;

    for (const member of validList) {
      const recordPlaceholders: string[] = [];
      for (const col of columns) {
        values.push(member[col as keyof NewCommutingMember] ?? null);
        recordPlaceholders.push(`$${paramIndex++}`);
      }
      valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
    }

    const query = `
      INSERT INTO commuting_members (${columnNames})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (personnel_code) DO UPDATE SET ${updateSet};
    `;
    
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query(query, values);
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query('COMMIT');

    return response.status(200).json({ message: `عملیات موفق. ${validList.length} رکورد پردازش شد.` });
  
  } catch (error) {
    // FIX: Cast client to 'any' to bypass a potential type definition issue with VercelPoolClient. The underlying pg client supports the .query method.
    await (client as any).query('ROLLBACK').catch(console.error);
    console.error('Database bulk insert/update for commuting members failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  } finally {
    client.release();
  }
}