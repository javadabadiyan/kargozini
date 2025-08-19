import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel } from '../../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
    const createTableQuery = `
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

  // GET: Fetch all personnel
  if (req.method === 'GET') {
    try {
      await sql.query(createTableQuery);
      const { rows } = await sql<Personnel>`SELECT * FROM personnel ORDER BY id DESC;`;
      return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to fetch personnel', details: errorMessage });
    }
  }

  // POST: Create, Update, or Bulk Import personnel
  if (req.method === 'POST') {
    // Bulk Import from Excel
    if (req.query.action === 'import') {
        const personnelList = req.body as Omit<Personnel, 'id'>[];
        if (!Array.isArray(personnelList) || personnelList.length === 0) {
            return res.status(400).json({ error: 'Invalid import data' });
        }
        
        try {
            const client = await sql.connect();
            await client.query('BEGIN');
            try {
                for (const p of personnelList) {
                    await client.query(
                        `INSERT INTO personnel (
                            personnel_code, first_name, last_name, father_name, national_id, id_number,
                            birth_date, birth_place, issue_date, issue_place, marital_status,
                            military_status, job, "position", employment_type, unit, service_place,
                            employment_date, education_degree, field_of_study, status
                        ) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                        ON CONFLICT (personnel_code) DO UPDATE SET
                            first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, father_name = EXCLUDED.father_name,
                            national_id = EXCLUDED.national_id, id_number = EXCLUDED.id_number, birth_date = EXCLUDED.birth_date,
                            birth_place = EXCLUDED.birth_place, issue_date = EXCLUDED.issue_date, issue_place = EXCLUDED.issue_place,
                            marital_status = EXCLUDED.marital_status, military_status = EXCLUDED.military_status, job = EXCLUDED.job,
                            "position" = EXCLUDED."position", employment_type = EXCLUDED.employment_type, unit = EXCLUDED.unit,
                            service_place = EXCLUDED.service_place, employment_date = EXCLUDED.employment_date,
                            education_degree = EXCLUDED.education_degree, field_of_study = EXCLUDED.field_of_study, status = EXCLUDED.status;`,
                        [
                            p.personnel_code, p.first_name, p.last_name, p.father_name, p.national_id, p.id_number,
                            p.birth_date, p.birth_place, p.issue_date, p.issue_place, p.marital_status,
                            p.military_status, p.job, p.position, p.employment_type, p.unit, p.service_place,
                            p.employment_date, p.education_degree, p.field_of_study, p.status
                        ]
                    );
                }
                await client.query('COMMIT');
                client.release();
                return res.status(200).json({ message: 'Import successful' });
            } catch (e) {
                await client.query('ROLLBACK');
                client.release();
                throw e; // re-throw the error to be caught by the outer catch
            }
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            return res.status(500).json({ error: 'Failed to import personnel', details: errorMessage });
        }
    }


    // Single Create/Update
    try {
      const { id, ...data } = req.body;
      const {
        personnel_code, first_name, last_name, father_name, national_id, id_number,
        birth_date, birth_place, issue_date, issue_place, marital_status,
        military_status, job, position, employment_type, unit, service_place,
        employment_date, education_degree, field_of_study, status
      } = data;

      if (id) { // Update
        await sql`
            UPDATE personnel 
            SET personnel_code=${personnel_code}, first_name=${first_name}, last_name=${last_name},
                father_name=${father_name}, national_id=${national_id}, id_number=${id_number},
                birth_date=${birth_date}, birth_place=${birth_place}, issue_date=${issue_date},
                issue_place=${issue_place}, marital_status=${marital_status}, military_status=${military_status},
                job=${job}, "position"=${position}, employment_type=${employment_type}, unit=${unit},
                service_place=${service_place}, employment_date=${employment_date}, education_degree=${education_degree},
                field_of_study=${field_of_study}, status=${status}
            WHERE id = ${id};
        `;
        const { rows } = await sql<Personnel>`SELECT * FROM personnel WHERE id = ${id};`;
        return res.status(200).json(rows[0]);
      } else { // Create
        const result = await sql`
            INSERT INTO personnel (
                personnel_code, first_name, last_name, father_name, national_id, id_number,
                birth_date, birth_place, issue_date, issue_place, marital_status,
                military_status, job, "position", employment_type, unit, service_place,
                employment_date, education_degree, field_of_study, status
            ) 
            VALUES (
                ${personnel_code}, ${first_name}, ${last_name}, ${father_name}, ${national_id}, ${id_number},
                ${birth_date}, ${birth_place}, ${issue_date}, ${issue_place}, ${marital_status},
                ${military_status}, ${job}, ${position}, ${employment_type}, ${unit}, ${service_place},
                ${employment_date}, ${education_degree}, ${field_of_study}, ${status}
            )
            RETURNING *;
        `;
        return res.status(201).json(result.rows[0]);
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to save personnel', details: errorMessage });
    }
  }

  // DELETE: Delete personnel
  if (req.method === 'DELETE') {
    try {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Personnel ID is required' });
      
      await sql`DELETE FROM personnel WHERE id = ${id};`;
      return res.status(204).send(null); // No Content
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to delete personnel', details: errorMessage });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}