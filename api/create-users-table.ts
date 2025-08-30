import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const messages: string[] = [];
  try {
    // Note: "position" is a reserved SQL keyword, so it's enclosed in double quotes.
    await sql`
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

    let extensionCreated = false;
    try {
        await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
        messages.push('افزونه "pg_trgm" برای جستجوی سریع با موفقیت فعال شد.');
        extensionCreated = true;
    } catch (extError) {
        console.warn('Could not create pg_trgm extension:', extError);
        messages.push('هشدار: امکان فعال‌سازی افزونه "pg_trgm" وجود نداشت. این ممکن است به دلیل سطح دسترسی پایگاه داده باشد. جستجو در لیست پرسنل ممکن است کند باشد.');
    }
    
    if (extensionCreated) {
        try {
            await sql`CREATE INDEX IF NOT EXISTS personnel_first_name_trgm_idx ON personnel USING gin (first_name gin_trgm_ops);`;
            await sql`CREATE INDEX IF NOT EXISTS personnel_last_name_trgm_idx ON personnel USING gin (last_name gin_trgm_ops);`;
            messages.push('ایندکس‌های جستجوی سریع (GIN) با موفقیت ایجاد شدند.');
        } catch (ginIndexError) {
            console.warn('Could not create GIN indexes:', ginIndexError);
            messages.push('هشدار: امکان ایجاد ایندکس‌های GIN برای جستجوی سریع وجود نداشت.');
        }
    }
    
    try {
        await sql`CREATE INDEX IF NOT EXISTS personnel_last_first_name_idx ON personnel (last_name, first_name);`;
        messages.push('ایندکس مرتب‌سازی برای افزایش سرعت با موفقیت ایجاد شد.');
    } catch (sortIndexError) {
        console.warn('Could not create sorting index:', sortIndexError);
        messages.push('هشدار: امکان ایجاد ایندکس مرتب‌سازی وجود نداشت.');
    }

    return response.status(200).json({ message: 'عملیات راه‌اندازی پایگاه داده انجام شد.', details: messages });
  } catch (error) {
    console.error('Database table creation failed catastrophically:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return response.status(500).json({ error: 'ایجاد جدول اصلی "personnel" در پایگاه داده با خطا مواجه شد.', details: errorMessage });
  }
}