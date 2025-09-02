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
        const todayInTehran = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tehran',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date());

        const searchDate = (request.query.date as string) || todayInTehran;

        const { rows } = await pool.sql`
            SELECT 
                cl.id as log_id,
                cm.full_name,
                cl.personnel_code,
                cm.department,
                cm."position",
                cl.entry_time
            FROM commute_logs cl
            LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
            WHERE 
                cl.exit_time IS NULL 
                AND DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') = ${searchDate}
            ORDER BY cl.entry_time ASC;
        `;
        
        return response.status(200).json({ present: rows });

    } catch (error) {
        console.error('API Error in present-report:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return response.status(500).json({ error: 'Failed to fetch present personnel report.', details: errorMessage });
    }
}