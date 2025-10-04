import { createPool, VercelPool, VercelPoolClient } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// REPORT HANDLERS
// ============================================================================

async function handleGeneralReport(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { startDate, endDate, personnelCode, department, position } = request.query;
    let query = `
        SELECT cl.id as log_id, cl.personnel_code, cm.full_name, cm.department, cm."position", cl.entry_time, cl.exit_time, cl.guard_name
        FROM commute_logs cl LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
    `;
    const conditions: string[] = ['cl.entry_time IS NOT NULL', 'cm.full_name IS NOT NULL'];
    const params: (string | number)[] = [];
    let paramIndex = 1;
    if (startDate && typeof startDate === 'string') { conditions.push(`DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') >= $${paramIndex++}`); params.push(startDate); }
    if (endDate && typeof endDate === 'string') { conditions.push(`DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') <= $${paramIndex++}`); params.push(endDate); }
    if (personnelCode && typeof personnelCode === 'string') { conditions.push(`cl.personnel_code = $${paramIndex++}`); params.push(personnelCode); }
    if (department && typeof department === 'string') { conditions.push(`cm.department = $${paramIndex++}`); params.push(department); }
    if (position && typeof position === 'string') { conditions.push(`cm."position" = $${paramIndex++}`); params.push(position); }
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY cm.full_name, cl.entry_time DESC;`;
// FIX: Cast pool to any to use the untyped `query` method for dynamic queries.
    const { rows } = await (pool as any).query(query, params);
    return response.status(200).json({ reports: rows });
}

async function handlePresentReport(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const todayInTehran = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const searchDate = (request.query.date as string) || todayInTehran;
    const { rows } = await pool.sql`
        SELECT cl.id as log_id, cm.full_name, cl.personnel_code, cm.department, cm."position", cl.entry_time
        FROM commute_logs cl LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE cl.exit_time IS NULL AND DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') = ${searchDate}
        ORDER BY cl.entry_time ASC;
    `;
    return response.status(200).json({ present: rows });
}

async function handleHourlyReport(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { startDate, endDate, personnelCode, department, position } = request.query;
    let query = `
        SELECT hcl.id as log_id, hcl.personnel_code, cm.full_name, cm.department, cm."position", hcl.exit_time, hcl.entry_time, hcl.reason, hcl.guard_name
        FROM hourly_commute_logs hcl LEFT JOIN commuting_members cm ON hcl.personnel_code = cm.personnel_code
    `;
    const conditions: string[] = ['cm.full_name IS NOT NULL'];
    const params: (string | number)[] = [];
    let paramIndex = 1;
    const dateColumn = `DATE(COALESCE(hcl.exit_time, hcl.entry_time) AT TIME ZONE 'Asia/Tehran')`;
    if (startDate && typeof startDate === 'string') { conditions.push(`${dateColumn} >= $${paramIndex++}`); params.push(startDate); }
    if (endDate && typeof endDate === 'string') { conditions.push(`${dateColumn} <= $${paramIndex++}`); params.push(endDate); }
    if (personnelCode && typeof personnelCode === 'string') { conditions.push(`hcl.personnel_code = $${paramIndex++}`); params.push(personnelCode); }
    if (department && typeof department === 'string') { conditions.push(`cm.department = $${paramIndex++}`); params.push(department); }
    if (position && typeof position === 'string') { conditions.push(`cm."position" = $${paramIndex++}`); params.push(position); }
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY cm.full_name, COALESCE(hcl.exit_time, hcl.entry_time) DESC;`;
// FIX: Cast pool to any to use the untyped `query` method for dynamic queries.
    const { rows } = await (pool as any).query(query, params);
    return response.status(200).json({ reports: rows });
}

