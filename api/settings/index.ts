import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppSettings } from '../../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
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