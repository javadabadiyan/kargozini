import { sql } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    let result;
    
    // Create app_users table
    await sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        permissions JSONB,
        full_name VARCHAR(255),
        national_id VARCHAR(20)
      );
    `;

    // Create permission_roles table
    await sql`
      CREATE TABLE IF NOT EXISTS permission_roles (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(255) UNIQUE NOT NULL,
        permissions JSONB NOT NULL
      );
    `;

    // Create personnel table
    await sql`
      CREATE TABLE IF NOT EXISTS personnel (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100),
        national_id VARCHAR(20) UNIQUE,
        id_number VARCHAR(20),
        birth_year VARCHAR(10),
        birth_date VARCHAR(20),
        birth_place VARCHAR(100),
        issue_date VARCHAR(20),
        issue_place VARCHAR(100),
        marital_status VARCHAR(50),
        military_status VARCHAR(50),
        job_title VARCHAR(100),
        "position" VARCHAR(100),
        employment_type VARCHAR(100),
        department VARCHAR(100),
        service_location VARCHAR(100),
        hire_date VARCHAR(20),
        education_level VARCHAR(100),
        field_of_study VARCHAR(100),
        job_group VARCHAR(50),
        sum_of_decree_factors VARCHAR(50),
        status VARCHAR(50),
        hire_month VARCHAR(10),
        total_insurance_history VARCHAR(50),
        mining_history VARCHAR(50),
        non_mining_history VARCHAR(50),
        group_distance_from_1404 VARCHAR(50),
        next_group_distance VARCHAR(50)
      );
    `;

    // Create dependents table
    await sql`
      CREATE TABLE IF NOT EXISTS dependents (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL REFERENCES personnel(personnel_code) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100),
        relation_type VARCHAR(50),
        birth_date VARCHAR(20),
        gender VARCHAR(20),
        birth_month VARCHAR(10),
        birth_day VARCHAR(10),
        id_number VARCHAR(20),
        national_id VARCHAR(20) NOT NULL,
        guardian_national_id VARCHAR(20),
        issue_place VARCHAR(100),
        insurance_type VARCHAR(50),
        UNIQUE(personnel_code, national_id)
      );
    `;

     // Create commuting_members table
    await sql`
      CREATE TABLE IF NOT EXISTS commuting_members (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        department VARCHAR(100),
        "position" VARCHAR(100)
      );
    `;

    // Create commute_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS commute_logs (
          id SERIAL PRIMARY KEY,
          personnel_code VARCHAR(50) NOT NULL,
          guard_name VARCHAR(255) NOT NULL,
          entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          exit_time TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

     // Create hourly_commute_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS hourly_commute_logs (
          id SERIAL PRIMARY KEY,
          personnel_code VARCHAR(50) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          guard_name VARCHAR(255) NOT NULL,
          exit_time TIMESTAMPTZ,
          entry_time TIMESTAMPTZ,
          reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create commute_edit_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS commute_edit_logs (
          id SERIAL PRIMARY KEY,
          commute_log_id INTEGER NOT NULL REFERENCES commute_logs(id) ON DELETE CASCADE,
          personnel_code VARCHAR(50) NOT NULL,
          editor_name VARCHAR(255) NOT NULL,
          edit_timestamp TIMESTAMPTZ DEFAULT NOW(),
          field_name VARCHAR(50) NOT NULL,
          old_value TEXT,
          new_value TEXT
      );
    `;

    // Create personnel_documents table
    await sql`
      CREATE TABLE IF NOT EXISTS personnel_documents (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL REFERENCES personnel(personnel_code) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_data TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    // Create commitment_letters table
    await sql`
      CREATE TABLE IF NOT EXISTS commitment_letters (
        id SERIAL PRIMARY KEY,
        recipient_name VARCHAR(255) NOT NULL,
        recipient_national_id VARCHAR(20) NOT NULL,
        guarantor_personnel_code VARCHAR(50) NOT NULL,
        guarantor_name VARCHAR(255) NOT NULL,
        guarantor_national_id VARCHAR(20),
        loan_amount NUMERIC(15, 2) NOT NULL,
        sum_of_decree_factors NUMERIC(15, 2),
        bank_name VARCHAR(100),
        branch_name VARCHAR(100),
        issue_date DATE DEFAULT CURRENT_DATE,
        reference_number VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    // Create disciplinary_records table
    await sql`
      CREATE TABLE IF NOT EXISTS disciplinary_records (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        personnel_code VARCHAR(50) NOT NULL,
        meeting_date VARCHAR(20),
        letter_description TEXT,
        final_decision TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    // Create performance_reviews table
    await sql`
      CREATE TABLE IF NOT EXISTS performance_reviews (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL,
        review_period_start VARCHAR(20) NOT NULL,
        review_period_end VARCHAR(20) NOT NULL,
        scores_functional JSONB,
        scores_behavioral JSONB,
        scores_ethical JSONB,
        total_score_functional NUMERIC(5, 2),
        total_score_behavioral NUMERIC(5, 2),
        total_score_ethical NUMERIC(5, 2),
        overall_score NUMERIC(5, 2),
        reviewer_comment TEXT,
        strengths TEXT,
        weaknesses_and_improvements TEXT,
        supervisor_suggestions TEXT,
        review_date TIMESTAMPTZ DEFAULT NOW(),
        reviewer_name_and_signature VARCHAR(255),
        supervisor_signature VARCHAR(255),
        manager_signature VARCHAR(255),
        submitted_by_user VARCHAR(255),
        department VARCHAR(100)
      );
    `;

    // Create bonuses table
    await sql`
      CREATE TABLE IF NOT EXISTS bonuses (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL,
        "year" INTEGER NOT NULL,
        submitted_by_user VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        "position" VARCHAR(100),
        monthly_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(personnel_code, "year", submitted_by_user)
      );
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS submitted_bonuses (
        id SERIAL PRIMARY KEY,
        personnel_code VARCHAR(50) NOT NULL,
        "year" INTEGER NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        "position" VARCHAR(100),
        monthly_data JSONB,
        submitted_by_user TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(personnel_code, "year")
      );
    `;

    result = await sql`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';`;

    return response.status(200).json({ 
        message: 'All tables created successfully or already exist.',
        tables: result.rows.map(r => r.tablename)
    });
  } catch (error) {
    return response.status(500).json({ error });
  }
}
