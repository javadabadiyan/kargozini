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

  const allPersonnel = request.body as NewPersonnel[];

  if (!Array.isArray(allPersonnel)) {
    return response.status(400).json({ error: 'لیست پرسنل نامعتبر است.' });
  }

  // Filter out records with missing essential data before processing
  const validPersonnelList = allPersonnel.filter(p => p.personnel_code && p.first_name && p.last_name);

  if (validPersonnelList.length === 0) {
    return response.status(200).json({ message: 'هیچ رکورد معتبری برای ورود یافت نشد. لطفاً از وجود ستون‌های کد پرسنلی، نام و نام خانوادگی اطمینان حاصل کنید.' });
  }
  
  const client = await db.connect();
  try {
    const columns = [
      'personnel_code', 'first_name', 'last_name', 'father_name', 'national_id', 'id_number',
      'birth_date', 'birth_place', 'issue_date', 'issue_place', 'marital_status', 'military_status',
      'job_title', 'position', 'employment_type', 'department', 'service_location', 'hire_date',
      'education_level', 'field_of_study', 'status'
    ];
    
    // Create a string of column names, quoting "position" as it's a reserved keyword.
    const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');

    const values: (string | null)[] = [];
    const valuePlaceholders: string[] = [];
    let paramIndex = 1;

    for (const p of validPersonnelList) {
      const recordPlaceholders: string[] = [];
      for (const col of columns) {
        values.push(p[col as keyof NewPersonnel] ?? null);
        recordPlaceholders.push(`$${paramIndex++}`);
      }
      valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
    }

    // Create the SET clause for the ON CONFLICT part, updating all columns except the conflict key.
    const updateSet = columns
      .filter(c => c !== 'personnel_code')
      .map(c => `${c === 'position' ? `"${c}"` : c} = EXCLUDED.${c === 'position' ? `"${c}"` : c}`)
      .join(', ');

    const query = `
      INSERT INTO personnel (${columnNames})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (personnel_code) DO UPDATE SET ${updateSet};
    `;
    
    // Use client.query for dynamically constructed queries with parameter arrays.
    await client.query(query, values);

    return response.status(200).json({ message: `عملیات موفق. ${validPersonnelList.length} رکورد پردازش شد.` });
  
  } catch (error) {
    console.error('Database bulk insert/update failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'عملیات پایگاه داده با شکست مواجه شد.', details: errorMessage });
  } finally {
    client.release();
  }
}