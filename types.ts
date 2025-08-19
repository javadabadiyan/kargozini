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
  job: string;
  position: string;
  employment_type: string;
  unit: string;
  service_place: string;
  employment_date: string;
  education_degree: string;
  field_of_study: string;
  status: string;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  permissions: string[];
}

export interface AppSettings {
  app_name: string;
  app_logo: string | null; // base64 string
}