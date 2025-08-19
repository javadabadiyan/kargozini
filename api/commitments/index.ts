import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AccountingCommitmentWithDetails } from '../../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    await sql`
        CREATE TABLE IF NOT EXISTS accounting_commitments (
            id SERIAL PRIMARY KEY,
            personnel_id INT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
            guarantor_personnel_id INT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            letter_date VARCHAR(50) NOT NULL,
            amount BIGINT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
  } catch (error) {
    console.error("Database setup error in /api/commitments:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to initialize commitments table' });
    }
    return;
  }

  // GET: Fetch all commitments with personnel and guarantor info
  if (req.method === 'GET') {
    try {
      const { rows } = await sql<AccountingCommitmentWithDetails>`
        SELECT 
            c.*, 
            p1.first_name as personnel_first_name, 
            p1.last_name as personnel_last_name,
            p1.personnel_code as personnel_code,
            p2.first_name as guarantor_first_name, 
            p2.last_name as guarantor_last_name,
            p2.personnel_code as guarantor_code
        FROM accounting_commitments c 
        JOIN personnel p1 ON c.personnel_id = p1.id
        JOIN personnel p2 ON c.guarantor_personnel_id = p2.id
        ORDER BY c.created_at DESC;
      `;
      return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to fetch commitments', details: errorMessage });
    }
  }

  // POST: Create a new commitment
  if (req.method === 'POST') {
    try {
        const { personnel_id, guarantor_personnel_id, title, letter_date, amount, body } = req.body;

        if (!personnel_id || !guarantor_personnel_id || !title || !letter_date || !amount || !body) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await sql`
            INSERT INTO accounting_commitments (personnel_id, guarantor_personnel_id, title, letter_date, amount, body)
            VALUES (${personnel_id}, ${guarantor_personnel_id}, ${title}, ${letter_date}, ${amount}, ${body})
            RETURNING *;
        `;
        return res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return res.status(500).json({ error: 'Failed to save commitment', details: errorMessage });
    }
  }

  // DELETE: Delete a commitment
  if (req.method === 'DELETE') {
    try {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Commitment ID is required' });
      await sql`DELETE FROM accounting_commitments WHERE id = ${id};`;
      return res.status(204).send(null);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to delete commitment', details: errorMessage });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}