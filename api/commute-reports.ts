import { createPool, VercelPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (!process.env.POSTGRES_URL) {
        return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
    }
    const pool = createPool({ connectionString: process.env.POSTGRES_URL });

    if (request.method !== 'GET') {
        response.setHeader('Allow', ['GET']);
        return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
    }

    try {
        const { startDate, endDate, personnelCode, department, position } = request.query;

        let query = `
            SELECT 
                cl.id as log_id,
                cl.personnel_code,
                cm.full_name,
                cm.department,
                cm."position",
                cl.entry_time,
                cl.exit_time,
                cl.guard_name
            FROM commute_logs cl
            LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        `;
        
        const conditions: string[] = [];
        const params: (string | number)[] = [];
        let paramIndex = 1;

        // Ensure entry_time is not null and commuting member exists
        conditions.push('cl.entry_time IS NOT NULL');
        conditions.push('cm.full_name IS NOT NULL');

        if (startDate && typeof startDate === 'string') {
            conditions.push(`DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') >= $${paramIndex++}`);
            params.push(startDate);
        }
        if (endDate && typeof endDate === 'string') {
            conditions.push(`DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') <= $${paramIndex++}`);
            params.push(endDate);
        }
        if (personnelCode && typeof personnelCode === 'string') {
            conditions.push(`cl.personnel_code = $${paramIndex++}`);
            params.push(personnelCode);
        }
        if (department && typeof department === 'string') {
            conditions.push(`cm.department = $${paramIndex++}`);
            params.push(department);
        }
        if (position && typeof position === 'string') {
            conditions.push(`cm."position" = $${paramIndex++}`);
            params.push(position);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY cm.full_name, cl.entry_time DESC;`;

        const { rows } = await pool.query(query, params);
        
        return response.status(200).json({ reports: rows });

    } catch (error) {
        console.error('API Error in commute-reports:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return response.status(500).json({ error: 'Failed to fetch commute reports.', details: errorMessage });
    }
}
