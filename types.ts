import React from 'react';

export interface MenuItem {
  id: string;
  label:string;
  icon: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
  page?: React.ComponentType;
}

export interface Personnel {
  id: number;
  personnel_code: string;
  first_name: string;
  last_name: string;
  father_name: string;
  national_id: string;
  id_number: string;
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
  status: string;
}

export interface Dependent {
  id: number;
  personnel_code: string;
  relation_type: string;
  first_name: string;
  last_name: string;
  national_id: string;
  birth_date: string;
  gender: string;
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
