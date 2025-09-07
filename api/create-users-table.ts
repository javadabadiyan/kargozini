import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({
        error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) تنظیم نشده است.',
        details: 'لطفاً تنظیمات پروژه خود را در Vercel بررسی کنید و از اتصال صحیح پایگاه داده اطمینان حاصل کنید.'
    });
  }
  
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  });
  const client = await pool.connect();

  const messages: string[] = [];
  try {
    // --- Phase 1: Critical schema setup in a single transaction ---
    await client.sql`BEGIN`;

    // Create personnel table
    await client.sql`
      CREATE TABLE IF NOT EXISTS personnel (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100),
        national_id VARCHAR(20) UNIQUE,
        id_number VARCHAR(20),
        birth_year VARCHAR(10),
        birth_date VARCHAR(30),
        birth_place VARCHAR(100),
        issue_date VARCHAR(30),
        issue_place VARCHAR(100),
        marital_status VARCHAR(50),
        military_status VARCHAR(50),
        job_title VARCHAR(255),
        "position" VARCHAR(255),
        employment_type VARCHAR(100),
        department VARCHAR(100),
        service_location VARCHAR(255),
        hire_date VARCHAR(30),
        education_level VARCHAR(100),
        field_of_study VARCHAR(100),
        job_group VARCHAR(100),
        sum_of_decree_factors VARCHAR(100),
        status VARCHAR(50)
      );
    `;
    messages.push('جدول "personnel" با موفقیت ایجاد یا تایید شد.');

    // Create other primary tables
    await client.sql`
      CREATE TABLE IF NOT EXISTS dependents (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100),
        relation_type VARCHAR(100),
        birth_date VARCHAR(30),
        gender VARCHAR(20),
        birth_month VARCHAR(20),
        birth_day VARCHAR(20),
        id_number VARCHAR(20),
        national_id VARCHAR(20) NOT NULL,
        guardian_national_id VARCHAR(20),
        issue_place VARCHAR(100),
        insurance_type VARCHAR(100),
        CONSTRAINT unique_dependent UNIQUE (personnel_code, national_id),
        CONSTRAINT fk_personnel FOREIGN KEY(personnel_code) REFERENCES personnel(personnel_code) ON DELETE CASCADE
      );
    `;
    messages.push('جدول "dependents" با موفقیت ایجاد یا تایید شد.');

    await client.sql`
      CREATE TABLE IF NOT EXISTS commuting_members (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(200) NOT NULL,
        department VARCHAR(100),
        "position" VARCHAR(255)
      );
    `;
    messages.push('جدول "commuting_members" با موفقیت ایجاد یا تایید شد.');

    await client.sql`
      CREATE TABLE IF NOT EXISTS commute_logs (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL,
        guard_name VARCHAR(255) NOT NULL,
        entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        exit_time TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    messages.push('جدول "commute_logs" با موفقیت ایجاد یا تایید شد.');

    await client.sql`
      CREATE TABLE IF NOT EXISTS hourly_commute_logs (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL,
        full_name VARCHAR(200) NOT NULL,
        guard_name VARCHAR(255) NOT NULL,
        exit_time TIMESTAMPTZ,
        entry_time TIMESTAMPTZ,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    messages.push('جدول "hourly_commute_logs" با موفقیت ایجاد یا تایید شد.');

    await client.sql`
      CREATE TABLE IF NOT EXISTS commute_edit_logs (
        id SERIAL PRIMARY KEY,
        commute_log_id INTEGER NOT NULL,
        personnel_code VARCHAR(50) NOT NULL,
        editor_name VARCHAR(255) NOT NULL,
        edit_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        field_name VARCHAR(100) NOT NULL,
        old_value VARCHAR(100),
        new_value VARCHAR(100)
      );
    `;
    messages.push('جدول "commute_edit_logs" با موفقیت ایجاد یا تایید شد.');

    await client.sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        permissions JSONB NOT NULL
      );
    `;
    messages.push('جدول "app_users" با موفقیت ایجاد یا تایید شد.');

    await client.sql`
      CREATE TABLE IF NOT EXISTS personnel_documents (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_data TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_personnel FOREIGN KEY(personnel_code) REFERENCES personnel(personnel_code) ON DELETE CASCADE
      );
    `;
    messages.push('جدول "personnel_documents" ایجاد شد.');
    
    await client.sql`
      CREATE TABLE IF NOT EXISTS commitment_letters (
        id SERIAL PRIMARY KEY,
        recipient_name VARCHAR(255) NOT NULL,
        recipient_national_id VARCHAR(20) NOT NULL,
        guarantor_personnel_code VARCHAR(50) NOT NULL,
        guarantor_name VARCHAR(255) NOT NULL,
        guarantor_national_id VARCHAR(20) NOT NULL,
        loan_amount BIGINT NOT NULL,
        sum_of_decree_factors BIGINT,
        bank_name VARCHAR(255),
        branch_name VARCHAR(255),
        issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
        reference_number VARCHAR(100) UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    messages.push('جدول "commitment_letters" با موفقیت ایجاد یا تایید شد.');

    await client.sql`
      CREATE TABLE IF NOT EXISTS disciplinary_records (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        personnel_code VARCHAR(50) NOT NULL,
        meeting_date VARCHAR(50),
        letter_description TEXT,
        final_decision TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    messages.push('جدول "disciplinary_records" با موفقیت ایجاد یا تایید شد.');

    await client.sql`COMMIT`;
    messages.push('تراکنش اصلی ایجاد جداول با موفقیت انجام شد.');

    // --- Phase 2: Add optional/backward-compatibility columns individually ---
    // This makes the setup process more resilient to pre-existing conditions.
    try {
        await client.sql`ALTER TABLE personnel ADD COLUMN IF NOT EXISTS birth_year VARCHAR(10);`;
        messages.push('ستون "birth_year" در جدول "personnel" تایید یا اضافه شد.');
    } catch (e: any) {
        messages.push(`هشدار هنگام افزودن ستون birth_year: ${e.message}`);
    }
    try {
        await client.sql`ALTER TABLE personnel ADD COLUMN IF NOT EXISTS job_group VARCHAR(100);`;
        messages.push('ستون "job_group" در جدول "personnel" تایید یا اضافه شد.');
    } catch (e: any) {
        messages.push(`هشدار هنگام افزودن ستون job_group: ${e.message}`);
    }
    try {
        await client.sql`ALTER TABLE personnel ADD COLUMN IF NOT EXISTS sum_of_decree_factors VARCHAR(100);`;
        messages.push('ستون "sum_of_decree_factors" در جدول "personnel" تایید یا اضافه شد.');
    } catch (e: any) {
        messages.push(`هشدار هنگام افزودن ستون sum_of_decree_factors: ${e.message}`);
    }
    try {
        await client.sql`ALTER TABLE dependents ADD COLUMN IF NOT EXISTS father_name VARCHAR(100);`;
        messages.push('ستون "father_name" در جدول "dependents" تایید یا اضافه شد.');
    } catch (e: any) {
        messages.push(`هشدار هنگام افزودن ستون father_name: ${e.message}`);
    }
    try {
        await client.sql`ALTER TABLE dependents ADD COLUMN IF NOT EXISTS birth_month VARCHAR(20);`;
        messages.push('ستون "birth_month" در جدول "dependents" تایید یا اضافه شد.');
    } catch (e: any) {
        messages.push(`هشدار هنگام افزودن ستون birth_month: ${e.message}`);
    }
    try {
        await client.sql`ALTER TABLE dependents ADD COLUMN IF NOT EXISTS birth_day VARCHAR(20);`;
        messages.push('ستون "birth_day" در جدول "dependents" تایید یا اضافه شد.');
    } catch (e: any) {
        messages.push(`هشدار هنگام افزودن ستون birth_day: ${e.message}`);
    }
    try {
        await client.sql`ALTER TABLE dependents ADD COLUMN IF NOT EXISTS id_number VARCHAR(20);`;
        messages.push('ستون "id_number" در جدول "dependents" تایید یا اضافه شد.');
    } catch (e: any) {
        messages.push(`هشدار هنگام افزودن ستون id_number: ${e.message}`);
    }


    // --- Phase 3: Create triggers, indexes, and default data ---
    // This is also in a transaction for atomicity.
    await client.sql`BEGIN`;

    await client.sql`CREATE INDEX IF NOT EXISTS dependents_personnel_code_idx ON dependents (personnel_code);`;
    await client.sql`CREATE INDEX IF NOT EXISTS personnel_documents_personnel_code_idx ON personnel_documents (personnel_code);`;
    await client.sql`CREATE INDEX IF NOT EXISTS personnel_last_first_name_idx ON personnel (last_name, first_name);`;
    await client.sql`CREATE INDEX IF NOT EXISTS commitment_letters_guarantor_code_idx ON commitment_letters (guarantor_personnel_code);`;
    messages.push('ایندکس‌های ضروری برای جستجوی سریع ایجاد شدند.');

    await (client as any).query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
        END;
        $$ language 'plpgsql';
    `);
    
    await (client as any).query(`
        DROP TRIGGER IF EXISTS update_commute_logs_updated_at ON commute_logs;
        CREATE TRIGGER update_commute_logs_updated_at
        BEFORE UPDATE ON commute_logs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

     await (client as any).query(`
        DROP TRIGGER IF EXISTS update_hourly_commute_logs_updated_at ON hourly_commute_logs;
        CREATE TRIGGER update_hourly_commute_logs_updated_at
        BEFORE UPDATE ON hourly_commute_logs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    messages.push('تریگرهای به‌روزرسانی خودکار برای جداول تردد ایجاد شدند.');
    
    const adminPermissions = JSON.stringify({
      dashboard: true,
      personnel: true,
      personnel_list: true,
      dependents_info: true,
      document_upload: true,
      recruitment: true,
      accounting_commitment_parent: true,
      accounting_commitment: true,
      commitment_letter_archive: true,
      disciplinary_committee: true,
      performance_review: true,
      send_performance_review: true,
      archive_performance_review: true,
      job_group: true,
      bonus_management: true,
      enter_bonus: true,
      bonus_analyzer: true,
      security: true,
      commuting_members: true,
      log_commute: true,
      commute_report: true,
      settings: true,
      user_management: true,
    });
    const guardPermissions = JSON.stringify({
      dashboard: false,
      personnel: false,
      security: true,
      commuting_members: true,
      log_commute: true,
      commute_report: true,
    });

    await client.sql`
      INSERT INTO app_users (username, password, permissions) VALUES
      ('ادمین', '5221157', ${adminPermissions})
      ON CONFLICT (username) DO UPDATE SET permissions = ${adminPermissions};
    `;
    await client.sql`
      INSERT INTO app_users (username, password, permissions) VALUES
      ('نگهبانی', '123456789', ${guardPermissions})
      ON CONFLICT (username) DO UPDATE SET password = '123456789', permissions = ${guardPermissions};
    `;
    messages.push('کاربران پیش‌فرض "ادمین" و "نگهبانی" ایجاد یا به‌روزرسانی شدند.');

    await client.sql`COMMIT`;

    // --- Phase 4: Optional performance enhancements ---
    // This runs last and outside a transaction, so its failure doesn't affect the core setup.
    try {
        await client.sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
        messages.push('افزونه "pg_trgm" برای جستجوی سریع فعال شد.');
        await client.sql`CREATE INDEX IF NOT EXISTS personnel_first_name_trgm_idx ON personnel USING gin (first_name gin_trgm_ops);`;
        await client.sql`CREATE INDEX IF NOT EXISTS personnel_last_name_trgm_idx ON personnel USING gin (last_name gin_trgm_ops);`;
        messages.push('ایندکس‌های جستجوی سریع (GIN) برای پرسنل ایجاد شدند.');
    } catch (extError: any) {
        console.warn('Could not create pg_trgm extension or GIN indexes:', extError);
        messages.push('هشدار: امکان فعال‌سازی افزونه "pg_trgm" یا ایندکس‌های GIN وجود نداشت. جستجو ممکن است کند باشد (این خطا برای پلن‌های رایگان طبیعی است).');
    }
    
    return response.status(200).json({ message: 'عملیات راه‌اندازی پایگاه داده با موفقیت انجام شد.', details: messages });
  
  } catch (error) {
    await client.sql`ROLLBACK`.catch((rbError: any) => console.error('Rollback failed:', rbError));
    console.error('Database setup failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'ایجاد جداول در پایگاه داده با خطا مواجه شد.', details: errorMessage });
  } finally {
      client.release();
  }
}