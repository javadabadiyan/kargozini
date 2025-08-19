import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Relative, RelativeWithPersonnel } from '../../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    await sql`
        CREATE TABLE IF NOT EXISTS relatives (
            id SERIAL PRIMARY KEY,
            personnel_id INT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            relation VARCHAR(50),
            national_id VARCHAR(20),
            birth_date VARCHAR(50),
            CONSTRAINT unique_relative_national_id UNIQUE (national_id)
        );
    `;
  } catch (error) {
    console.error("Database setup error in /api/relatives:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to initialize relatives table' });
    }
    return;
  }

  // GET: Fetch all relatives with personnel info
  if (req.method === 'GET') {
    try {
      const { rows } = await sql<RelativeWithPersonnel>`
        SELECT 
            r.*, 
            p.first_name as personnel_first_name, 
            p.last_name as personnel_last_name, 
            p.personnel_code 
        FROM relatives r 
        JOIN personnel p ON r.personnel_id = p.id 
        ORDER BY r.id DESC;
      `;
      return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to fetch relatives', details: errorMessage });
    }
  }

  // POST: Create, Update, or Bulk Import relatives
  if (req.method === 'POST') {
    const client = await sql.connect();
    try {
      await client.query('BEGIN');
      
      // Bulk Import from Excel
      if (req.query.action === 'import') {
        const relativesList = req.body as any[];
        if (!Array.isArray(relativesList) || relativesList.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid import data' });
        }
        
        for (const r of relativesList) {
          if (!r.personnel_code) continue;
          
          const { rows } = await client.query('SELECT id FROM personnel WHERE personnel_code = $1', [r.personnel_code]);
          if (rows.length === 0) {
              console.warn(`Skipping relative import: personnel with code ${r.personnel_code} not found.`);
              continue;
          }
          const personnelId = rows[0].id;

          await client.query(
              `INSERT INTO relatives (personnel_id, first_name, last_name, relation, national_id, birth_date)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (national_id) WHERE national_id IS NOT NULL AND national_id <> '' DO UPDATE SET
                  personnel_id = EXCLUDED.personnel_id,
                  first_name = EXCLUDED.first_name,
                  last_name = EXCLUDED.last_name,
                  relation = EXCLUDED.relation,
                  birth_date = EXCLUDED.birth_date;
              `,
              [personnelId, r.first_name, r.last_name, r.relation, r.national_id, r.birth_date]
          );
        }
      }
      // Single Create/Update
      else {
        const { id, personnel_id, first_name, last_name, relation, national_id, birth_date } = req.body as Relative;
        if (!personnel_id || !first_name || !last_name) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (id) { // Update
          await client.query(
            `UPDATE relatives SET personnel_id=$1, first_name=$2, last_name=$3, relation=$4, national_id=$5, birth_date=$6
             WHERE id=$7`,
            [personnel_id, first_name, last_name, relation, national_id, birth_date, id]
          );
        } else { // Create
          await client.query(
            `INSERT INTO relatives (personnel_id, first_name, last_name, relation, national_id, birth_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [personnel_id, first_name, last_name, relation, national_id, birth_date]
          );
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (errorMessage.includes('unique_relative_national_id')) {
          return res.status(409).json({ error: 'کد ملی وارد شده برای بستگان تکراری است.' });
      }
      return res.status(500).json({ error: 'Failed to save relative data', details: errorMessage });
    } finally {
        client.release();
    }
  }

  // DELETE: Delete a relative
  if (req.method === 'DELETE') {
    try {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Relative ID is required' });
      await sql`DELETE FROM relatives WHERE id = ${id};`;
      return res.status(204).send(null);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to delete relative', details: errorMessage });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
