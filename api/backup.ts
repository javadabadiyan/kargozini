import { createPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TABLES_IN_ORDER = [
    'personnel',
    'commuting_members',
    'dependents',
    'app_users',
    'commute_logs',
    'hourly_commute_logs',
    'commute_edit_logs',
];

const COMMUTE_TABLES = ['commute_logs', 'hourly_commute_logs', 'commute_edit_logs'];

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
    app_users: ['username', 'password', 'permissions'],
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

async function handleGet(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const { table } = request.query;

    try {
        const backupData: { [key: string]: any[] } = {};

        if (table) {
            if (table === 'commutes') {
                for (const t of COMMUTE_TABLES) {
                    const { rows } = await client.query(`SELECT * FROM ${t}`);
                    backupData[t] = rows;
                }
            } else if (TABLES_IN_ORDER.includes(table as string)) {
                const { rows } = await client.query(`SELECT * FROM ${table}`);
                backupData[table as string] = rows;
            } else {
                return response.status(400).json({ error: `Table "${table}" is not valid for backup.` });
            }
        } else { // Full backup
            for (const t of TABLES_IN_ORDER) {
                const { rows } = await client.query(`SELECT * FROM ${t}`);
                backupData[t] = rows;
            }
        }
        return response.status(200).json(backupData);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to create backup.', details: errorMessage });
    }
}

async function handlePost(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const backupData = request.body;
    const { table } = request.query;
    
    const tablesToRestore = table ? (table === 'commutes' ? COMMUTE_TABLES.slice().reverse() : [table as string]) : TABLES_IN_ORDER.slice().reverse();

    for(const t of tablesToRestore) {
        if (!backupData[t] || !Array.isArray(backupData[t])) {
            return response.status(400).json({ error: `داده‌های پشتیبان ناقص است. بخش "${t}" یافت نشد.` });
        }
    }

    try {
        await client.query('BEGIN');
        
        // Truncate tables in reverse order of dependency
        const truncateCascade = table === 'personnel';
        await client.query(`TRUNCATE ${tablesToRestore.join(', ')} RESTART IDENTITY ${truncateCascade ? 'CASCADE' : ''}`);

        for (const t of tablesToRestore.slice().reverse()) { // Insert in dependency order
            const rows = backupData[t];
            if (rows.length === 0) continue;

            const columns = TABLE_COLUMNS[t];
            const columnNames = columns.map(c => c === 'position' ? `"${c}"` : c).join(', ');
            
            const values: any[] = [];
            const valuePlaceholders: string[] = [];
            let paramIndex = 1;

            for (const row of rows) {
                const recordPlaceholders: string[] = [];
                for (const col of columns) {
                    // Special handling for JSONB
                    const value = col === 'permissions' ? JSON.stringify(row[col] ?? {}) : (row[col] ?? null);
                    values.push(value);
                    recordPlaceholders.push(`$${paramIndex++}`);
                }
                valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
            }
            if (values.length > 0) {
                 const query = `INSERT INTO ${t} (${columnNames}) VALUES ${valuePlaceholders.join(', ')}`;
                 await client.query(query, values);
            }
        }

        await client.query('COMMIT');
        return response.status(200).json({ message: 'اطلاعات با موفقیت بازیابی شد.' });
    } catch (error) {
        await client.query('ROLLBACK').catch(rbError => console.error('Rollback failed:', rbError));
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('foreign key constraint')) {
            return response.status(400).json({ error: 'خطای وابستگی.', details: 'اطلاعات یک جدول به جدول دیگری وابسته است که داده‌های آن در فایل پشتیبان موجود نیست. (مثلا کد پرسنلی در فایل بستگان در فایل پرسنل وجود ندارد)' });
        }
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
                return await handleGet(request, response, client);
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