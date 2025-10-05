// types.ts

import React from 'react';

// FIX: Removed index signature `[key: string]: boolean;` to ensure `keyof UserPermissions` is a union of string literals.
export interface UserPermissions {
  dashboard?: boolean;
  personnel?: boolean;
  personnel_list?: boolean;
  dependents_info?: boolean;
  document_upload?: boolean;
  recruitment?: boolean;
  accounting_commitment?: boolean;
  disciplinary_committee?: boolean;
  performance_review?: boolean;
  send_performance_review?: boolean;
  archive_performance_review?: boolean;
  job_group?: boolean;
  bonus_management?: boolean;
  enter_bonus?: boolean;
  submitted_bonuses?: boolean;
  bonus_analyzer?: boolean;
  security?: boolean;
  commuting_members?: boolean;
  log_commute?: boolean;
  commute_report?: boolean;
  settings?: boolean;
  user_management?: boolean;
}

export interface AppUser {
  id: number;
  username: string;
  password?: string;
  permissions: UserPermissions;
  full_name?: string;
  national_id?: string;
}

export interface MenuItem {
  id: keyof UserPermissions;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  page?: React.ComponentType<any>;
  children?: MenuItem[];
}

export interface Personnel {
  id: number;
  personnel_code: string;
  first_name: string;
  last_name: string;
  father_name: string;
  national_id: string;
  id_number: string;
  birth_year: string | null;
  birth_date: string | null;
  birth_place: string | null;
  issue_date: string | null;
  issue_place: string | null;
  marital_status: string | null;
  military_status: string | null;
  job_title: string | null;
  position: string | null;
  employment_type: string | null;
  department: string | null;
  service_location: string | null;
  hire_date: string | null;
  education_level: string | null;
  field_of_study: string | null;
  job_group: string | null;
  sum_of_decree_factors: string | number | null;
  status: string | null;
  // Fields from JobGroupPage
  hire_month?: string | null;
  total_insurance_history?: string | null;
  mining_history?: string | null;
  non_mining_history?: string | null;
  group_distance_from_1404?: string | null;
  next_group_distance?: string | null;
}

export interface Dependent {
    id: number;
    personnel_code: string;
    first_name: string;
    last_name: string;
    father_name: string | null;
    relation_type: string;
    birth_date: string;
    gender: string;
    birth_month: string | null;
    birth_day: string | null;
    id_number: string | null;
    national_id: string;
    guardian_national_id: string | null;
    issue_place: string | null;
    insurance_type: string | null;
}

export interface CommutingMember {
  id: number;
  personnel_code: string;
  full_name: string;
  department: string;
  position: string;
}

export interface CommuteLog {
  id: number;
  personnel_code: string;
  full_name: string;
  guard_name: string;
  entry_time: string;
  exit_time: string | null;
}

export interface HourlyCommuteLog {
    id: number;
    personnel_code: string;
    full_name: string;
    guard_name: string;
    exit_time: string | null;
    entry_time: string | null;
    reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface CommuteReportRow {
  log_id: number;
  personnel_code: string;
  full_name: string;
  department: string;
  position: string;
  entry_time: string;
  exit_time: string | null;
  guard_name: string;
}

export interface PresentMember {
  log_id: number;
  full_name: string;
  personnel_code: string;
  department: string;
  position: string;
  entry_time: string;
}

export interface HourlyCommuteReportRow {
    log_id: number;
    personnel_code: string;
    full_name: string;
    department: string;
    position: string;
    exit_time: string | null;
    entry_time: string | null;
    reason: string | null;
    guard_name: string;
}

export interface CommuteEditLog {
    id: number;
    commute_log_id: number;
    personnel_code: string;
    full_name: string;
    editor_name: string;
    edit_timestamp: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    record_date: string;
}

export interface CommitmentLetter {
  id: number;
  recipient_name: string;
  recipient_national_id: string;
  guarantor_personnel_code: string;
  guarantor_name: string;
  guarantor_national_id: string;
  loan_amount: number;
  sum_of_decree_factors: number;
  bank_name: string | null;
  branch_name: string | null;
  issue_date: string;
  reference_number: string | null;
  created_at: string;
}

export interface DisciplinaryRecord {
  id: number;
  full_name: string;
  personnel_code: string;
  meeting_date: string | null;
  letter_description: string | null;
  final_decision: string | null;
}

export interface PersonnelDocument {
    id: number;
    personnel_code: string;
    title: string;
    file_name: string;
    file_type: string;
    uploaded_at: string;
}

export interface PerformanceReview {
    id: number;
    personnel_code: string;
    full_name?: string; // from join
    department?: string;
    review_period_start: string;
    review_period_end: string;
    scores_functional: { [key: string]: number };
    scores_behavioral: { [key: string]: number };
    scores_ethical: { [key: string]: number };
    total_score_functional: number;
    total_score_behavioral: number;
    total_score_ethical: number;
    overall_score: number;
    reviewer_comment: string;
    strengths: string;
    weaknesses_and_improvements: string;
    supervisor_suggestions: string;
    reviewer_name_and_signature: string;
    supervisor_signature: string | null;
    manager_signature: string | null;
    review_date: string;
    submitted_by_user: string;
}

export interface BonusData {
    id: number;
    personnel_code: string;
    year: number;
    first_name: string;
    last_name: string;
    position: string;
    service_location?: string;
    submitted_by_user?: string;
    monthly_data: {
        [month: string]: {
            bonus: number;
            department: string;
        };
    };
}