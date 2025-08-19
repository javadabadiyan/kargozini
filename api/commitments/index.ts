import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AccountingCommitmentWithDetails } from '../../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
     // Ensure personnel table exists before creating the commitments table with a foreign key.
     // This prevents errors on fresh deployments.
    await sql`
        CREATE TABLE IF NOT EXISTS personnel (
            id SERIAL PRIMARY KEY,
            personnel_code VARCHAR(50) UNIQUE NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            father_name VARCHAR(100),
            national_id VARCHAR(20) UNIQUE,
            id_number VARCHAR(20),
            birth_date VARCHAR(50),
            birth_place VARCHAR(100),
            issue_date VARCHAR(50),
            issue_place VARCHAR(100),
            marital_status VARCHAR(50),
            military_status VARCHAR(50),
            job VARCHAR(100),
            "position" VARCHAR(100),
            employment_type VARCHAR(100),
            unit VARCHAR(100),
            service_place VARCHAR(100),
            employment_date VARCHAR(50),
            education_degree VARCHAR(100),
            field_of_study VARCHAR(100),
            status VARCHAR(50)
        );
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS accounting_commitments (
            id SERIAL PRIMARY KEY,
            personnel_id INT REFERENCES personnel(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            letter_date VARCHAR(50) NOT NULL,
            amount BIGINT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            guarantor_first_name VARCHAR(100),
            guarantor_last_name VARCHAR(100),
            guarantor_father_name VARCHAR(100),
            guarantor_personnel_code VARCHAR(50),
            borrower_first_name VARCHAR(100),
            borrower_last_name VARCHAR(100),
            borrower_father_name VARCHAR(100),
            borrower_national_id VARCHAR(20)
        );
    `;
    // Add new column and drop old one for compatibility
    try {
        await sql`ALTER TABLE accounting_commitments ADD COLUMN IF NOT EXISTS addressee VARCHAR(255) NOT NULL DEFAULT 'ریاست محترم';`;
        await sql`ALTER TABLE accounting_commitments DROP COLUMN IF EXISTS guarantor_personnel_id;`;
    } catch (e) {
        if (!(e instanceof Error && (
            e.message.includes('column "guarantor_personnel_id" of relation "accounting_commitments" does not exist') ||
            e.message.includes('column "addressee" of relation "accounting_commitments" already exists')
        ))) {
            console.error("Error modifying table columns, might be fine:", e);
        }
    }

  } catch (error) {
    console.error("Database setup error in /api/commitments:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to initialize commitments table' });
    }
    return;
  }

  // GET: Fetch all commitments with personnel info
  if (req.method === 'GET') {
    try {
      const { rows } = await sql<AccountingCommitmentWithDetails>`
        SELECT 
            c.*, 
            COALESCE(p1.first_name, c.borrower_first_name, '') as personnel_first_name, 
            COALESCE(p1.last_name, c.borrower_last_name, '') as personnel_last_name,
            p1.personnel_code
        FROM accounting_commitments c 
        LEFT JOIN personnel p1 ON c.personnel_id = p1.id
        ORDER BY c.created_at DESC;
      `;
      return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to fetch commitments', details: errorMessage });
    }
  }

  // POST: Create or Update a commitment
  if (req.method === 'POST') {
    try {
        const { 
            id, personnel_id, addressee, title, letter_date, amount, body, 
            guarantor_first_name, guarantor_last_name, guarantor_father_name, guarantor_personnel_code,
            borrower_first_name, borrower_last_name, borrower_father_name, borrower_national_id
        } = req.body;

        if (!addressee || !title || !letter_date || !amount || !body || !guarantor_first_name || !guarantor_last_name || (!personnel_id && !borrower_first_name)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (id) { // Update
            const result = await sql`
                UPDATE accounting_commitments SET
                    personnel_id = ${personnel_id || null},
                    addressee = ${addressee},
                    title = ${title},
                    letter_date = ${letter_date},
                    amount = ${amount},
                    body = ${body},
                    guarantor_first_name = ${guarantor_first_name},
                    guarantor_last_name = ${guarantor_last_name},
                    guarantor_father_name = ${guarantor_father_name},
                    guarantor_personnel_code = ${guarantor_personnel_code},
                    borrower_first_name = ${borrower_first_name || null},
                    borrower_last_name = ${borrower_last_name || null},
                    borrower_father_name = ${borrower_father_name || null},
                    borrower_national_id = ${borrower_national_id || null}
                WHERE id = ${id}
                RETURNING *;
            `;
            return res.status(200).json(result.rows[0]);
        } else { // Create
            const result = await sql`
                INSERT INTO accounting_commitments (
                    personnel_id, addressee, title, letter_date, amount, body,
                    guarantor_first_name, guarantor_last_name, guarantor_father_name, guarantor_personnel_code,
                    borrower_first_name, borrower_last_name, borrower_father_name, borrower_national_id
                )
                VALUES (
                    ${personnel_id || null}, ${addressee}, ${title}, ${letter_date}, ${amount}, ${body},
                    ${guarantor_first_name}, ${guarantor_last_name}, ${guarantor_father_name}, ${guarantor_personnel_code},
                    ${borrower_first_name || null}, ${borrower_last_name || null}, ${borrower_father_name || null}, ${borrower_national_id || null}
                )
                RETURNING *;
            `;
            return res.status(201).json(result.rows[0]);
        }
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