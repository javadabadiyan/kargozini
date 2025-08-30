import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  try {
    // Note: "position" is a reserved SQL keyword, so it's enclosed in double quotes.
    // The UNIQUE constraint on personnel_code is important for the import logic (ON CONFLICT).
    await sql`
      CREATE TABLE IF NOT EXISTS personnel (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100),
        national_id VARCHAR(20) UNIQUE,
        id_number VARCHAR(20),
        birth_date VARCHAR(30),
        birth_place VARCHAR(100),
        issue_date VARCHAR(30),
        issue_place VARCHAR(100),
        marital_status VARCHAR(50),
        military_status VARCHAR(50),
        job_title VARCHAR(255),
        "position" VARCHAR(255),
        employment_type VARCHAR(100),
        department VARCHAR(100),
        service_location VARCHAR(255),
        hire_date VARCHAR(30),
        education_level VARCHAR(100),
        field_of_study VARCHAR(100),
        status VARCHAR(50)
      );
    `;

    // Enable the pg_trgm extension for efficient text searching (ILIKE)
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;

    // Create GIN indexes for fast ILIKE searching on name fields.
    // This is the key fix for preventing timeouts on the personnel list page.
    await sql`CREATE INDEX IF NOT EXISTS personnel_first_name_trgm_idx ON personnel USING gin (first_name gin_trgm_ops);`;
    await sql`CREATE INDEX IF NOT EXISTS personnel_last_name_trgm_idx ON personnel USING gin (last_name gin_trgm_ops);`;
    
    // Create a standard index for sorting to improve performance of ORDER BY
    await sql`CREATE INDEX IF NOT EXISTS personnel_last_first_name_idx ON personnel (last_name, first_name);`;

    return response.status(200).json({ message: 'جدول و ایندکس‌های بهینه‌سازی با موفقیت ایجاد یا تایید شدند.' });
  } catch (error) {
    console.error('Database table/index creation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'ایجاد جدول یا ایندکس در پایگاه داده با خطا مواجه شد.', details: errorMessage });
  }
}