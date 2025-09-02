import { createPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TABLES_IN_ORDER = [
    'personnel',
    'commuting_members',
    'dependents',
    'commute_logs',
    'hourly_commute_logs',
    'commute_edit_logs',
];

const TABLE_COLUMNS: Record<string, string[]> = {
    personnel: [
      'personnel_code', 'first_name', 'last_name', 'father_name', 'national_id', 'id_number',
      'birth_date', 'birth_place', 'issue_date', 'issue_place', 'marital_status', 'military_status',
      'job_title', 'position', 'employment_type', 'department', 'service_location', 'hire_date',
      'education_level', 'field_of_study', 'status'
    ],
    commuting_members: ['personnel_code', 'full_name', 'department', 'position'],
    dependents: [
      'personnel_code', 'relation_type', 'first_name', 'last_name', 
      'national_id', 'birth_date', 'gender'
    ],
    commute_logs: ['personnel_code', 'guard_name', 'entry_time', 'exit_time', 'created_at', 'updated_at'],
    hourly_commute_logs: [
      'personnel_code', 'full_name', 'guard_name', 'exit_time', 'entry_time', 
      'reason', 'created_at', 'updated_at'
    ],
    commute_edit_logs: [
      'commute_log_id', 'personnel_code', 'editor_name', 'edit_timestamp', 
      'field_name', 'old_value', 'new_value'
    ],
};

async function handleGet(response: VercelResponse, client: VercelPoolClient) {
    try {
        const backupData: { [key: string]: any[] } = {};
        for (const table of TABLES_IN_ORDER) {
            const { rows } = await client.query(`SELECT * FROM ${table}`);
            backupData[table] = rows;
        }
        return response.status(200).json(backupData);
    } catch (error) {
        console.error('Backup GET failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to create backup.', details: errorMessage });
    }
}

async function handlePost(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const backupData = request.body;
    
    // Basic validation
    for(const table of TABLES_IN_ORDER) {
        if (!backupData[table] || !Array.isArray(backupData[table])) {
            return response.status(400).json({ error: `داده‌های پشتیبان ناقص است. بخش "${table}" یافت نشد.` });
        }
    }

    try {
        await client.query('BEGIN');
        
        // Truncate all tables. CASCADE handles dependencies, RESTART IDENTITY resets sequences.
        await client.query(`TRUNCATE ${TABLES_IN_ORDER.join(', ')} RESTART IDENTITY CASCADE`);

        // Insert data in order
        for (const table of TABLES_IN_ORDER) {
            const rows = backupData[table];
            if (rows.length === 0) continue;

            const columns = TABLE_COLUMNS[table];
            // Vercel Postgres doesn't like "position" without quotes, so we handle that
            const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
            
            const values: any[] = [];
            const valuePlaceholders: string[] = [];
            let paramIndex = 1;

            for (const row of rows) {
                const recordPlaceholders: string[] = [];
                for (const col of columns) {
                    values.push(row[col] ?? null);
                    recordPlaceholders.push(`$${paramIndex++}`);
                }
                valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
            }

            const query = `INSERT INTO ${table} (${columnNames}) VALUES ${valuePlaceholders.join(', ')}`;
            await client.query(query, values);
        }

        await client.query('COMMIT');
        return response.status(200).json({ message: 'اطلاعات با موفقیت بازیابی شد.' });
    } catch (error) {
        await client.query('ROLLBACK').catch(rbError => console.error('Rollback failed:', rbError));
        console.error('Backup POST failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to restore from backup.', details: errorMessage });
    }
}


export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (!process.env.POSTGRES_URL) {
        return response.status(500).json({ error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.' });
    }
    const pool = createPool({ connectionString: process.env.POSTGRES_URL });
    const client = await pool.connect();

    try {
        switch (request.method) {
            case 'GET':
                return await handleGet(response, client);
            case 'POST':
                return await handlePost(request, response, client);
            default:
                response.setHeader('Allow', ['GET', 'POST']);
                return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
        }
    } finally {
        client.release();
    }
}