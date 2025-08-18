
import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
      );
    `;
    
    // Add some default roles if they don't exist
    await sql`
        INSERT INTO roles (name) VALUES ('مدیر'), ('کاربر') ON CONFLICT (name) DO NOTHING;
    `;

    return response.status(200).json({ message: "Table 'roles' created and default roles added successfully." });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ 
        error: 'Failed to create roles table', 
        details: errorMessage 
    });
  }
}
