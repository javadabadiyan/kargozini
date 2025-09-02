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
    await (client as any).query('BEGIN');

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
        status VARCHAR(50)
      );
    `;
    messages.push('جدول "personnel" با موفقیت ایجاد یا تایید شد.');

    // Create dependents table
    await client.sql`
      CREATE TABLE IF NOT EXISTS dependents (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL REFERENCES personnel(personnel_code) ON DELETE CASCADE,
        relation_type VARCHAR(100),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        national_id VARCHAR(20) NOT NULL,
        birth_date VARCHAR(30),
        gender VARCHAR(20),
        CONSTRAINT unique_dependent UNIQUE (personnel_code, national_id)
      );
    `;
    messages.push('جدول "dependents" با موفقیت ایجاد یا تایید شد.');
    await client.sql`CREATE INDEX IF NOT EXISTS dependents_personnel_code_idx ON dependents (personnel_code);`;
    messages.push('ایندکس برای جستجوی سریع بستگان ایجاد شد.');

    // Create commuting_members table
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

    // Create commute_logs table
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
    
    // Create trigger function for updated_at
    await (client as any).query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
        END;
        $$ language 'plpgsql';
    `);

    // Create trigger for commute_logs
    await (client as any).query(`
        DROP TRIGGER IF EXISTS update_commute_logs_updated_at ON commute_logs;
        CREATE TRIGGER update_commute_logs_updated_at
        BEFORE UPDATE ON commute_logs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    messages.push('تریگر به‌روزرسانی خودکار برای جدول "commute_logs" ایجاد شد.');

    // Create hourly_commute_logs table
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

    try {
      await client.sql`
        ALTER TABLE hourly_commute_logs ALTER COLUMN exit_time DROP NOT NULL;
      `;
      messages.push('ستون "exit_time" در جدول ترددهای ساعتی برای ثبت ورود مجزا به‌روزرسانی شد.');
    } catch (alterError: any) {
        console.warn(`Could not alter hourly_commute_logs table (this may be expected if already altered): ${alterError.message}`);
        messages.push('ستون "exit_time" از قبل به درستی تنظیم شده بود یا با خطای دیگری مواجه شد (این مورد در اجراهای بعدی طبیعی است).');
    }

    // Create trigger for hourly_commute_logs
    await (client as any).query(`
        DROP TRIGGER IF EXISTS update_hourly_commute_logs_updated_at ON hourly_commute_logs;
        CREATE TRIGGER update_hourly_commute_logs_updated_at
        BEFORE UPDATE ON hourly_commute_logs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    messages.push('تریگر به‌روزرسانی خودکار برای جدول "hourly_commute_logs" ایجاد شد.');

    // Create commute_edit_logs table
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
    messages.push('جدول "commute_edit_logs" برای ثبت ویرایش‌ها با موفقیت ایجاد یا تایید شد.');
    
    // Create app_users table
    await client.sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        permissions JSONB NOT NULL
      );
    `;
    messages.push('جدول "app_users" با موفقیت ایجاد یا تایید شد.');

    // Insert default users if they don't exist
    const adminPermissions = JSON.stringify({
      dashboard: true, personnel: true, recruitment: true, 
      security: true, settings: true, user_management: true 
    });
    const guardPermissions = JSON.stringify({
      dashboard: true, personnel: false, recruitment: false, 
      security: true, settings: false, user_management: false 
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

    try {
        await client.sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
        messages.push('افزونه "pg_trgm" برای جستجوی سریع فعال شد.');
        await client.sql`CREATE INDEX IF NOT EXISTS personnel_first_name_trgm_idx ON personnel USING gin (first_name gin_trgm_ops);`;
        await client.sql`CREATE INDEX IF NOT EXISTS personnel_last_name_trgm_idx ON personnel USING gin (last_name gin_trgm_ops);`;
        messages.push('ایندکس‌های جستجوی سریع (GIN) برای پرسنل ایجاد شدند.');
    } catch (extError) {
        console.warn('Could not create pg_trgm extension or GIN indexes:', extError);
        messages.push('هشدار: امکان فعال‌سازی افزونه "pg_trgm" یا ایندکس‌های GIN وجود نداشت. جستجو ممکن است کند باشد.');
    }
    
    await client.sql`CREATE INDEX IF NOT EXISTS personnel_last_first_name_idx ON personnel (last_name, first_name);`;
    messages.push('ایندکس مرتب‌سازی برای پرسنل ایجاد شد.');
    
    await (client as any).query('COMMIT');
    return response.status(200).json({ message: 'عملیات راه‌اندازی پایگاه داده با موفقیت انجام شد.', details: messages });
  
  } catch (error) {
    await (client as any).query('ROLLBACK').catch((rbError: any) => console.error('Rollback failed:', rbError));
    console.error('Database setup failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'ایجاد جداول در پایگاه داده با خطا مواجه شد.', details: errorMessage });
  } finally {
      client.release();
  }
}