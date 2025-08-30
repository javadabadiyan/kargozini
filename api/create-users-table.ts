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
    // Note: "position" is a reserved SQL keyword, so it's enclosed in double quotes.
    // The UNIQUE constraint on personnel_code is important for the import logic (ON CONFLICT).
    await client.sql`
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
    return response.status(200).json({ message: 'Table "personnel" created or already exists.' });
  } catch (error) {
    console.error('Database table creation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'Failed to create the table in the database.', details: errorMessage });
  } finally {
    client.release();
  }
}
