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
// FIX: Corrected invalid syntax for client.sql transaction command. It must be a tagged template literal.
    await client.sql`BEGIN;`;
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
// FIX: Corrected invalid syntax for client.sql transaction command. It must be a tagged template literal.
    await client.sql`COMMIT;`;
    return response.status(201).json({ message: `${