import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppSettings } from '../../types';
import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { Buffer } from 'node:buffer';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

const handleBackup = async (req: VercelRequest, res: VercelResponse) => {
    const scope = req.query.scope as 'personnel' | 'users' | 'all';
    try {
      const backupData: any = {};
      
      if (scope === 'personnel' || scope === 'all') {
        const { rows } = await sql`SELECT * FROM personnel;`;
        backupData.personnel = rows;
      }

      if (scope === 'users' || scope === 'all') {
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
};

const handleRestore = async (req: VercelRequest, res: VercelResponse) => {
    const { personnel, users, user_permissions } = req.body;

    const client = await sql.connect();
    try {
        await client.sql`BEGIN`;

        if (Array.isArray(personnel)) {
            await client.sql`TRUNCATE personnel RESTART IDENTITY CASCADE;`;
            for (const p of personnel) {
                 await client.sql`
                    INSERT INTO personnel (id, personnel_code, first_name, last_name, father_name, national_id, id_number, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job, "position", employment_type, unit, service_place, employment_date, education_degree, field_of_study, status)
                    VALUES (${p.id}, ${p.personnel_code}, ${p.first_name}, ${p.last_name}, ${p.father_name}, ${p.national_id}, ${p.id_number}, ${p.birth_date}, ${p.birth_place}, ${p.issue_date}, ${p.issue_place}, ${p.marital_status}, ${p.military_status}, ${p.job}, ${p.position}, ${p.employment_type}, ${p.unit}, ${p.service_place}, ${p.employment_date}, ${p.education_degree}, ${p.field_of_study}, ${p.status});
                 `;
            }
        }
        
        if (Array.isArray(users)) {
            await client.sql`TRUNCATE app_users RESTART IDENTITY CASCADE;`;
            const defaultPassword = '5221157';
            const hashedPassword = await hashPassword(defaultPassword);
            for (const u of users) {
                 await client.sql`INSERT INTO app_users (id, "firstName", "lastName", username, password_hash) VALUES (${u.id}, ${u.firstName}, ${u.lastName}, ${u.username}, ${hashedPassword});`;
            }
        }

        if (Array.isArray(user_permissions)) {
            await client.sql`TRUNCATE user_permissions RESTART IDENTITY CASCADE;`;
            for (const up of user_permissions) {
                 await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${up.user_id}, ${up.permission_name});`;
            }
        }

        await client.sql`COMMIT`;
        return res.status(200).json({ message: 'پشتیبان با موفقیت بازگردانی شد. رمز عبور تمام کاربران به "5221157" تغییر یافت.' });

    } catch (error) {
        await client.sql`ROLLBACK`;
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return res.status(500).json({ error: 'Failed to restore backup', details: errorMessage });
    } finally {
        client.release();
    }
};


export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // --- Backup and Restore Logic ---
  if (req.query.action === 'backup') {
    return handleBackup(req, res);
  }
  if (req.query.action === 'restore') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Restore must be a POST request.' });
    return handleRestore(req, res);
  }

  // --- General Settings Logic ---
  try {
    await sql`
        CREATE TABLE IF NOT EXISTS app_settings (
            id INT PRIMARY KEY DEFAULT 1,
            app_name VARCHAR(255) NOT NULL,
            app_logo TEXT,
            CONSTRAINT single_row CHECK (id = 1)
        );
    `;
    await sql`
        INSERT INTO app_settings (id, app_name, app_logo)
        VALUES (1, 'سیستم جامع کارگزینی', NULL)
        ON CONFLICT (id) DO NOTHING;
    `;
  } catch (error) {
    console.error("Database setup error in /api/settings:", error);
    return res.status(500).json({ error: 'Failed to initialize settings table' });
  }

  // GET: Fetch settings
  if (req.method === 'GET') {
    try {
      const { rows } = await sql<AppSettings>`SELECT app_name, app_logo FROM app_settings WHERE id = 1;`;
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Settings not found' });
      }
      return res.status(200).json(rows[0]);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  // POST: Update settings
  if (req.method === 'POST') {
    try {
      const { app_name, app_logo } = req.body as AppSettings;
      if (!app_name) {
        return res.status(400).json({ error: 'App name is required' });
      }

      const result = await sql<AppSettings>`
        UPDATE app_settings
        SET app_name = ${app_name}, app_logo = ${app_logo}
        WHERE id = 1
        RETURNING app_name, app_logo;
      `;
      return res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to save settings' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}