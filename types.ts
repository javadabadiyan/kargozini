import React from 'react';

export interface MenuItem {
  id: string;
  label:string;
  icon: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
  page?: React.ComponentType;
}

export interface BonusPermissionFilters {
  departments?: string[];
  positions?: string[];
  service_locations?: string[];
}

export interface UserPermissions {
  [key: string]: boolean | BonusPermissionFilters | undefined;
  enter_bonus_filters?: BonusPermissionFilters;
}


export interface AppUser {
  id: number;
  username: string;
  password?: string; // Only for sending to API, not for receiving
  permissions: UserPermissions;
  full_name?: string;
  national_id?: string;
}

export interface PermissionRole {
  id: number;
  role_name: string;
  permissions: UserPermissions;
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
  birth_date: string;
  birth_place: string;
  issue_date: string;
  issue_place: string;
  marital_status: string;
  military_status: string;
  job_title: string;
  position: string;
  employment_type: string;
  department: string;
  service_location: string;
  hire_date: string;
  education_level: string;
  field_of_study: string;
  job_group: string | null;
  sum_of_decree_factors: string | null;
  status: string;
  // New fields for Job Group Info
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
  full_name: string;
  personnel_code: string;
  department: string;
  position: string;
}

export interface CommuteLog {
  id: number;
  personnel_code: string;
  full_name?: string; // from JOIN
  guard_name: string;
  entry_time: string; // ISO string from DB
  exit_time: string | null; // ISO string from DB or null
}

export interface HourlyCommuteLog {
  id: number;
  personnel_code: string;
  full_name: string;
  exit_time: string | null; // ISO string from DB
  entry_time: string | null; // ISO string from DB or null
  reason: string | null;
  guard_name: string;
}

export interface CommuteReportRow {
  log_id: number;
  personnel_code: string;
  full_name: string;
  department: string | null;
  position: string | null;
  entry_time: string;
  exit_time: string | null;
  guard_name: string;
}

export interface PresentMember {
  log_id: number;
  full_name: string;
  personnel_code: string;
  department: string | null;
  position: string | null;
  entry_time: string;
}

export interface HourlyCommuteReportRow {
  log_id: number;
  personnel_code: string;
  full_name: string;
  department: string | null;
  position: string | null;
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

export interface PersonnelDocument {
  id: number;
  personnel_code: string;
  title: string;
  file_name: string;
  file_type: string;
  file_data?: string; // base64 encoded, optional for list view
  uploaded_at: string; // ISO string
}

export interface CommitmentLetter {
  id: number;
  recipient_name: string;
  recipient_national_id: string;
  guarantor_personnel_code: string;
  guarantor_name: string;
  guarantor_national_id: string;
  loan_amount: number;
  sum_of_decree_factors: number | null;
  bank_name: string | null;
  branch_name: string | null;
  issue_date: string;
  reference_number: string | null;
  created_at?: string;
}

export interface DisciplinaryRecord {
  id: number;
  full_name: string;
  personnel_code: string;
  meeting_date: string | null;
  letter_description: string | null;
  final_decision: string | null;
}

export interface PerformanceReview {
  id: number;
  personnel_code: string;
  full_name?: string; // From a join, not in the table
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
  review_date: string; // ISO string
  reviewer_name_and_signature?: string;
  supervisor_signature?: string;
  manager_signature?: string;
  submitted_by_user?: string;
  department?: string;
}

export interface BonusData {
    id: number;
    personnel_code: string;
    first_name: string;
    last_name: string;
    position: string | null;
    service_location: string | null;
    monthly_data: { [month: string]: { bonus: number; department: string; } } | null;
    submitted_by_user?: string;
}

export interface BonusEditLog {
    id: number;
    bonus_id: number | null;
    personnel_code: string;
    editor_name: string;
    edit_timestamp: string; // ISO string
    month: string;
    old_bonus_value: number | null;
    new_bonus_value: number | null;
    old_department: string | null;
    new_department: string | null;
    // For joins
    full_name?: string;
}