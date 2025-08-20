import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Personnel, Relative, RelativeWithPersonnel, AccountingCommitmentWithDetails } from '../../types';

async function setupTables() {
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
    await sql`
        CREATE TABLE IF NOT EXISTS relatives (
            id SERIAL PRIMARY KEY,
            personnel_id INT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            relation VARCHAR(50),
            national_id VARCHAR(20),
            birth_date VARCHAR(50),
            CONSTRAINT unique_relative_national_id UNIQUE (national_id)
        );
    `;
     await sql`
        CREATE TABLE IF NOT EXISTS accounting_commitments (
            id SERIAL PRIMARY KEY,
            personnel_id INT REFERENCES personnel(id) ON DELETE SET NULL,
            addressee VARCHAR(255) NOT NULL DEFAULT 'ریاست محترم',
            title VARCHAR(255) NOT NULL,
            letter_date VARCHAR(50) NOT NULL,
            amount BIGINT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            guarantor_first_name VARCHAR(100),
            guarantor_last_name VARCHAR(100),
            borrower_first_name VARCHAR(100),
            borrower_last_name VARCHAR(100),
            borrower_father_name VARCHAR(100),
            borrower_national_id VARCHAR(20)
        );
    `;
}

// --- Handler for PERSONNEL ---
async function handlePersonnel(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const { rows } = await sql<Personnel>`SELECT * FROM personnel ORDER BY id DESC;`;
        return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
        if (req.query.action === 'import') {
            const personnelList = req.body as Omit<Personnel, 'id'>[];
            const client = await sql.connect();
            try {
                await client.sql`BEGIN`;
                for (const p of personnelList) {
                    await client.sql`
                        INSERT INTO personnel (personnel_code, first_name, last_name, father_name, national_id, id_number, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job, "position", employment_type, unit, service_place, employment_date, education_degree, field_of_study, status) 
                        VALUES (${p.personnel_code}, ${p.first_name}, ${p.last_name}, ${p.father_name}, ${p.national_id}, ${p.id_number}, ${p.birth_date}, ${p.birth_place}, ${p.issue_date}, ${p.issue_place}, ${p.marital_status}, ${p.military_status}, ${p.job}, ${p.position}, ${p.employment_type}, ${p.unit}, ${p.service_place}, ${p.employment_date}, ${p.education_degree}, ${p.field_of_study}, ${p.status})
                        ON CONFLICT (personnel_code) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, father_name = EXCLUDED.father_name, national_id = EXCLUDED.national_id, id_number = EXCLUDED.id_number, birth_date = EXCLUDED.birth_date, birth_place = EXCLUDED.birth_place, issue_date = EXCLUDED.issue_date, issue_place = EXCLUDED.issue_place, marital_status = EXCLUDED.marital_status, military_status = EXCLUDED.military_status, job = EXCLUDED.job, "position" = EXCLUDED."position", employment_type = EXCLUDED.employment_type, unit = EXCLUDED.unit, service_place = EXCLUDED.service_place, employment_date = EXCLUDED.employment_date, education_degree = EXCLUDED.education_degree, field_of_study = EXCLUDED.field_of_study, status = EXCLUDED.status;
                    `;
                }
                await client.sql`COMMIT`;
                return res.status(200).json({ message: 'Import successful' });
            } finally {
                client.release();
            }
        }
        const { id, ...data } = req.body;
        if (id) {
            await sql`
                UPDATE personnel SET personnel_code=${data.personnel_code}, first_name=${data.first_name}, last_name=${data.last_name}, father_name=${data.father_name}, national_id=${data.national_id}, id_number=${data.id_number}, birth_date=${data.birth_date}, birth_place=${data.birth_place}, issue_date=${data.issue_date}, issue_place=${data.issue_place}, marital_status=${data.marital_status}, military_status=${data.military_status}, job=${data.job}, "position"=${data.position}, employment_type=${data.employment_type}, unit=${data.unit}, service_place=${data.service_place}, employment_date=${data.employment_date}, education_degree=${data.education_degree}, field_of_study=${data.field_of_study}, status=${data.status}
                WHERE id = ${id};
            `;
            const { rows } = await sql<Personnel>`SELECT * FROM personnel WHERE id = ${id};`;
            return res.status(200).json(rows[0]);
        } else {
            const result = await sql`
                INSERT INTO personnel (personnel_code, first_name, last_name, father_name, national_id, id_number, birth_date, birth_place, issue_date, issue_place, marital_status, military_status, job, "position", employment_type, unit, service_place, employment_date, education_degree, field_of_study, status) 
                VALUES (${data.personnel_code}, ${data.first_name}, ${data.last_name}, ${data.father_name}, ${data.national_id}, ${data.id_number}, ${data.birth_date}, ${data.birth_place}, ${data.issue_date}, ${data.issue_place}, ${data.marital_status}, ${data.military_status}, ${data.job}, ${data.position}, ${data.employment_type}, ${data.unit}, ${data.service_place}, ${data.employment_date}, ${data.education_degree}, ${data.field_of_study}, ${data.status})
                RETURNING *;
            `;
            return res.status(201).json(result.rows[0]);
        }
    }
    if (req.method === 'DELETE') {
        if (req.query.action === 'delete_all') {
            await sql`TRUNCATE TABLE personnel RESTART IDENTITY CASCADE;`;
            return res.status(204).send(null);
        }
        const id = Number(req.query.id);
        if (!id) return res.status(400).json({ error: 'Personnel ID is required' });
        await sql`DELETE FROM personnel WHERE id = ${id};`;
        return res.status(204).send(null);
    }
}

