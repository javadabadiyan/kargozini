import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  try {
    // Fetch all personnel from the 'personnel' table
    const { rows } = await sql`SELECT id, name FROM personnel ORDER BY name;`;
    return response.status(200).json({ personnel: rows });
  } catch (error) {
    // Basic error handling
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'Failed to fetch data from the database.', details: errorMessage });
  }
}
