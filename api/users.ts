import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppUser } from '../types';

async function handleGetUsers(response: VercelResponse, pool: VercelPool) {
  try {
    const { rows } = await pool.sql`
      SELECT id, username, permissions, full_name, national_id FROM app_users ORDER BY username;
    `;
    return response.status(200).json({ users: rows });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return response.status(500).json({ error: 'Failed to fetch users.', details: errorMessage });
  }
}

async function handlePostUsers(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const usersData = Array.isArray(request.body) ? request.body : [request.body];
  if (usersData.length === 0) {
    return response.status(400).json({ error: 'اطلاعاتی برای افزودن کاربر ارسال نشده است.' });
  }

  const client = await pool.connect();
  try {
    // FIX: Corrected invalid syntax for client.sql transaction command. It must be a plain query.
    await client.query('BEGIN');
    let processedCount = 0;
    for (const user of usersData) {
        if (!user.username || !user.password) continue;
        const permissions = JSON.stringify(user.permissions || {});
        await client.sql`
            INSERT INTO app_users (username, password, permissions, full_name, national_id)
            VALUES (${user.username}, ${user.password}, ${permissions}, ${user.full_name || null}, ${user.national_id || null})
            ON CONFLICT (username) DO UPDATE SET
                password = EXCLUDED.password,
                permissions = EXCLUDED.permissions,
                full_name = EXCLUDED.full_name,
                national_id = EXCLUDED.national_id;
        `;
        processedCount++;
    }
    // FIX: Corrected invalid syntax for client.sql transaction command. It must be a plain query.
    await client.query('COMMIT');
    return response.status(201).json({ message: `${processedCount} کاربر با موفقیت افزوده/به‌روزرسانی شد.` });
  } catch (error) {
    // FIX: Corrected invalid syntax for client.sql transaction command. It must be a plain query.
    await client.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return response.status(500).json({ error: 'Failed to create/update user.', details: errorMessage });
  } finally {
    client.release();
  }
}

async function handlePutUsers(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id, username, password, permissions, full_name, national_id } = request.body as AppUser;
  if (!id || !username || !permissions) {
    return response.status(400).json({ error: 'شناسه، نام کاربری و دسترسی‌ها برای ویرایش الزامی است.' });
  }
  
  try {
    if (password) {
      await pool.sql`
        UPDATE app_users 
        SET username = ${username}, password = ${password}, permissions = ${JSON.stringify(permissions)}, full_name = ${full_name}, national_id = ${national_id}
        WHERE id = ${id};
      `;
    } else {
      await pool.sql`
        UPDATE app_users 
        SET username = ${username}, permissions = ${JSON.stringify(permissions)}, full_name = ${full_name}, national_id = ${national_id}
        WHERE id = ${id};
      `;
    }
    return response.status(200).json({ message: 'کاربر با موفقیت به‌روزرسانی شد.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return response.status(500).json({ error: 'Failed to update user.', details: errorMessage });
  }
}

async function handleDeleteUsers(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id } = request.body;
  if (!id) {
    return response.status(400).json({ error: 'شناسه کاربر برای حذف الزامی است.' });
  }
  
  try {
    // Prevent deleting the user with ID 1, often the main admin
    if (id === 1) {
      return response.status(403).json({ error: 'نمی‌توانید کاربر اصلی سیستم را حذف کنید.' });
    }

    await pool.sql`DELETE FROM app_users WHERE id = ${id};`;
    return response.status(200).json({ message: 'کاربر با موفقیت حذف شد.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return response.status(500).json({ error: 'Failed to delete user.', details: errorMessage });
  }
}

async function handleGetRoles(response: VercelResponse, pool: VercelPool) {
    try {
        const { rows } = await pool.sql`SELECT * FROM permission_roles ORDER BY role_name;`;
        return response.status(200).json({ roles: rows });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to fetch roles.', details: errorMessage });
    }
}

async function handlePostRoles(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { role_name, permissions } = request.body;
    if (!role_name || !permissions) {
        return response.status(400).json({ error: 'نام گروه و دسترسی‌ها الزامی است.' });
    }
    try {
        await pool.sql`
            INSERT INTO permission_roles (role_name, permissions)
            VALUES (${role_name}, ${JSON.stringify(permissions)});
        `;
        return response.status(201).json({ message: 'گروه دسترسی جدید با موفقیت ایجاد شد.' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('unique constraint')) {
            return response.status(409).json({ error: 'گروهی با این نام از قبل وجود دارد.' });
        }
        return response.status(500).json({ error: 'Failed to create role.', details: errorMessage });
    }
}

async function handlePutRoles(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { id, role_name, permissions } = request.body;
    if (!id || !role_name || !permissions) {
        return response.status(400).json({ error: 'شناسه، نام گروه و دسترسی‌ها الزامی است.' });
    }
    try {
        await pool.sql`
            UPDATE permission_roles
            SET role_name = ${role_name}, permissions = ${JSON.stringify(permissions)}
            WHERE id = ${id};
        `;
        return response.status(200).json({ message: 'گروه دسترسی با موفقیت به‌روزرسانی شد.' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('unique constraint')) {
            return response.status(409).json({ error: 'گروهی با این نام از قبل وجود دارد.' });
        }
        return response.status(500).json({ error: 'Failed to update role.', details: errorMessage });
    }
}

async function handleDeleteRoles(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { id } = request.body;
    if (!id) {
        return response.status(400).json({ error: 'شناسه گروه برای حذف الزامی است.' });
    }
    try {
        await pool.sql`DELETE FROM permission_roles WHERE id = ${id};`;
        return response.status(200).json({ message: 'گروه دسترسی با موفقیت حذف شد.' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to delete role.', details: errorMessage });
    }
}


export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (!process.env.POSTGRES_URL) {
        return response.status(500).json({ error: 'Database connection string not configured.' });
    }
    const pool = createPool({ connectionString: process.env.POSTGRES_URL });
    const { entity } = request.query;

    if (entity === 'roles') {
        switch (request.method) {
            case 'GET': return await handleGetRoles(response, pool);
            case 'POST': return await handlePostRoles(request, response, pool);
            case 'PUT': return await handlePutRoles(request, response, pool);
            case 'DELETE': return await handleDeleteRoles(request, response, pool);
            default:
                response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
        }
    } else { // Default to users
        switch (request.method) {
            case 'GET': return await handleGetUsers(response, pool);
            case 'POST': return await handlePostUsers(request, response, pool);
            case 'PUT': return await handlePutUsers(request, response, pool);
            case 'DELETE': return await handleDeleteUsers(request, response, pool);
            default:
                response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
        }
    }
}