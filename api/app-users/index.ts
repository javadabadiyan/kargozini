import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Buffer } from 'node:buffer';
import type { User } from '../../types';

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

async function setupTables() {
    const client = await sql.connect();
    try {
        await client.sql`BEGIN`;
        // Ensure tables exist
        await client.sql`
            CREATE TABLE IF NOT EXISTS app_users (
                id SERIAL PRIMARY KEY,
                "firstName" VARCHAR(100) NOT NULL,
                "lastName" VARCHAR(100) NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            );
        `;
        await client.sql`
            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                permission_name VARCHAR(100) NOT NULL,
                PRIMARY KEY (user_id, permission_name)
            );
        `;

        // Upsert the admin user and reset their password to the default.
        // This ensures the admin account is always available with the password defined in the code.
        const defaultPassword = '5221157';
        const hashedPassword = await hashPassword(defaultPassword);

        const { rows: userRows } = await client.sql`
             INSERT INTO app_users ("firstName", "lastName", username, password_hash)
             VALUES ('مدیر', 'سیستم', 'ادمین', ${hashedPassword})
             ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                "firstName" = EXCLUDED."firstName",
                "lastName" = EXCLUDED."lastName"
             RETURNING id;
        `;
        const adminId = userRows[0].id;

        // Ensure admin has all permissions by clearing and re-adding them.
        const allPermissions = ['manage_personnel', 'manage_users', 'manage_settings', 'perform_backup'];
        
        await client.sql`DELETE FROM user_permissions WHERE user_id = ${adminId};`;
        for (const p of allPermissions) {
            await client.sql`
                INSERT INTO user_permissions (user_id, permission_name) VALUES (${adminId}, ${p}) ON CONFLICT DO NOTHING;
            `;
        }

        await client.sql`COMMIT`;
    } catch (e) {
        await client.sql`ROLLBACK`;
        throw e; // Re-throw error to be caught by handler
    } finally {
        client.release();
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        await setupTables();
    } catch (e) {
        console.error("Table setup failed:", e);
        return res.status(500).json({ error: 'Database initialization failed' });
    }

    // GET: Fetch all users with their permissions
    if (req.method === 'GET') {
        try {
            const { rows } = await sql`
                SELECT u.id, u."firstName", u."lastName", u.username, 
                       COALESCE(json_agg(p.permission_name) FILTER (WHERE p.permission_name IS NOT NULL), '[]') as permissions
                FROM app_users u
                LEFT JOIN user_permissions p ON u.id = p.user_id
                GROUP BY u.id
                ORDER BY u.id;
            `;
            return res.status(200).json(rows);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
    }

    // POST: Create, Update, Import, or Change Password
    if (req.method === 'POST') {
        const client = await sql.connect();
        try {
            await client.sql`BEGIN`;

            // Bulk Import
            if (req.query.action === 'import') {
                const users = req.body as any[];
                for (const user of users) {
                    if (!user.username || !user.password || !user.firstName || !user.lastName) continue;
                    const hashedPassword = await hashPassword(user.password);
                    
                    const { rows } = await client.sql`
                        INSERT INTO app_users ("firstName", "lastName", username, password_hash)
                         VALUES (${user.firstName}, ${user.lastName}, ${user.username}, ${hashedPassword})
                         ON CONFLICT (username) DO UPDATE SET
                           "firstName" = EXCLUDED."firstName",
                           "lastName" = EXCLUDED."lastName",
                           password_hash = EXCLUDED.password_hash
                         RETURNING id;
                    `;
                    const userId = rows[0].id;

                    if (userId && Array.isArray(user.permissions)) {
                        await client.sql`DELETE FROM user_permissions WHERE user_id = ${userId};`;
                        for (const permissionName of user.permissions) {
                            const isValidPermission = ALL_PERMISSIONS.some(p => p.name === permissionName);
                            if (isValidPermission) {
                                await client.sql`
                                    INSERT INTO user_permissions (user_id, permission_name) VALUES (${userId}, ${permissionName}) ON CONFLICT DO NOTHING;
                                `;
                            }
                        }
                    }
                }
            } 
            // Change Password
            else if (req.query.action === 'change_password') {
                const { id, password } = req.body;
                if (!id || !password || password.length < 6) {
                    throw new Error('Invalid data for password change');
                }
                const hashedPassword = await hashPassword(password);
                await client.sql`UPDATE app_users SET password_hash = ${hashedPassword} WHERE id = ${id};`;
            }
            // Create/Update User
            else {
                const { id, firstName, lastName, username, password, permissions } = req.body;
                if (id) { // Update
                    await client.sql`UPDATE app_users SET "firstName"=${firstName}, "lastName"=${lastName}, username=${username} WHERE id=${id};`;
                    if (password) { // Optionally update password
                        const hashedPassword = await hashPassword(password);
                        await client.sql`UPDATE app_users SET password_hash=${hashedPassword} WHERE id=${id};`;
                    }
                    await client.sql`DELETE FROM user_permissions WHERE user_id=${id};`;
                    for (const p of permissions) {
                        await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${id}, ${p});`;
                    }
                } else { // Create
                    if (!password) throw new Error("Password is required for new users");
                    const hashedPassword = await hashPassword(password);
                    const { rows } = await client.sql`INSERT INTO app_users ("firstName", "lastName", username, password_hash) VALUES (${firstName}, ${lastName}, ${username}, ${hashedPassword}) RETURNING id;`;
                    const newId = rows[0].id;
                    for (const p of permissions) {
                        await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${newId}, ${p});`;
                    }
                }
            }

            await client.sql`COMMIT`;
            return res.status(200).json({ success: true });
        } catch (error) {
            await client.sql`ROLLBACK`;
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
             if (errorMessage.includes('duplicate key value violates unique constraint')) {
                return res.status(409).json({ error: 'نام کاربری از قبل وجود دارد.' });
            }
            return res.status(500).json({ error: 'Failed to save user data', details: errorMessage });
        } finally {
            client.release();
        }
    }
    
    // DELETE: Delete a user
    if (req.method === 'DELETE') {
        try {
            const id = Number(req.query.id);
            if (!id) return res.status(400).json({ error: 'User ID is required' });
            await sql`DELETE FROM app_users WHERE id = ${id};`;
            return res.status(204).send(null);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to delete user' });
        }
    }


    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}