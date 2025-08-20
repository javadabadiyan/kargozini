import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scrypt, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Buffer } from 'node:buffer';
import type { User, AppSettings } from '../../types';

const scryptAsync = promisify(scrypt);

const ALL_PERMISSIONS = [
    { name: 'manage_personnel', description: 'افزودن، ویرایش و حذف پرسنل' },
    { name: 'manage_users', description: 'مدیریت کاربران و دسترسی‌های آنها' },
    { name: 'manage_settings', description: 'تغییر تنظیمات کلی برنامه' },
    { name: 'perform_backup', description: 'ایجاد و بازگردانی پشتیبان' },
];

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

function verifyPassword(storedPasswordHash: string, suppliedPassword: string): boolean {
  const [salt, key] = storedPasswordHash.split(':');
  if (!salt || !key) return false;
  
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = scryptSync(suppliedPassword, salt, 64);
  
  if (keyBuffer.length !== derivedKey.length) return false;
  
  return timingSafeEqual(keyBuffer, derivedKey);
}


async function setupTables() {
    const client = await sql.connect();
    try {
        await client.sql`BEGIN`;
        // User tables
        await client.sql`CREATE TABLE IF NOT EXISTS app_users (id SERIAL PRIMARY KEY, "firstName" VARCHAR(100) NOT NULL, "lastName" VARCHAR(100) NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, password_hash TEXT NOT NULL);`;
        await client.sql`CREATE TABLE IF NOT EXISTS user_permissions (user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, permission_name VARCHAR(100) NOT NULL, PRIMARY KEY (user_id, permission_name));`;
        
        // Upsert admin user
        const defaultPassword = '5221157';
        const hashedPassword = await hashPassword(defaultPassword);
        const { rows: userRows } = await client.sql`
             INSERT INTO app_users ("firstName", "lastName", username, password_hash) VALUES ('مدیر', 'سیستم', 'ادمین', ${hashedPassword})
             ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName"
             RETURNING id;
        `;
        const adminId = userRows[0].id;

        // Ensure admin has all permissions
        await client.sql`DELETE FROM user_permissions WHERE user_id = ${adminId};`;
        for (const p of ALL_PERMISSIONS) {
            await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${adminId}, ${p.name}) ON CONFLICT DO NOTHING;`;
        }

        // Settings table
        await client.sql`CREATE TABLE IF NOT EXISTS app_settings (id INT PRIMARY KEY DEFAULT 1, app_name VARCHAR(255) NOT NULL, app_logo TEXT, CONSTRAINT single_row CHECK (id = 1));`;
        await client.sql`INSERT INTO app_settings (id, app_name, app_logo) VALUES (1, 'سیستم جامع کارگزینی', NULL) ON CONFLICT (id) DO NOTHING;`;

        await client.sql`COMMIT`;
    } catch (e) {
        await client.sql`ROLLBACK`;
        throw e;
    } finally {
        client.release();
    }
}

// --- Handler for SETTINGS ---
async function handleSettings(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const { rows } = await sql<AppSettings>`SELECT app_name, app_logo FROM app_settings WHERE id = 1;`;
        return res.status(rows.length > 0 ? 200 : 404).json(rows[0] || { error: 'Settings not found' });
    }
    if (req.method === 'POST') {
        const { app_name, app_logo } = req.body as AppSettings;
        if (!app_name) return res.status(400).json({ error: 'App name is required' });
        const result = await sql<AppSettings>`UPDATE app_settings SET app_name = ${app_name}, app_logo = ${app_logo} WHERE id = 1 RETURNING app_name, app_logo;`;
        return res.status(200).json(result.rows[0]);
    }
}

// --- Handler for BACKUP/RESTORE ---
async function handleBackup(req: VercelRequest, res: VercelResponse) {
    const scope = req.query.scope as string;
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
    return res.status(200).json(backupData);
}

async function handleRestore(req: VercelRequest, res: VercelResponse) {
    const { personnel, users, user_permissions } = req.body;
    const client = await sql.connect();
    try {
        await client.sql`BEGIN`;
        if (Array.isArray(personnel)) {
            await client.sql`TRUNCATE personnel RESTART IDENTITY CASCADE;`;
            for (const p of personnel) {
                 await client.sql`INSERT INTO personnel (id, personnel_code, first_name, last_name, father_name, national_id, id_number, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job, "position", employment_type, unit, service_place, employment_date, education_degree, field_of_study, status) VALUES (${p.id}, ${p.personnel_code}, ${p.first_name}, ${p.last_name}, ${p.father_name}, ${p.national_id}, ${p.id_number}, ${p.birth_date}, ${p.birth_place}, ${p.issue_date}, ${p.issue_place}, ${p.marital_status}, ${p.military_status}, ${p.job}, ${p.position}, ${p.employment_type}, ${p.unit}, ${p.service_place}, ${p.employment_date}, ${p.education_degree}, ${p.field_of_study}, ${p.status});`;
            }
        }
        if (Array.isArray(users)) {
            await client.sql`TRUNCATE app_users RESTART IDENTITY CASCADE;`;
            const hashedPassword = await hashPassword('5221157');
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
        return res.status(200).json({ message: 'پشتیبان با موفقیت بازگردانی شد.' });
    } finally {
        client.release();
    }
}


// --- MAIN HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        await setupTables();
    } catch (e) {
        console.error("Table setup failed:", e);
        return res.status(500).json({ error: 'Database initialization failed' });
    }

    const action = req.query.action as string;
    
    // --- Route by action ---
    try {
        if (action === 'settings') return await handleSettings(req, res);
        if (action === 'backup') return await handleBackup(req, res);
        if (req.method === 'POST' && action === 'restore') return await handleRestore(req, res);
    } catch(error) {
        console.error(`Error during action "${action}":`, error);
        return res.status(500).json({ error: `Failed to execute action: ${action}` });
    }

    // --- Default User Management Logic ---
    if (req.method === 'GET') {
        const { rows } = await sql`SELECT u.id, u."firstName", u."lastName", u.username, COALESCE(json_agg(p.permission_name) FILTER (WHERE p.permission_name IS NOT NULL), '[]') as permissions FROM app_users u LEFT JOIN user_permissions p ON u.id = p.user_id GROUP BY u.id ORDER BY u.id;`;
        return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
        if (action === 'login') {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
            const { rows: userRows } = await sql`SELECT * FROM app_users WHERE username = ${username};`;
            if (userRows.length === 0 || !verifyPassword(userRows[0].password_hash, password)) {
                return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
            }
            const userRecord = userRows[0];
            const { rows: permissionRows } = await sql`SELECT permission_name FROM user_permissions WHERE user_id = ${userRecord.id};`;
            const user: User = { id: userRecord.id, firstName: userRecord.firstName, lastName: userRecord.lastName, username: userRecord.username, permissions: permissionRows.map(p => p.permission_name) };
            return res.status(200).json(user);
        }
        
        const client = await sql.connect();
        try {
            await client.sql`BEGIN`;
            if (action === 'import') {
                 for (const user of req.body as any[]) {
                    if (!user.username || !user.password) continue;
                    const hashedPassword = await hashPassword(user.password);
                    const { rows } = await client.sql`INSERT INTO app_users ("firstName", "lastName", username, password_hash) VALUES (${user.firstName}, ${user.lastName}, ${user.username}, ${hashedPassword}) ON CONFLICT (username) DO UPDATE SET "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName", password_hash = EXCLUDED.password_hash RETURNING id;`;
                    const userId = rows[0].id;
                    if (userId && Array.isArray(user.permissions)) {
                        await client.sql`DELETE FROM user_permissions WHERE user_id = ${userId};`;
                        for (const p of user.permissions) if (ALL_PERMISSIONS.some(ap => ap.name === p)) {
                           await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${userId}, ${p}) ON CONFLICT DO NOTHING;`;
                        }
                    }
                }
            } else if (action === 'change_password') {
                const { id, password } = req.body;
                if (!id || !password || password.length < 6) throw new Error('Invalid data');
                await client.sql`UPDATE app_users SET password_hash = ${await hashPassword(password)} WHERE id = ${id};`;
            } else { // Create/Update User
                const { id, firstName, lastName, username, password, permissions } = req.body;
                if (id) {
                    await client.sql`UPDATE app_users SET "firstName"=${firstName}, "lastName"=${lastName}, username=${username} WHERE id=${id};`;
                    if (password) await client.sql`UPDATE app_users SET password_hash=${await hashPassword(password)} WHERE id=${id};`;
                    await client.sql`DELETE FROM user_permissions WHERE user_id=${id};`;
                    for (const p of permissions) await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${id}, ${p});`;
                } else {
                    if (!password) throw new Error("Password required");
                    const { rows } = await client.sql`INSERT INTO app_users ("firstName", "lastName", username, password_hash) VALUES (${firstName}, ${lastName}, ${username}, ${await hashPassword(password)}) RETURNING id;`;
                    for (const p of permissions) await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${rows[0].id}, ${p});`;
                }
            }
            await client.sql`COMMIT`;
            return res.status(200).json({ success: true });
        } catch (error) {
            await client.sql`ROLLBACK`;
            const errorMessage = error instanceof Error ? error.message : 'Unknown';
            return res.status(errorMessage.includes('duplicate key') ? 409 : 500).json({ error: errorMessage.includes('duplicate key') ? 'نام کاربری تکراری است.' : 'Failed to save user data' });
        } finally {
            client.release();
        }
    }
    
    if (req.method === 'DELETE') {
        const id = Number(req.query.id);
        if (!id) return res.status(400).json({ error: 'User ID is required' });
        await sql`DELETE FROM app_users WHERE id = ${id};`;
        return res.status(204).send(null);
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}