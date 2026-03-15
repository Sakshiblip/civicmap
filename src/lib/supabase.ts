import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qluqaqlwtbjsdhikcfwv.supabase.co';
const supabaseKey = 'sb_publishable_krHY-gSJiuVFyEgjVuWLiA__N5VrjUG';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type IssueStatus = 'pending' | 'in_progress' | 'resolved';

export interface Issue {
  id: string;
  user_id: string;
  email: string;
  lat: number;
  lng: number;
  issue_type: string;
  description: string;
  image_urls: string[];
  status: IssueStatus;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}
