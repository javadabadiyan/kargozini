import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SecurityTrafficLogWithDetails } from '../../types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Ensure personnel table exists as a dependency
    await sql`
        CREATE TABLE IF NOT EXISTS personnel (
            id SERIAL PRIMARY KEY,
            personnel_code VARCHAR(50) UNIQUE NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            father_name VARCHAR(100),
            national_id VARCHAR(20) UNIQUE,
            id_number VARCHAR(20),
            birth_date VARCHAR(50),
            birth_place VARCHAR(100),
            issue_date VARCHAR(50),
            issue_place VARCHAR(100),
            marital_status VARCHAR(50),
            military_status VARCHAR(50),
            job VARCHAR(100),
            "position" VARCHAR(100),
            employment_type VARCHAR(100),
            unit VARCHAR(100),
            service_place VARCHAR(100),
            employment_date VARCHAR(50),
            education_degree VARCHAR(100),
            field_of_study VARCHAR(100),
            status VARCHAR(50)
        );
    `;
    // Create the traffic logs table
    await sql`
        CREATE TABLE IF NOT EXISTS security_traffic_logs (
            id SERIAL PRIMARY KEY,
            personnel_id INT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
            log_date DATE NOT NULL DEFAULT CURRENT_DATE,
            shift VARCHAR(10) NOT NULL,
            entry_time TIMESTAMPTZ NOT NULL,
            exit_time TIMESTAMPTZ,
            UNIQUE(personnel_id, log_date, shift)
        );
    `;
  } catch (error) {
    console.error("Database setup error in /api/traffic:", error);
    if (!res.headersSent) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ error: 'Failed to initialize traffic table', details: errorMessage });
    }
    return;
  }

  // GET: Fetch traffic logs
  if (req.method === 'GET') {
    try {
        const { date } = req.query;
        let rows: SecurityTrafficLogWithDetails[];

        if (date && typeof date === 'string') {
            ({ rows } = await sql<SecurityTrafficLogWithDetails>`
                SELECT 
                    l.*, 
                    p.first_name, p.last_name, p.unit, p.position 
                FROM security_traffic_logs l 
                JOIN personnel p ON l.personnel_id = p.id
                WHERE l.log_date = ${date}
                ORDER BY l.entry_time DESC;
            `);
        } else {
            ({ rows } = await sql<SecurityTrafficLogWithDetails>`
                SELECT 
                    l.*, 
                    p.first_name, p.last_name, p.unit, p.position 
                FROM security_traffic_logs l 
                JOIN personnel p ON l.personnel_id = p.id
                ORDER BY l.entry_time DESC;
            `);
        }
        
        return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to fetch traffic logs', details: errorMessage });
    }
  }

  // POST: Create or update a traffic log
  if (req.method === 'POST') {
    try {
        const { personnel_id, shift, action } = req.body;
        if (!personnel_id || !shift || !action) {
            return res.status(400).json({ error: 'اطلاعات ناقص است.' });
        }

        const today = new Date().toISOString().split('T')[0];

        if (action === 'entry') {
            await sql`
                INSERT INTO security_traffic_logs (personnel_id, shift, entry_time)
                VALUES (${personnel_id}, ${shift}, NOW())
                ON CONFLICT (personnel_id, log_date, shift) DO NOTHING;
            `;
            return res.status(201).json({ message: 'ورود ثبت شد.' });
        }
        
        if (action === 'exit') {
            const { rows } = await sql`
                UPDATE security_traffic_logs 
                SET exit_time = NOW() 
                WHERE personnel_id = ${personnel_id} 
                AND log_date = ${today} 
                AND shift = ${shift} 
                AND exit_time IS NULL
                RETURNING id;
            `;
            if (rows.length === 0) {
                 return res.status(404).json({ error: 'رکورد ورودی برای ثبت خروج یافت نشد.' });
            }
            return res.status(200).json({ message: 'خروج ثبت شد.' });
        }
        
        return res.status(400).json({ error: 'عملیات نامعتبر است.' });

    } catch (error) {
        console.error("Traffic log save error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('unique constraint')) {
            return res.status(409).json({ error: 'یک تردد با این مشخصات برای امروز قبلا ثبت شده است.' });
        }
        return res.status(500).json({ error: 'Failed to save traffic log', details: errorMessage });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}