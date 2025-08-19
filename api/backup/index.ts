import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {

  // GET: EXPORT DATA
  if (req.method === 'GET') {
    const scope = req.query.scope as 'personnel' | 'users' | 'all';
    try {
      const backupData: any = {};
      
      if (scope === 'personnel' || scope === 'all') {
        const { rows } = await sql`SELECT * FROM personnel;`;
        backupData.personnel = rows;
      }

      if (scope === 'users' || scope === 'all') {
        // IMPORTANT: We do NOT export password hashes for security reasons.
        const { rows: users } = await sql`SELECT id, "firstName", "lastName", username FROM app_users;`;
        const { rows: permissions } = await sql`SELECT * FROM user_permissions;`;
        backupData.users = users;
        backupData.user_permissions = permissions;
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
    const { personnel, users, user_permissions } = req.body;

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
        
        if (Array.isArray(users)) {
            await client.query('TRUNCATE app_users RESTART IDENTITY CASCADE;');
            // Since passwords are not included in backups, we set a default password.
            const defaultPassword = 'password123';
            const hashedPassword = await hashPassword(defaultPassword);
            for (const u of users) {
                 await client.query('INSERT INTO app_users (id, "firstName", "lastName", username, password_hash) VALUES ($1, $2, $3, $4, $5);', [u.id, u.firstName, u.lastName, u.username, hashedPassword]);
            }
        }

        if (Array.isArray(user_permissions)) {
            await client.query('TRUNCATE user_permissions RESTART IDENTITY CASCADE;');
            for (const up of user_permissions) {
                 await client.query('INSERT INTO user_permissions (user_id, permission_name) VALUES ($1, $2);', [up.user_id, up.permission_name]);
            }
        }

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Restore successful. Users have been assigned a default password "password123".' });

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