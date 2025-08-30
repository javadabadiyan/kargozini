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
