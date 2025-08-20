import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SecurityMember } from '../../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
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
      CREATE TABLE IF NOT EXISTS security_members (
        id SERIAL PRIMARY KEY,
        personnel_id INT NOT NULL UNIQUE REFERENCES personnel(id) ON DELETE CASCADE
      );
    `;
  } catch (error) {
    console.error("Database setup error in /api/security-members:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to initialize security_members table' });
    }
    return;
  }

  // GET: Fetch all security members
  if (req.method === 'GET') {
    try {
      const { rows } = await sql<SecurityMember>`
        SELECT 
            p.id, p.first_name, p.last_name, p.personnel_code, p.unit, p.position
        FROM security_members sm
        JOIN personnel p ON sm.personnel_id = p.id
        ORDER BY p.last_name, p.first_name;
      `;
      return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch security members' });
    }
  }

  // POST: Add a new member or bulk import
  if (req.method === 'POST') {
    const client = await sql.connect();
    try {
      await client.sql`BEGIN`;
      // Bulk Import
      if (req.query.action === 'import') {
        const personnelCodes = req.body as string[];
        if (!Array.isArray(personnelCodes)) {
          throw new Error('Invalid import data: Expected an array of personnel codes.');
        }

        for (const code of personnelCodes) {
            const { rows } = await client.sql`SELECT id FROM personnel WHERE personnel_code = ${code};`;
            if (rows.length > 0) {
                const personnelId = rows[0].id;
                await client.sql`
                    INSERT INTO security_members (personnel_id)
                    VALUES (${personnelId})
                    ON CONFLICT (personnel_id) DO NOTHING;
                `;
            }
        }
      }
      // Single Add
      else {
        const { personnel_id } = req.body;
        if (!personnel_id) {
          return res.status(400).json({ error: 'Personnel ID is required' });
        }
        await client.sql`
            INSERT INTO security_members (personnel_id)
            VALUES (${personnel_id})
            ON CONFLICT (personnel_id) DO NOTHING;
        `;
      }
      await client.sql`COMMIT`;
      return res.status(201).json({ success: true });
    } catch (error) {
      await client.sql`ROLLBACK`;
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to add security member(s)', details: errorMessage });
    } finally {
        client.release();
    }
  }

  // DELETE: Delete a member or all members
  if (req.method === 'DELETE') {
    try {
      if (req.query.action === 'delete_all') {
        await sql`TRUNCATE TABLE security_members;`;
        return res.status(204).send(null);
      } else {
        const id = Number(req.query.id);
        if (!id) return res.status(400).json({ error: 'Personnel ID is required' });
        await sql`DELETE FROM security_members WHERE personnel_id = ${id};`;
        return res.status(204).send(null);
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to delete security member(s)' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
