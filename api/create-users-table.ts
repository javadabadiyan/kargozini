import { createPool } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const QUERIES = [
  `
  CREATE TABLE IF NOT EXISTS personnel (
    id SERIAL PRIMARY KEY,
    personnel_code VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255),
    national_id VARCHAR(255) UNIQUE,
    id_number VARCHAR(255),
    birth_year VARCHAR(255),
    birth_date VARCHAR(255),
    birth_place VARCHAR(255),
    issue_date VARCHAR(255),
    issue_place VARCHAR(255),
    marital_status VARCHAR(255),
    military_status VARCHAR(255),
    job_title VARCHAR(255),
    "position" VARCHAR(255),
    employment_type VARCHAR(255),
    department VARCHAR(255),
    service_location VARCHAR(255),
    hire_date VARCHAR(255),
    education_level VARCHAR(255),
    field_of_study VARCHAR(255),
    job_group VARCHAR(255),
    sum_of_decree_factors VARCHAR(255),
    status VARCHAR(255),
    hire_month VARCHAR(255),
    total_insurance_history VARCHAR(255),
    mining_history VARCHAR(255),
    non_mining_history VARCHAR(255),
    group_distance_from_1404 VARCHAR(255),
    next_group_distance VARCHAR(255)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS dependents (
    id SERIAL PRIMARY KEY,
    personnel_code VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255),
    relation_type VARCHAR(255) NOT NULL,
    birth_date VARCHAR(255) NOT NULL,
    gender VARCHAR(255) NOT NULL,
    birth_month VARCHAR(255),
    birth_day VARCHAR(255),
    id_number VARCHAR(255),
    national_id VARCHAR(255) UNIQUE NOT NULL,
    guardian_national_id VARCHAR(255),
    issue_place VARCHAR(255),
    insurance_type VARCHAR(255)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS app_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    permissions JSONB,
    full_name VARCHAR(255),
    national_id VARCHAR(255)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS permission_roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS commuting_members (
      id SERIAL PRIMARY KEY,
      personnel_code VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      department VARCHAR(255),
      "position" VARCHAR(255)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS commute_logs (
      id SERIAL PRIMARY KEY,
      personnel_code VARCHAR(255) NOT NULL,
      guard_name VARCHAR(255) NOT NULL,
      entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      exit_time TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS hourly_commute_logs (
      id SERIAL PRIMARY KEY,
      personnel_code VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      guard_name VARCHAR(255) NOT NULL,
      exit_time TIMESTAMPTZ,
      entry_time TIMESTAMPTZ,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS commute_edit_logs (
      id SERIAL PRIMARY KEY,
      commute_log_id INTEGER REFERENCES commute_logs(id) ON DELETE CASCADE,
      personnel_code VARCHAR(255) NOT NULL,
      editor_name VARCHAR(255) NOT NULL,
      edit_timestamp TIMESTAMPTZ DEFAULT NOW(),
      field_name VARCHAR(255) NOT NULL,
      old_value VARCHAR(255),
      new_value VARCHAR(255)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS commitment_letters (
      id SERIAL PRIMARY KEY,
      recipient_name VARCHAR(255) NOT NULL,
      recipient_national_id VARCHAR(20) NOT NULL,
      guarantor_personnel_code VARCHAR(50) NOT NULL,
      guarantor_name VARCHAR(255) NOT NULL,
      guarantor_national_id VARCHAR(20) NOT NULL,
      loan_amount NUMERIC(15, 2) NOT NULL,
      sum_of_decree_factors NUMERIC(15, 2) NOT NULL,
      bank_name VARCHAR(255),
      branch_name VARCHAR(255),
      issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
      reference_number VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS disciplinary_records (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      personnel_code VARCHAR(50) NOT NULL,
      meeting_date VARCHAR(50),
      letter_description TEXT,
      final_decision TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS personnel_documents (
      id SERIAL PRIMARY KEY,
      personnel_code VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(100) NOT NULL,
      file_data TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS performance_reviews (
      id SERIAL PRIMARY KEY,
      personnel_code VARCHAR(50) NOT NULL,
      department VARCHAR(255),
      review_period_start VARCHAR(50) NOT NULL,
      review_period_end VARCHAR(50) NOT NULL,
      scores_functional JSONB NOT NULL,
      scores_behavioral JSONB NOT NULL,
      scores_ethical JSONB NOT NULL,
      total_score_functional NUMERIC NOT NULL,
      total_score_behavioral NUMERIC NOT NULL,
      total_score_ethical NUMERIC NOT NULL,
      overall_score NUMERIC NOT NULL,
      reviewer_comment TEXT NOT NULL,
      strengths TEXT NOT NULL,
      weaknesses_and_improvements TEXT NOT NULL,
      supervisor_suggestions TEXT NOT NULL,
      reviewer_name_and_signature VARCHAR(255) NOT NULL,
      supervisor_signature VARCHAR(255),
      manager_signature VARCHAR(255),
      review_date TIMESTAMPTZ DEFAULT NOW(),
      submitted_by_user VARCHAR(255) NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS bonuses (
    id SERIAL PRIMARY KEY,
    personnel_code VARCHAR(255) NOT NULL,
    year INT NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    "position" VARCHAR(255),
    service_location VARCHAR(255),
    submitted_by_user VARCHAR(255),
    monthly_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(personnel_code, year, submitted_by_user)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS submitted_bonuses (
    id SERIAL PRIMARY KEY,
    personnel_code VARCHAR(255) NOT NULL,
    year INT NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    "position" VARCHAR(255),
    service_location VARCHAR(255),
    submitted_by_user TEXT,
    monthly_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(personnel_code, year)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS bonus_edit_logs (
    id SERIAL PRIMARY KEY,
    bonus_id INT,
    personnel_code VARCHAR(255) NOT NULL,
    year INT NOT NULL,
    month VARCHAR(50),
    editor_username VARCHAR(255) NOT NULL,
    edit_timestamp TIMESTAMPTZ DEFAULT NOW(),
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB
  );
  `
];

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (!process.env.POSTGRES_URL) {
    return response.status(500).json({ error: "Database connection string (POSTGRES_URL) is not configured." });
  }
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();
  const createdTables: string[] = [];

  try {
    await client.query('BEGIN');
    for (const query of QUERIES) {
      await client.query(query);
    }
    await client.query('COMMIT');
    return response.status(200).json({ message: "All tables created successfully or already exist." });
  } catch (error) {
    await client.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Error in create-users-table:", error);
    return response.status(500).json({ error: 'Failed to initialize database.', details: errorMessage });
  } finally {
    client.release();
  }
}
