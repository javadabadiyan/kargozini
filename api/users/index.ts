import { createClient } from '@vercel/postgres';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { scrypt, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Buffer } from 'node:buffer';
import type { Personnel, Relative, RelativeWithPersonnel, AccountingCommitmentWithDetails, User, AppSettings, SecurityTrafficLogWithDetails, SecurityMember } from '../../types.js';

// --- UTILS ---
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

function verifyPassword(storedPasswordHash: string, suppliedPassword: string): boolean {
  try {
    const [salt, key] = storedPasswordHash.split(':');
    if (!salt || !key) return false;
    
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = scryptSync(suppliedPassword, salt, 64);
    
    if (keyBuffer.length !== derivedKey.length) return false;
    
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch (e) {
    console.error("Password verification failed:", e);
    return false;
  }
}

const ALL_PERMISSIONS = [
    { name: 'manage_personnel', description: 'افزودن، ویرایش و حذف پرسنل' },
    { name: 'manage_users', description: 'مدیریت کاربران و دسترسی‌های آنها' },
    { name: 'manage_settings', description: 'تغییر تنظیمات کلی برنامه' },
    { name: 'perform_backup', description: 'ایجاد و بازگردانی پشتیبان' },
];

// Helper to manage DB client connection lifecycle
async function withDbClient<T>(operation: (client: ReturnType<typeof createClient>) => Promise<T>): Promise<T> {
  const client = createClient();
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

// --- DATABASE SETUP ---
export async function setupTables() {
    return withDbClient(async (client) => {
        await client.sql`BEGIN`;
        try {
            // Personnel Module Tables
            await client.sql`
                CREATE TABLE IF NOT EXISTS personnel (
                    id SERIAL PRIMARY KEY, personnel_code VARCHAR(50) UNIQUE NOT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, father_name VARCHAR(100), national_id VARCHAR(20) UNIQUE, id_number VARCHAR(20), birth_date VARCHAR(50), birth_place VARCHAR(100), issue_date VARCHAR(50), issue_place VARCHAR(100), marital_status VARCHAR(50), military_status VARCHAR(50), job VARCHAR(100), "position" VARCHAR(100), employment_type VARCHAR(100), unit VARCHAR(100), service_place VARCHAR(100), employment_date VARCHAR(50), education_degree VARCHAR(100), field_of_study VARCHAR(100), status VARCHAR(50)
                );
            `;
            await client.sql`
                CREATE TABLE IF NOT EXISTS relatives (
                    id SERIAL PRIMARY KEY, personnel_id INT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, relation VARCHAR(50), national_id VARCHAR(20), birth_date VARCHAR(50), CONSTRAINT unique_relative_national_id UNIQUE (national_id)
                );
            `;
            await client.sql`
                CREATE TABLE IF NOT EXISTS accounting_commitments (
                    id SERIAL PRIMARY KEY, personnel_id INT REFERENCES personnel(id) ON DELETE SET NULL, addressee VARCHAR(255) NOT NULL DEFAULT 'ریاست محترم', title VARCHAR(255) NOT NULL, letter_date VARCHAR(50) NOT NULL, amount BIGINT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, guarantor_first_name VARCHAR(100), guarantor_last_name VARCHAR(100), borrower_first_name VARCHAR(100), borrower_last_name VARCHAR(100), borrower_father_name VARCHAR(100), borrower_national_id VARCHAR(20)
                );
            `;

            // Admin Module Tables
            await client.sql`CREATE TABLE IF NOT EXISTS app_users (id SERIAL PRIMARY KEY, "firstName" VARCHAR(100) NOT NULL, "lastName" VARCHAR(100) NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, password_hash TEXT NOT NULL);`;
            await client.sql`CREATE TABLE IF NOT EXISTS user_permissions (user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, permission_name VARCHAR(100) NOT NULL, PRIMARY KEY (user_id, permission_name));`;
            
            const defaultPassword = '5221157';
            const hashedPassword = await hashPassword(defaultPassword);
            const { rows: userRows } = await client.sql`
                 INSERT INTO app_users ("firstName", "lastName", username, password_hash) VALUES ('مدیر', 'سیستم', 'ادمین', ${hashedPassword})
                 ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName"
                 RETURNING id;
            `;
            const adminId = userRows[0].id;

            await client.sql`DELETE FROM user_permissions WHERE user_id = ${adminId};`;
            for (const p of ALL_PERMISSIONS) {
                await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${adminId}, ${p.name}) ON CONFLICT DO NOTHING;`;
            }
            
            await client.sql`CREATE TABLE IF NOT EXISTS app_settings (id INT PRIMARY KEY DEFAULT 1, app_name VARCHAR(255) NOT NULL, app_logo TEXT, CONSTRAINT single_row CHECK (id = 1));`;
            await client.sql`INSERT INTO app_settings (id, app_name, app_logo) VALUES (1, 'سیستم جامع کارگزینی', NULL) ON CONFLICT (id) DO NOTHING;`;

            // Security Module Tables
            await client.sql`
                CREATE TABLE IF NOT EXISTS security_traffic_logs (
                    id SERIAL PRIMARY KEY, personnel_id INT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE, log_date DATE NOT NULL DEFAULT CURRENT_DATE, shift VARCHAR(10) NOT NULL, entry_time TIMESTAMPTZ NOT NULL, exit_time TIMESTAMPTZ, UNIQUE(personnel_id, log_date, shift)
                );
            `;
            await client.sql`CREATE TABLE IF NOT EXISTS security_members (id SERIAL PRIMARY KEY, personnel_id INT NOT NULL UNIQUE REFERENCES personnel(id) ON DELETE CASCADE);`;

            await client.sql`COMMIT`;
        } catch (e) {
            await client.sql`ROLLBACK`;
            throw e;
        }
    });
}

// --- Handler for PERSONNEL ---
async function handlePersonnelLogic(req: ExpressRequest, res: ExpressResponse) {
    return withDbClient(async (client) => {
        if (req.method === 'GET') {
            const { rows } = await client.sql<Personnel>`SELECT * FROM personnel ORDER BY id DESC;`;
            return res.status(200).json(rows);
        }
        if (req.method === 'POST') {
            if (req.query.action === 'import') {
                const personnelList = req.body as Omit<Personnel, 'id'>[];
                await client.sql`BEGIN`;
                try {
                    for (const p of personnelList) {
                        await client.sql`
                            INSERT INTO personnel (personnel_code, first_name, last_name, father_name, national_id, id_number, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job, "position", employment_type, unit, service_place, employment_date, education_degree, field_of_study, status) 
                            VALUES (${p.personnel_code}, ${p.first_name}, ${p.last_name}, ${p.father_name}, ${p.national_id}, ${p.id_number}, ${p.birth_date}, ${p.birth_place}, ${p.issue_date}, ${p.issue_place}, ${p.marital_status}, ${p.military_status}, ${p.job}, ${p.position}, ${p.employment_type}, ${p.unit}, ${p.service_place}, ${p.employment_date}, ${p.education_degree}, ${p.field_of_study}, ${p.status})
                            ON CONFLICT (personnel_code) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, father_name = EXCLUDED.father_name, national_id = EXCLUDED.national_id, id_number = EXCLUDED.id_number, birth_date = EXCLUDED.birth_date, birth_place = EXCLUDED.birth_place, issue_date = EXCLUDED.issue_date, issue_place = EXCLUDED.issue_place, marital_status = EXCLUDED.marital_status, military_status = EXCLUDED.military_status, job = EXCLUDED.job, "position" = EXCLUDED."position", employment_type = EXCLUDED.employment_type, unit = EXCLUDED.unit, service_place = EXCLUDED.service_place, employment_date = EXCLUDED.employment_date, education_degree = EXCLUDED.education_degree, field_of_study = EXCLUDED.field_of_study, status = EXCLUDED.status;
                        `;
                    }
                    await client.sql`COMMIT`;
                    return res.status(200).json({ message: 'Import successful' });
                } catch(e) {
                    await client.sql`ROLLBACK`;
                    throw e;
                }
            }
            const { id, ...data } = req.body;
            if (id) {
                const { rows } = await client.sql<Personnel>`
                    UPDATE personnel SET personnel_code=${data.personnel_code}, first_name=${data.first_name}, last_name=${data.last_name}, father_name=${data.father_name}, national_id=${data.national_id}, id_number=${data.id_number}, birth_date=${data.birth_date}, birth_place=${data.birth_place}, issue_date=${data.issue_date}, issue_place=${data.issue_place}, marital_status=${data.marital_status}, military_status=${data.military_status}, job=${data.job}, "position"=${data.position}, employment_type=${data.employment_type}, unit=${data.unit}, service_place=${data.service_place}, employment_date=${data.employment_date}, education_degree=${data.education_degree}, field_of_study=${data.field_of_study}, status=${data.status}
                    WHERE id = ${id} RETURNING *;
                `;
                return res.status(200).json(rows[0]);
            } else {
                const { rows } = await client.sql<Personnel>`
                    INSERT INTO personnel (personnel_code, first_name, last_name, father_name, national_id, id_number, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job, "position", employment_type, unit, service_place, employment_date, education_degree, field_of_study, status) 
                    VALUES (${data.personnel_code}, ${data.first_name}, ${data.last_name}, ${data.father_name}, ${data.national_id}, ${data.id_number}, ${data.birth_date}, ${data.birth_place}, ${data.issue_date}, ${data.issue_place}, ${data.marital_status}, ${data.military_status}, ${data.job}, ${data.position}, ${data.employment_type}, ${data.unit}, ${data.service_place}, ${data.employment_date}, ${data.education_degree}, ${data.field_of_study}, ${data.status})
                    RETURNING *;
                `;
                return res.status(201).json(rows[0]);
            }
        }
        if (req.method === 'DELETE') {
            if (req.query.action === 'delete_all') {
                await client.sql`TRUNCATE TABLE personnel RESTART IDENTITY CASCADE;`;
                return res.status(204).send(null);
            }
            const id = Number(req.query.id);
            if (!id) return res.status(400).json({ error: 'Personnel ID is required' });
            await client.sql`DELETE FROM personnel WHERE id = ${id};`;
            return res.status(204).send(null);
        }
    });
}

async function handleRelatives(req: ExpressRequest, res: ExpressResponse) {
    return withDbClient(async (client) => {
        if (req.method === 'GET') {
            const { rows } = await client.sql<RelativeWithPersonnel>`
                SELECT r.*, p.first_name as personnel_first_name, p.last_name as personnel_last_name, p.personnel_code 
                FROM relatives r JOIN personnel p ON r.personnel_id = p.id ORDER BY r.id DESC;
            `;
            return res.status(200).json(rows);
        }
        if (req.method === 'POST') {
            await client.sql`BEGIN`;
            try {
                if (req.query.action === 'import') {
                    for (const r of req.body as any[]) {
                        if (!r.personnel_code) continue;
                        const { rows } = await client.sql`SELECT id FROM personnel WHERE personnel_code = ${r.personnel_code}`;
                        if (rows.length > 0) {
                            await client.sql`
                                INSERT INTO relatives (personnel_id, first_name, last_name, relation, national_id, birth_date) VALUES (${rows[0].id}, ${r.first_name}, ${r.last_name}, ${r.relation}, ${r.national_id}, ${r.birth_date})
                                ON CONFLICT (national_id) WHERE national_id IS NOT NULL AND national_id <> '' DO UPDATE SET personnel_id = EXCLUDED.personnel_id, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, relation = EXCLUDED.relation, birth_date = EXCLUDED.birth_date;
                            `;
                        }
                    }
                } else {
                    const { id, personnel_id, first_name, last_name, relation, national_id, birth_date } = req.body as Relative;
                    if (!personnel_id || !first_name || !last_name) return res.status(400).json({ error: 'Missing required fields' });
                    if (id) {
                        await client.sql`UPDATE relatives SET personnel_id=${personnel_id}, first_name=${first_name}, last_name=${last_name}, relation=${relation}, national_id=${national_id}, birth_date=${birth_date} WHERE id=${id}`;
                    } else {
                        await client.sql`INSERT INTO relatives (personnel_id, first_name, last_name, relation, national_id, birth_date) VALUES (${personnel_id}, ${first_name}, ${last_name}, ${relation}, ${national_id}, ${birth_date})`;
                    }
                }
                await client.sql`COMMIT`;
                return res.status(200).json({ success: true });
            } catch (e) {
                await client.sql`ROLLBACK`;
                throw e;
            }
        }
        if (req.method === 'DELETE') {
            const id = Number(req.query.id);
            if (!id) return res.status(400).json({ error: 'Relative ID is required' });
            await client.sql`DELETE FROM relatives WHERE id = ${id};`;
            return res.status(204).send(null);
        }
    });
}

async function handleCommitments(req: ExpressRequest, res: ExpressResponse) {
    return withDbClient(async (client) => {
        if (req.method === 'GET') {
            const { rows } = await client.sql<AccountingCommitmentWithDetails>`
                SELECT c.*, COALESCE(p1.first_name, c.borrower_first_name, '') as personnel_first_name, COALESCE(p1.last_name, c.borrower_last_name, '') as personnel_last_name, p1.personnel_code
                FROM accounting_commitments c LEFT JOIN personnel p1 ON c.personnel_id = p1.id
                ORDER BY c.created_at DESC;
            `;
            return res.status(200).json(rows);
        }
        if (req.method === 'POST') {
            const { id, personnel_id, addressee, title, letter_date, amount, body, guarantor_first_name, guarantor_last_name, borrower_first_name, borrower_last_name, borrower_father_name, borrower_national_id } = req.body;
            if (!addressee || !title || !letter_date || amount == null || !body || !guarantor_first_name || !guarantor_last_name || (!personnel_id && (!borrower_first_name || !borrower_last_name))) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            if (id) {
                await client.sql`
                    UPDATE accounting_commitments SET personnel_id = ${personnel_id || null}, addressee = ${addressee}, title = ${title}, letter_date = ${letter_date}, amount = ${amount}, body = ${body}, guarantor_first_name = ${guarantor_first_name}, guarantor_last_name = ${guarantor_last_name}, borrower_first_name = ${borrower_first_name || null}, borrower_last_name = ${borrower_last_name || null}, borrower_father_name = ${borrower_father_name || null}, borrower_national_id = ${borrower_national_id || null}
                    WHERE id = ${id} RETURNING *;
                `;
            } else {
                await client.sql`
                    INSERT INTO accounting_commitments (personnel_id, addressee, title, letter_date, amount, body, guarantor_first_name, guarantor_last_name, borrower_first_name, borrower_last_name, borrower_father_name, borrower_national_id)
                    VALUES (${personnel_id || null}, ${addressee}, ${title}, ${letter_date}, ${amount}, ${body}, ${guarantor_first_name}, ${guarantor_last_name}, ${borrower_first_name || null}, ${borrower_last_name || null}, ${borrower_father_name || null}, ${borrower_national_id || null})
                    RETURNING *;
                `;
            }
            return res.status(id ? 200 : 201).json({ success: true });
        }
        if (req.method === 'DELETE') {
            const id = Number(req.query.id);
            if (!id) return res.status(400).json({ error: 'Commitment ID is required' });
            await client.sql`DELETE FROM accounting_commitments WHERE id = ${id};`;
            return res.status(204).send(null);
        }
    });
}

async function handlePersonnelModule(req: ExpressRequest, res: ExpressResponse) {
    const { type } = req.query;
    if (type === 'relatives') {
        return await handleRelatives(req, res);
    } else if (type === 'commitments') {
        return await handleCommitments(req, res);
    } else {
        return await handlePersonnelLogic(req, res);
    }
}

// --- Handler for ADMIN ---
async function handleSettings(req: ExpressRequest, res: ExpressResponse) {
    return withDbClient(async (client) => {
        if (req.method === 'GET') {
            const { rows } = await client.sql<AppSettings>`SELECT app_name, app_logo FROM app_settings WHERE id = 1;`;
            return res.status(rows.length > 0 ? 200 : 404).json(rows[0] || { error: 'Settings not found' });
        }
        if (req.method === 'POST') {
            const { app_name, app_logo } = req.body as AppSettings;
            if (!app_name) return res.status(400).json({ error: 'App name is required' });
            const { rows } = await client.sql<AppSettings>`UPDATE app_settings SET app_name = ${app_name}, app_logo = ${app_logo} WHERE id = 1 RETURNING app_name, app_logo;`;
            return res.status(200).json(rows[0]);
        }
    });
}

async function handleBackup(req: ExpressRequest, res: ExpressResponse) {
    return withDbClient(async (client) => {
        const scope = req.query.scope as string;
        const backupData: any = {};
        if (scope === 'personnel' || scope === 'all') {
            const { rows } = await client.sql`SELECT * FROM personnel;`;
            backupData.personnel = rows;
        }
        if (scope === 'users' || scope === 'all') {
            const { rows: users } = await client.sql`SELECT id, "firstName", "lastName", username FROM app_users;`;
            const { rows: permissions } = await client.sql`SELECT * FROM user_permissions;`;
            backupData.users = users;
            backupData.user_permissions = permissions;
        }
        return res.status(200).json(backupData);
    });
}

async function handleRestore(req: ExpressRequest, res: ExpressResponse) {
    return withDbClient(async (client) => {
        await client.sql`BEGIN`;
        try {
            const { personnel, users, user_permissions } = req.body;
            if (Array.isArray(personnel)) {
                await client.sql`TRUNCATE personnel RESTART IDENTITY CASCADE;`;
                for (const p of personnel) {
                     await client.sql`INSERT INTO personnel (id, personnel_code, first_name, last_name, father_name, national_id, id_number, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job, "position", employment_type, unit, service_place, employment_date, education_degree, field_of_study, status) VALUES (${p.id}, ${p.personnel_code}, ${p.first_name}, ${p.last_name}, ${p.father_name}, ${p.national_id}, ${p.id_number}, ${p.birth_date}, ${p.birth_place}, ${p.issue_date}, ${p.issue_place}, ${p.marital_status}, ${p.military_status}, ${p.job}, ${p.position}, ${p.employment_type}, ${p.unit}, ${p.service_place}, ${p.employment_date}, ${p.education_degree}, ${p.field_of_study}, ${p.status});`;
                }
            }
            if (Array.isArray(users)) {
                await client.sql`TRUNCATE app_users RESTART IDENTITY CASCADE;`;
                const hashedPassword = await hashPassword('5221157'); // Reset password on restore
                for (const u of users) {
                     await client.sql`INSERT INTO app_users (id, "firstName", "lastName", username, password_hash) VALUES (${u.id}, ${u.firstName}, ${u.lastName}, ${u.username}, ${hashedPassword});`;
                }
            }
            if (Array.isArray(user_permissions)) {
                await client.sql`TRUNCATE user_permissions;`; // No RESTART IDENTITY needed for composite key table
                for (const up of user_permissions) {
                     await client.sql`INSERT INTO user_permissions (user_id, permission_name) VALUES (${up.user_id}, ${up.permission_name});`;
                }
            }
            await client.sql`COMMIT`;
            return res.status(200).json({ message: 'پشتیبان با موفقیت بازگردانی شد.' });
        } catch (e) {
            await client.sql`ROLLBACK`;
            throw e;
        }
    });
}

async function handleAdminModule(req: ExpressRequest, res: ExpressResponse) {
    const action = req.query.action as string;

    if (action === 'settings') return await handleSettings(req, res);
    if (action === 'backup') return await handleBackup(req, res);
    if (req.method === 'POST' && action === 'restore') return await handleRestore(req, res);

    return withDbClient(async (client) => {
        if (req.method === 'GET') {
            const { rows } = await client.sql`SELECT u.id, u."firstName", u."lastName", u.username, COALESCE(json_agg(p.permission_name) FILTER (WHERE p.permission_name IS NOT NULL), '[]') as permissions FROM app_users u LEFT JOIN user_permissions p ON u.id = p.user_id GROUP BY u.id ORDER BY u.id;`;
            return res.status(200).json(rows);
        }

        if (req.method === 'POST') {
            if (action === 'login') {
                const { username, password } = req.body;
                if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
                const { rows: userRows } = await client.sql`SELECT * FROM app_users WHERE username = ${username};`;
                if (userRows.length === 0 || !verifyPassword(userRows[0].password_hash, password)) {
                    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
                }
                const userRecord = userRows[0];
                const { rows: permissionRows } = await client.sql`SELECT permission_name FROM user_permissions WHERE user_id = ${userRecord.id};`;
                const user: User = { id: userRecord.id, firstName: userRecord.firstName, lastName: userRecord.lastName, username: userRecord.username, permissions: permissionRows.map(p => p.permission_name) };
                return res.status(200).json(user);
            }
            
            await client.sql`BEGIN`;
            try {
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
                throw error;
            }
        }
        
        if (req.method === 'DELETE') {
            const id = Number(req.query.id);
            if (!id) return res.status(400).json({ error: 'User ID is required' });
            await client.sql`DELETE FROM app_users WHERE id = ${id};`;
            return res.status(204).send(null);
        }
    });
}

// --- Handler for SECURITY ---
async function handleTrafficLogs(req: ExpressRequest, res: ExpressResponse) {
    return withDbClient(async (client) => {
        if (req.method === 'GET') {
            const { date } = req.query;
            let rows: SecurityTrafficLogWithDetails[];
            if (date && typeof date === 'string') {
                ({ rows } = await client.sql<SecurityTrafficLogWithDetails>`
                    SELECT l.*, p.first_name, p.last_name, p.unit, p.position 
                    FROM security_traffic_logs l JOIN personnel p ON l.personnel_id = p.id
                    WHERE l.log_date = ${date} ORDER BY l.entry_time DESC;
                `);
            } else {
                ({ rows } = await client.sql<SecurityTrafficLogWithDetails>`
                    SELECT l.*, p.first_name, p.last_name, p.unit, p.position 
                    FROM security_traffic_logs l JOIN personnel p ON l.personnel_id = p.id
                    ORDER BY l.entry_time DESC;
                `);
            }
            return res.status(200).json(rows);
        }
        
        if (req.method === 'POST') {
            const { personnel_id, shift, action } = req.body;
            if (!personnel_id || !shift || !action) {
                return res.status(400).json({ error: 'اطلاعات ناقص است.' });
            }
            const today = new Date().toISOString().split('T')[0];

            if (action === 'entry') {
                await client.sql`
                    INSERT INTO security_traffic_logs (personnel_id, shift, entry_time) VALUES (${personnel_id}, ${shift}, NOW())
                    ON CONFLICT (personnel_id, log_date, shift) DO NOTHING;
                `;
                return res.status(201).json({ message: 'ورود ثبت شد.' });
            }
            
            if (action === 'exit') {
                const { rows } = await client.sql`
                    UPDATE security_traffic_logs SET exit_time = NOW() 
                    WHERE personnel_id = ${personnel_id} AND log_date = ${today} AND shift = ${shift} AND exit_time IS NULL
                    RETURNING id;
                `;
                if (rows.length === 0) {
                     return res.status(404).json({ error: 'رکورد ورودی برای ثبت خروج یافت نشد.' });
                }
                return res.status(200).json({ message: 'خروج ثبت شد.' });
            }
            return res.status(400).json({ error: 'عملیات نامعتبر است.' });
        }
    });
}

async function handleSecurityMembers(req: ExpressRequest, res: ExpressResponse) {
    return withDbClient(async (client) => {
        if (req.method === 'GET') {
            const { rows } = await client.sql<SecurityMember>`
                SELECT p.id, p.first_name, p.last_name, p.personnel_code, p.unit, p.position
                FROM security_members sm JOIN personnel p ON sm.personnel_id = p.id
                ORDER BY p.last_name, p.first_name;
            `;
            return res.status(200).json(rows);
        }

        if (req.method === 'POST') {
            await client.sql`BEGIN`;
            try {
                if (req.query.action === 'import') {
                    const personnelCodes = req.body as string[];
                    if (!Array.isArray(personnelCodes)) throw new Error('Invalid import data: Expected an array of personnel codes.');
                    for (const code of personnelCodes) {
                        const { rows } = await client.sql`SELECT id FROM personnel WHERE personnel_code = ${code};`;
                        if (rows.length > 0) {
                            await client.sql`INSERT INTO security_members (personnel_id) VALUES (${rows[0].id}) ON CONFLICT (personnel_id) DO NOTHING;`;
                        }
                    }
                } else {
                    const { personnel_id } = req.body;
                    if (!personnel_id) return res.status(400).json({ error: 'Personnel ID is required' });
                    await client.sql`INSERT INTO security_members (personnel_id) VALUES (${personnel_id}) ON CONFLICT (personnel_id) DO NOTHING;`;
                }
                await client.sql`COMMIT`;
                return res.status(201).json({ success: true });
            } catch (error) {
                await client.sql`ROLLBACK`;
                throw error;
            }
        }

        if (req.method === 'DELETE') {
            if (req.query.action === 'delete_all') {
                await client.sql`TRUNCATE TABLE security_members;`;
                return res.status(204).send(null);
            } else {
                const id = Number(req.query.id);
                if (!id) return res.status(400).json({ error: 'Personnel ID is required' });
                await client.sql`DELETE FROM security_members WHERE personnel_id = ${id};`;
                return res.status(204).send(null);
            }
        }
    });
}

async function handleSecurityModule(req: ExpressRequest, res: ExpressResponse) {
  const { type } = req.query;
  if (type === 'members') {
    return await handleSecurityMembers(req, res);
  } else { // Default to 'logs'
    return await handleTrafficLogs(req, res);
  }
}

// --- MAIN HANDLER ---
export default async function handler(req: ExpressRequest, res: ExpressResponse) {
    const { module } = req.query;
    try {
        if (module === 'admin') {
            return await handleAdminModule(req, res);
        } else if (module === 'security') {
            return await handleSecurityModule(req, res);
        } else { // Default to 'personnel'
            return await handlePersonnelModule(req, res);
        }
    } catch (error) {
        console.error(`Error in module=${String(module) || 'personnel'}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        let statusCode = 500;
        let publicError = 'Failed to process request';
        if (errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
            statusCode = 409; // Conflict
            publicError = 'کد ملی یا کد پرسنلی یا نام کاربری وارد شده تکراری است.';
        }
        return res.status(statusCode).json({ error: publicError, details: errorMessage });
    }
}