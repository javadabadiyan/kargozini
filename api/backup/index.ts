import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {

  // GET: EXPORT DATA
  if (req.method === 'GET') {
    const scope = req.query.scope as 'personnel' | 'roles' | 'all';
    try {
      const backupData: any = {};
      
      if (scope === 'personnel' || scope === 'all') {
        const { rows } = await sql`SELECT * FROM personnel;`;
        backupData.personnel = rows;
      }

      if (scope === 'roles' || scope === 'all') {
        const { rows: roles } = await sql`SELECT * FROM roles;`;
        const { rows: permissions } = await sql`SELECT * FROM role_permissions;`;
        backupData.roles = roles;
        backupData.role_permissions = permissions;
      }
      
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(backupData);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to create backup', details: errorMessage });
    }
  }

  // POST: RESTORE DATA
  if (req.method === 'POST') {
    const { personnel, roles, role_permissions } = req.body;

    const client = await sql.connect();
    try {
        await client.query('BEGIN');

        if (Array.isArray(personnel)) {
            await client.query('TRUNCATE personnel RESTART IDENTITY CASCADE;');
            for (const p of personnel) {
                 await client.query(`
                    INSERT INTO personnel (id, personnel_code, first_name, last_name, father_name, national_id, id_number, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job, "position", employment_type, unit, service_place, employment_date, education_degree, field_of_study, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22);
                 `, [p.id, p.personnel_code, p.first_name, p.last_name, p.father_name, p.national_id, p.id_number, p.birth_date, p.birth_place, p.issue_date, p.issue_place, p.marital_status, p.military_status, p.job, p.position, p.employment_type, p.unit, p.service_place, p.employment_date, p.education_degree, p.field_of_study, p.status]);
            }
        }
        
        if (Array.isArray(roles)) {
            await client.query('TRUNCATE roles RESTART IDENTITY CASCADE;');
            for (const r of roles) {
                 await client.query('INSERT INTO roles (id, name) VALUES ($1, $2);', [r.id, r.name]);
            }
        }

        if (Array.isArray(role_permissions)) {
            await client.query('TRUNCATE role_permissions RESTART IDENTITY CASCADE;');
            for (const rp of role_permissions) {
                 await client.query('INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2);', [rp.role_id, rp.permission_name]);
            }
        }

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Restore successful' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return res.status(500).json({ error: 'Failed to restore backup', details: errorMessage });
    } finally {
        client.release();
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
