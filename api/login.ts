import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }

  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
  }
  
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });
  
  try {
    const { username, password } = request.body;

    if (!username || !password) {
      return response.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    const { rows } = await pool.sql`
      SELECT id, username, password, permissions, full_name 
      FROM app_users 
      WHERE username = ${username};
    `;

    if (rows.length === 0) {
      return response.status(401).json({ error: 'نام کاربری یافت نشد.' });
    }

    const user = rows[0];

    // Note: This is plaintext password comparison. In a production system,
    // you MUST use a secure hashing algorithm like bcrypt.
    if (user.password !== password) {
      return response.status(401).json({ error: 'رمز عبور اشتباه است.' });
    }
    
    // Do not send password back to the client
    const { password: _, ...userToSend } = user;

    return response.status(200).json({ success: true, user: userToSend });

  } catch (error) {
    console.error('Login API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'خطای داخلی سرور.', details: errorMessage });
  }
}