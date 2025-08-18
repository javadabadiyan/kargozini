import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  try {
    const result = await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        "firstName" VARCHAR(50) NOT NULL,
        "lastName" VARCHAR(50) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL
      );
    `;
    return response.status(200).json({ result });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Failed to create table' });
  }
}
