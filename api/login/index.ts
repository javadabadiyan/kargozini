import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Buffer } from 'node:buffer';
import type { User } from '../../types';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function setupTables() {
    const client = await sql.connect();
    try {
        await client.query('BEGIN');
        // Ensure tables exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_users (
                id SERIAL PRIMARY KEY,
                "firstName" VARCHAR(100) NOT NULL,
                "lastName" VARCHAR(100) NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                permission_name VARCHAR(100) NOT NULL,
                PRIMARY KEY (user_id, permission_name)
            );
        `);
        
        // Upsert the admin user and reset their password to the default.
        // This ensures the admin account is always available with the password defined in the code,
        // fixing login issues after redeployment.
        // NOTE: This will reset any password changes made to the 'ادمین' account via the UI on each deployment.
        const defaultPassword = '5221157';
        const hashedPassword = await hashPassword(defaultPassword);

        const { rows: userRows } = await client.query(
            `INSERT INTO app_users ("firstName", "lastName", username, password_hash)
             VALUES ('مدیر', 'سیستم', 'ادمین', $1)
             ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                "firstName" = EXCLUDED."firstName",
                "lastName" = EXCLUDED."lastName"
             RETURNING id;`,
            [hashedPassword]
        );
        const adminId = userRows[0].id;

        // Ensure admin has all permissions by clearing and re-adding them.
        const allPermissions = ['manage_personnel', 'manage_users', 'manage_settings', 'perform_backup'];
        
        await client.query('DELETE FROM user_permissions WHERE user_id = $1;', [adminId]);
        for (const p of allPermissions) {
            await client.query(
                'INSERT INTO user_permissions (user_id, permission_name) VALUES ($1, $2) ON CONFLICT DO NOTHING;', 
                [adminId, p]
            );
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e; // Re-throw error to be caught by handler
    } finally {
        client.release();
    }
}

async function verifyPassword(storedPasswordHash: string, suppliedPassword: string): Promise<boolean> {
  const [salt, key] = storedPasswordHash.split(':');
  if (!salt || !key) return false;
  
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = (await scryptAsync(suppliedPassword, salt, 64)) as Buffer;
  
  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }
  
  return timingSafeEqual(keyBuffer, derivedKey);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Ensure database tables and admin user are correctly configured
    await setupTables();

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    // Check if the user exists
    const { rows: userRows } = await sql`SELECT * FROM app_users WHERE username = ${username};`;
    
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
    }

    const userRecord = userRows[0];
    const isPasswordValid = await verifyPassword(userRecord.password_hash, password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
    }

    // Fetch user permissions
    const { rows: permissionRows } = await sql`
        SELECT permission_name FROM user_permissions WHERE user_id = ${userRecord.id};
    `;
    const permissions = permissionRows.map(p => p.permission_name);

    // Prepare user object to return to client (without password hash)
    const user: User = {
      id: userRecord.id,
      firstName: userRecord.firstName,
      lastName: userRecord.lastName,
      username: userRecord.username,
      permissions: permissions,
    };

    return res.status(200).json(user);

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: 'خطای داخلی سرور' });
  }
}