async function handleEditsReport(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { startDate, endDate, personnelCode, department, position } = request.query;
    let query = `
        SELECT cel.id, cel.commute_log_id, cel.personnel_code, cm.full_name, cel.editor_name, cel.edit_timestamp, cel.field_name, cel.old_value, cel.new_value, cl.entry_time as record_date
        FROM commute_edit_logs cel LEFT JOIN commuting_members cm ON cel.personnel_code = cm.personnel_code LEFT JOIN commute_logs cl ON cel.commute_log_id = cl.id
    `;
    const conditions: string[] = ['cl.id IS NOT NULL'];
    const params: (string | number)[] = [];
    let paramIndex = 1;
    if (startDate && typeof startDate === 'string') { conditions.push(`DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') >= $${paramIndex++}`); params.push(startDate); }
    if (endDate && typeof endDate === 'string') { conditions.push(`DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') <= $${paramIndex++}`); params.push(endDate); }
    if (personnelCode && typeof personnelCode === 'string') { conditions.push(`cel.personnel_code = $${paramIndex++}`); params.push(personnelCode); }
    if (department && typeof department === 'string') { conditions.push(`cm.department = $${paramIndex++}`); params.push(department); }
    if (position && typeof position === 'string') { conditions.push(`cm."position" = $${paramIndex++}`); params.push(position); }
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY cel.edit_timestamp DESC;`;
// FIX: Cast pool to any to use the untyped `query` method for dynamic queries.
    const { rows } = await (pool as any).query(query, params);
    return response.status(200).json({ logs: rows });
}

// ============================================================================
// HOURLY ENTITY HANDLERS
// ============================================================================

async function handleGetHourly(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { personnel_code, date } = request.query;
    if (!personnel_code || !date || typeof personnel_code !== 'string' || typeof date !== 'string') return response.status(400).json({ error: 'کد پرسنلی و تاریخ برای جستجو الزامی است.' });
    const result = await pool.sql`
        SELECT * FROM hourly_commute_logs
        WHERE personnel_code = ${personnel_code} AND DATE(COALESCE(exit_time, entry_time) AT TIME ZONE 'Asia/Tehran') = ${date}
        ORDER BY COALESCE(exit_time, entry_time) DESC;
    `;
    return response.status(200).json({ logs: result.rows });
}

async function handlePostHourly(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const body = request.body;
    const client = await pool.connect();
    try {
      if (Array.isArray(body)) {
        const validLogs = body.filter(l => l.personnel_code && l.guard_name && (l.exit_time || l.entry_time));
        if (validLogs.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد.' });
        // FIX: Corrected invalid syntax for client.sql transaction command. It must be a tagged template literal.
        await client.sql`BEGIN`;
        const columns = ['personnel_code', 'full_name', 'guard_name', 'exit_time', 'entry_time', 'reason'];
        const values: (string | null)[] = [];
        const valuePlaceholders: string[] = [];
        let paramIndex = 1;
        for (const log of validLogs) {
            values.push(log.personnel_code, log.full_name || log.personnel_code, log.guard_name, log.exit_time || null, log.entry_time || null, log.reason || null);
            valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        }
        const query = `INSERT INTO hourly_commute_logs (${columns.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
        await (client as any).query(query, values);
        // FIX: Corrected invalid syntax for client.sql transaction command. It must be a tagged template literal.
        await client.sql`COMMIT`;
        return response.status(201).json({ message: `عملیات موفق. ${validLogs.length} رکورد تردد ساعتی وارد شد.` });
      } else {
        const { personnel_code, full_name, guard_name, exit_time, entry_time, reason } = body;
        if (!personnel_code || !full_name || !guard_name || (!exit_time && !entry_time)) return response.status(400).json({ error: 'اطلاعات ارسالی ناقص است. زمان ورود یا خروج باید مشخص باشد.' });
        const { rows } = await pool.sql`
            INSERT INTO hourly_commute_logs (personnel_code, full_name, guard_name, exit_time, entry_time, reason)
            VALUES (${personnel_code}, ${full_name}, ${guard_name}, ${exit_time || null}, ${entry_time || null}, ${reason || null})
            RETURNING *;
        `;
        return response.status(201).json({ message: exit_time ? 'خروج ساعتی ثبت شد.' : 'ورود ساعتی ثبت شد.', log: rows[0] });
      }
    } catch (error) {
        // FIX: Corrected invalid syntax for client.sql transaction command. It must be a tagged template literal.
        await client.sql`ROLLBACK`.catch(()=>{});
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return response.status(500).json({ error: 'خطا در عملیات پایگاه داده.', details: errorMessage });
    } finally {
      client.release();
    }
}

