import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { User } from '../../types';

const scryptAsync = promisify(scrypt);

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