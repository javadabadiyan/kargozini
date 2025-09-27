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
    'personnel_documents',
    'commitment_letters',
    'disciplinary_records'
];

const TABLE_COLUMNS: Record<string, string[]> = {
    personnel: [
      'personnel_code', 'first_name', 'last_name', 'father_name', 'national_id', 'id_number',
      'birth_year', 'birth_date', 'birth_place', 'issue_date', 'issue_place', 'marital_status', 'military_status',
      'job_title', 'position', 'employment_type', 'department', 'service_location', 'hire_date',
      'education_level', 'field_of_study', 'job_group', 'sum_of_decree_factors', 'status'
    ],
    commuting_members: ['personnel_code', 'full_name', 'department', 'position'],
    dependents: [
      'personnel_code', 'first_name', 'last_name', 'father_name', 'relation_type', 
      'birth_date', 'gender', 'birth_month', 'birth_day', 'id_number', 
      'national_id', 'guardian_national_id', 'issue_place', 'insurance_type'
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
    personnel_documents: ['personnel_code', 'title', 'file_name', 'file_type', 'file_data', 'uploaded_at'],
    commitment_letters: [
      'recipient_name', 'recipient_national_id', 'guarantor_personnel_code', 'guarantor_name',
      'guarantor_national_id', 'loan_amount', 'sum_of_decree_factors', 'bank_name', 'branch_name',
      'issue_date', 'reference_number', 'created_at'
    ],
    disciplinary_records: ['full_name', 'personnel_code', 'meeting_date', 'letter_description', 'final_decision', 'created_at']
};

// Helper to safely quote all column names
const quote = (name: string) => `"${name}"`;

async function handleGet(response: VercelResponse, client: VercelPoolClient) {
    try {
        const backupData: { [key: string]: any[] } = {};
        for (const table of TABLES_IN_ORDER) {
            const { rows } = await (client as any).query(`SELECT * FROM ${quote(table)}`);
            backupData[table] = rows;
        }
        return response.status(200).json(backupData);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to create backup.', details: errorMessage });
    }
}

async function handlePost(request: VercelRequest, response: VercelResponse, client: VercelPoolClient) {
    const backupData = request.body;
    for(const table of TABLES_IN_ORDER) {
        // Allow missing tables in backup for flexibility
        if (backupData[table] && !Array.isArray(backupData[table])) {
            return response.status(400).json({ error: `داده‌های پشتیبان نامعتبر است. بخش "${table}" باید یک آرایه باشد.` });
        }
    }

    try {
        await client.sql`BEGIN`;
        // Truncate in reverse order of creation to respect foreign keys
        for (const table of [...TABLES_IN_ORDER].reverse()) {
            await (client as any).query(`TRUNCATE TABLE ${quote(table)} RESTART IDENTITY CASCADE`);
        }
        
        for (const table of TABLES_IN_ORDER) {
            const rows = backupData[table];
            if (!rows || rows.length === 0) continue;

            const columns = TABLE_COLUMNS[table];
            if (!columns) {
                console.warn(`No column definition for table ${table} in backup script, skipping.`);
                continue;
            }
            const columnNames = columns.map(quote).join(', ');
            
            // Batch insert for performance
            const BATCH_SIZE = 250;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);
                if (batch.length === 0) continue;

                const values: any[] = [];
                const valuePlaceholders: string[] = [];
                let paramIndex = 1;

                for (const row of batch) {
                    const recordPlaceholders: string[] = [];
                    for (const col of columns) {
                        values.push(row[col] ?? null);
                        recordPlaceholders.push(`$${paramIndex++}`);
                    }
                    valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
                }
                
                if (values.length > 0) {
                     const query = `INSERT INTO ${quote(table)} (${columnNames}) VALUES ${valuePlaceholders.join(', ')}`;
                     await (client as any).query(query, values);
                }
            }
        }

        await client.sql`COMMIT`;
        return response.status(200).json({ message: 'اطلاعات با موفقیت بازیابی شد.' });
    } catch (error) {
        await client.sql`ROLLBACK`.catch(rbError => console.error('Rollback failed:', rbError));
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to restore from backup.', details: errorMessage });
    }
}

async function handleDelete(response: VercelResponse, client: VercelPoolClient) {
    try {
        await client.sql`BEGIN`;
        for (const table of [...TABLES_IN_ORDER].reverse()) {
             await (client as any).query(`TRUNCATE TABLE ${quote(table)} RESTART IDENTITY CASCADE`);
        }
        await client.sql`COMMIT`;
        return response.status(200).json({ message: 'تمام اطلاعات با موفقیت پاک شد.' });
    } catch(error) {
        await client.sql`ROLLBACK`.catch(rbError => console.error('Rollback failed:', rbError));
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return response.status(500).json({ error: 'Failed to delete all data.', details: errorMessage });
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
            case 'DELETE':
                return await handleDelete(response, client);
            default:
                response.setHeader('Allow', ['GET', 'POST', 'DELETE']);
                return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
        }
    } finally {
        client.release();
    }
}
