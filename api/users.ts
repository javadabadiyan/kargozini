import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppUser } from '../types';

async function handleGet(response: VercelResponse, pool: VercelPool) {
  try {
    const { rows } = await pool.sql`
      SELECT id, username, permissions FROM app_users ORDER BY username;
    `;
    return response.status(200).json({ users: rows });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return response.status(500).json({ error: 'Failed to fetch users.', details: errorMessage });
  }
}

async function handlePost(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const usersData = Array.isArray(request.body) ? request.body : [request.body];
  if (usersData.length === 0) {
    return response.status(400).json({ error: 'اطلاعاتی برای افزودن کاربر ارسال نشده است.' });
  }

  const client = await pool.connect();
  try {
    // FIX: Use client.sql for transaction control
    await client.sql`BEGIN`;
    let processedCount = 0;
    for (const user of usersData) {
        if (!user.username || !user.password) continue;
        const permissions = JSON.stringify(user.permissions || {});
        await client.sql`
            INSERT INTO app_users (username, password, permissions)
            VALUES (${user.username}, ${user.password}, ${permissions})
            ON CONFLICT (username) DO UPDATE SET
                password = EXCLUDED.password,
                permissions = EXCLUDED.permissions;
        `;
        processedCount++;
    }
    // FIX: Use client.sql for transaction control
    await client.sql`COMMIT`;
    return response.status(201).json({ message: `${processedCount} کاربر با موفقیت افزوده/به‌روزرسانی شد.` });
  } catch (error) {
    // FIX: Use client.sql for transaction control
    await client.sql`ROLLBACK`;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return response.status(500).json({ error: 'Failed to create/update user.', details: errorMessage });
  } finally {
    client.release();
  }
}

async function handlePut(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id, username, password, permissions } = request.body as AppUser;
  if (!id || !username || !permissions) {
    return response.status(400).json({ error: 'شناسه، نام کاربری و دسترسی‌ها برای ویرایش الزامی است.' });
  }
  
  try {
    if (password) {
      await pool.sql`
        UPDATE app_users SET username = ${username}, password = ${password}, permissions = ${JSON.stringify(permissions)}
        WHERE id = ${id};
      `;
    } else {
      await pool.sql`
        UPDATE app_users SET username = ${username}, permissions = ${JSON.stringify(permissions)}
        WHERE id = ${id};
      `;
    }
    return response.status(200).json({ message: 'کاربر با موفقیت به‌روزرسانی شد.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return response.status(500).json({ error: 'Failed to update user.', details: errorMessage });
  }
}

async function handleDelete(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
  const { id } = request.body;
  if (!id) {
    return response.status(400).json({ error: 'شناسه کاربر برای حذف الزامی است.' });
  }
  
  try {
    // Prevent deleting the last admin
    if (id === 1) { // Assuming admin is always ID 1, a bit risky but simple for this app
        const { rows } = await pool.sql`SELECT COUNT(*) FROM app_users WHERE permissions @> '{"user_management": true}';`;
        if (parseInt(rows[0].count, 10) <= 1) {
            return response.status(403).json({ error: 'نمی‌توانید آخرین کاربر مدیر را حذف کنید.' });
        }
    }

    await pool.sql`DELETE FROM app_users WHERE id = ${id};`;
    return response.status(200).json({ message: 'کاربر با موفقیت حذف شد.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return response.status(500).json({ error: 'Failed to delete user.', details: errorMessage });
  }
}


export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (!process.env.POSTGRES_URL) {
        return response.status(500).json({ error: 'Database connection string not configured.' });
    }
    const pool = createPool({ connectionString: process.env.POSTGRES_URL });

    switch (request.method) {
        case 'GET': return await handleGet(response, pool);
        case 'POST': return await handlePost(request, response, pool);
        case 'PUT': return await handlePut(request, response, pool);
        case 'DELETE': return await handleDelete(request, response, pool);
        default:
            response.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
    }
}