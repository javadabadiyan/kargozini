import { createPool, VercelPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') {
        response.setHeader('Allow', ['GET']);
        return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
    }

    if (!process.env.POSTGRES_URL) {
        return response.status(500).json({
            error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
        });
    }

    const pool = createPool({
        connectionString: process.env.POSTGRES_URL,
    });

    try {
        const { startDate, endDate, personnelCode, department } = request.query;

        if (!startDate || !endDate) {
            return response.status(400).json({ error: 'بازه زمانی (startDate و endDate) الزامی است.' });
        }

        let query = `
            SELECT 
                cl.id, 
                cl.personnel_code, 
                cm.full_name,
                cm.department,
                cm."position", 
                cl.guard_name, 
                cl.entry_time, 
                cl.exit_time 
            FROM commute_logs cl
            LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
            WHERE (cl.entry_time AT TIME ZONE 'Asia/Tehran')::date >= $1
              AND (cl.entry_time AT TIME ZONE 'Asia/Tehran')::date <= $2
        `;
        
        const params: (string | undefined)[] = [startDate as string, endDate as string];
        let paramIndex = 3;

        if (personnelCode && personnelCode !== 'all') {
            query += ` AND cl.personnel_code = $${paramIndex++}`;
            params.push(personnelCode as string);
        }

        if (department && department !== 'all') {
            query += ` AND cm.department = $${paramIndex++}`;
            params.push(department as string);
        }
        
        query += ' ORDER BY cl.entry_time DESC;';

        const result = await pool.query(query, params);

        return response.status(200).json({ reports: result.rows });

    } catch (error) {
        console.error('Database GET for commute_reports failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return response.status(500).json({ error: 'Failed to fetch commute reports data.', details: errorMessage });
    }
}
