import { db } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    return response.status(500).json({ error: "Database connection string is not configured.", details: "DATABASE_URL or POSTGRES_URL environment variable is missing." });
  }

  const client = await db.connect();
  try {
    const { rows } = await client.sql`
      SELECT 
        id, personnel_code, first_name, last_name, father_name, national_id, id_number,
        birth_date, birth_place, issue_date, issue_place, marital_status, military_status,
        job_title, "position", employment_type, department, service_location, hire_date,
        education_level, field_of_study, status 
      FROM personnel 
      ORDER BY last_name, first_name;
    `;
    return response.status(200).json({ personnel: rows });
  } catch (error) {
    console.error('Database query failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'Failed to fetch data from the database.', details: errorMessage });
  } finally {
    client.release();
  }
}