async function handlePutHourly(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'شناسه رکورد برای ویرایش الزامی است.' });
    const { rows: existingLog } = await pool.sql`SELECT * FROM hourly_commute_logs WHERE id = ${id}`;
    if (existingLog.length === 0) return response.status(404).json({ error: 'رکوردی برای ویرایش یافت نشد.' });
    const updatedLog = { ...existingLog[0], ...request.body };
    const { rows } = await pool.sql`
      UPDATE hourly_commute_logs SET exit_time = ${updatedLog.exit_time}, entry_time = ${updatedLog.entry_time}, reason = ${updatedLog.reason}, guard_name = ${updatedLog.guard_name}
      WHERE id = ${id} RETURNING *;
    `;
    return response.status(200).json({ message: 'رکورد با موفقیت ویرایش شد.', log: rows[0] });
}

async function handleDeleteHourly(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const { id } = request.query;
    if (!id || typeof id !== 'string') return response.status(400).json({ error: 'شناسه رکورد برای حذف مورد نیاز است.' });
    const result = await pool.sql`DELETE FROM hourly_commute_logs WHERE id = ${id};`;
    if (result.rowCount === 0) return response.status(404).json({ error: 'رکوردی برای حذف یافت نشد.' });
    return response.status(200).json({ message: 'رکورد با موفقیت حذف شد.' });
}

// ============================================================================
// DAILY LOG HANDLERS
// ============================================================================

async function handleGetDaily(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const todayInTehran = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const searchDate = (request.query.date as string) || todayInTehran;
    const result = await pool.sql`
        SELECT cl.id, cl.personnel_code, cm.full_name, cl.guard_name, cl.entry_time, cl.exit_time 
        FROM commute_logs cl LEFT JOIN commuting_members cm ON cl.personnel_code = cm.personnel_code
        WHERE DATE(cl.entry_time AT TIME ZONE 'Asia/Tehran') = ${searchDate} ORDER BY cl.entry_time DESC;
    `;
    return response.status(200).json({ logs: result.rows });
}

async function handlePostDaily(request: VercelRequest, response: VercelResponse, pool: VercelPool) {
    const body = request.body;
    const client = await pool.connect();
    try {
        if (Array.isArray(body)) { // Bulk Import
            const validLogs = body.filter(log => log.personnel_code && log.guard_name && log.entry_time);
            if (validLogs.length === 0) return response.status(400).json({ error: 'هیچ رکورد معتبری برای ورود یافت نشد.' });
            // FIX: Corrected invalid syntax for client.sql transaction command. It must be a tagged template literal.
            await client.sql`BEGIN`;
            const columns = ['personnel_code', 'guard_name', 'entry_time', 'exit_time'];
            const values: (string | null)[] = [];
            let valuePlaceholders = [];
            let paramIndex = 1;
            for (const log of validLogs) {
                values.push(log.personnel_code, log.guard_name, log.entry_time, log.exit_time || null);
                valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
            }
            const query = `INSERT INTO commute_logs (${columns.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
            await (client as any).query(query, values);
            // FIX: Corrected invalid syntax for client.sql transaction command. It must be a tagged template literal.
            await client.sql`COMMIT`;
            return response.status(200).json({ message: `عملیات موفق. ${validLogs.length} رکورد تردد وارد شد.` });
        } else { // Single/Multi-person log
            const { personnelCode, guardName, action, timestampOverride } = body;
            if (!personnelCode || !guardName || !action || !['entry', 'exit'].includes(action)) return response.status(400).json({ error: 'اطلاعات ارسالی ناقص یا نامعتبر است.' });

            // FIX: Always use an ISO string, never the 'NOW()' string literal which fails with parameterization.
            const effectiveTime = timestampOverride ? new Date(timestampOverride).toISOString() : new Date().toISOString();

            // FIX: Use DATE() with timezone conversion for correct day boundary checks.
            const { rows: openLogs } = await pool.sql`
                SELECT id 
                FROM commute_logs 
                WHERE personnel_code = ${personnelCode} 
                  AND exit_time IS NULL 
                  AND DATE(entry_