// --- Handler for RELATIVES ---
async function handleRelatives(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const { rows } = await sql<RelativeWithPersonnel>`
            SELECT r.*, p.first_name as personnel_first_name, p.last_name as personnel_last_name, p.personnel_code 
            FROM relatives r JOIN personnel p ON r.personnel_id = p.id ORDER BY r.id DESC;
        `;
        return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
        const client = await sql.connect();
        try {
            await client.sql`BEGIN`;
            if (req.query.action === 'import') {
                for (const r of req.body as any[]) {
                    if (!r.personnel_code) continue;
                    const { rows } = await client.sql`SELECT id FROM personnel WHERE personnel_code = ${r.personnel_code}`;
                    if (rows.length > 0) {
                        await client.sql`
                            INSERT INTO relatives (personnel_id, first_name, last_name, relation, national_id, birth_date) VALUES (${rows[0].id}, ${r.first_name}, ${r.last_name}, ${r.relation}, ${r.national_id}, ${r.birth_date})
                            ON CONFLICT (national_id) WHERE national_id IS NOT NULL AND national_id <> '' DO UPDATE SET personnel_id = EXCLUDED.personnel_id, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, relation = EXCLUDED.relation, birth_date = EXCLUDED.birth_date;
                        `;
                    }
                }
            } else {
                const { id, personnel_id, first_name, last_name, relation, national_id, birth_date } = req.body as Relative;
                if (!personnel_id || !first_name || !last_name) return res.status(400).json({ error: 'Missing required fields' });
                if (id) {
                    await client.sql`UPDATE relatives SET personnel_id=${personnel_id}, first_name=${first_name}, last_name=${last_name}, relation=${relation}, national_id=${national_id}, birth_date=${birth_date} WHERE id=${id}`;
                } else {
                    await client.sql`INSERT INTO relatives (personnel_id, first_name, last_name, relation, national_id, birth_date) VALUES (${personnel_id}, ${first_name}, ${last_name}, ${relation}, ${national_id}, ${birth_date})`;
                }
            }
            await client.sql`COMMIT`;
            return res.status(200).json({ success: true });
        } finally {
            client.release();
        }
    }
    if (req.method === 'DELETE') {
        const id = Number(req.query.id);
        if (!id) return res.status(400).json({ error: 'Relative ID is required' });
        await sql`DELETE FROM relatives WHERE id = ${id};`;
        return res.status(204).send(null);
    }
}

// --- Handler for COMMITMENTS ---
async function handleCommitments(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const { rows } = await sql<AccountingCommitmentWithDetails>`
            SELECT c.*, COALESCE(p1.first_name, c.borrower_first_name, '') as personnel_first_name, COALESCE(p1.last_name, c.borrower_last_name, '') as personnel_last_name, p1.personnel_code
            FROM accounting_commitments c LEFT JOIN personnel p1 ON c.personnel_id = p1.id
            ORDER BY c.created_at DESC;
        `;
        return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
        const { id, personnel_id, addressee, title, letter_date, amount, body, guarantor_first_name, guarantor_last_name, borrower_first_name, borrower_last_name, borrower_father_name, borrower_national_id } = req.body;
        if (!addressee || !title || !letter_date || amount == null || !body || !guarantor_first_name || !guarantor_last_name || (!personnel_id && (!borrower_first_name || !borrower_last_name))) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (id) {
            await sql`
                UPDATE accounting_commitments SET personnel_id = ${personnel_id || null}, addressee = ${addressee}, title = ${title}, letter_date = ${letter_date}, amount = ${amount}, body = ${body}, guarantor_first_name = ${guarantor_first_name}, guarantor_last_name = ${guarantor_last_name}, borrower_first_name = ${borrower_first_name || null}, borrower_last_name = ${borrower_last_name || null}, borrower_father_name = ${borrower_father_name || null}, borrower_national_id = ${borrower_national_id || null}
                WHERE id = ${id} RETURNING *;
            `;
        } else {
            await sql`
                INSERT INTO accounting_commitments (personnel_id, addressee, title, letter_date, amount, body, guarantor_first_name, guarantor_last_name, borrower_first_name, borrower_last_name, borrower_father_name, borrower_national_id)
                VALUES (${personnel_id || null}, ${addressee}, ${title}, ${letter_date}, ${amount}, ${body}, ${guarantor_first_name}, ${guarantor_last_name}, ${borrower_first_name || null}, ${borrower_last_name || null}, ${borrower_father_name || null}, ${borrower_national_id || null})
                RETURNING *;
            `;
        }
        return res.status(id ? 200 : 201).json({ success: true });
    }
    if (req.method === 'DELETE') {
        const id = Number(req.query.id);
        if (!id) return res.status(400).json({ error: 'Commitment ID is required' });
        await sql`DELETE FROM accounting_commitments WHERE id = ${id};`;
        return res.status(204).send(null);
    }
}

// --- MAIN HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        await setupTables();
    } catch (error) {
        console.error("Database setup error in /api/users (consolidated):", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'Failed to initialize data tables', details: errorMessage });
    }

    const { type } = req.query;

    try {
        if (type === 'relatives') {
            return await handleRelatives(req, res);
        } else if (type === 'commitments') {
            return await handleCommitments(req, res);
        } else {
            return await handlePersonnel(req, res);
        }
    } catch (error) {
        console.error(`Error in /api/users (type=${String(type) || 'personnel'}):`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        let statusCode = 500;
        let publicError = 'Failed to process request';
        if (errorMessage.includes('unique_relative_national_id') || errorMessage.includes('duplicate key value violates unique constraint')) {
            statusCode = 409; // Conflict
            publicError = 'کد ملی یا کد پرسنلی وارد شده تکراری است.';
        }
        return res.status(statusCode).json({ error: publicError, details: errorMessage });
    }
}