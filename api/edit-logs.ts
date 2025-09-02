import { createPool } from '@vercel/postgres';
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
                cel.id,
                cel.commute_log_id,
                cel.personnel_code,
                cm.full_name,
                cel.editor_name,
                cel.edit_timestamp,
                cel.field_name,
                cel.old_value,
                cel.new_value,
                cl.entry_time as record_date
            FROM commute_edit_logs cel
            LEFT JOIN commuting_members cm ON cel.personnel_code = cm.personnel_code
            LEFT JOIN commute_logs cl ON cel.commute_log_id = cl.id
        `;
        
        const conditions: string[] = [];
        const params: (string | number)[] = [];
        let paramIndex = 1;

        // Ensure the original commute log exists for context
        conditions.push('cl.id IS NOT NULL');

        if (startDate && typeof startDate === 'string') {
            conditions.push(`DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') >= $${paramIndex++}`);
            params.push(startDate);
        }
        if (endDate && typeof endDate === 'string') {
            conditions.push(`DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') <= $${paramIndex++}`);
            params.push(endDate);
        }
        if (personnelCode && typeof personnelCode === 'string') {
            conditions.push(`cel.personnel_code = $${paramIndex++}`);
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
        
        query += ` ORDER BY cel.edit_timestamp DESC;`;

        const { rows } = await pool.query(query, params);
        
        return response.status(200).json({ logs: rows });

    } catch (error) {
        console.error('API Error in edit-logs:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return response.status(500).json({ error: 'Failed to fetch edit logs.', details: errorMessage });
    }
}
