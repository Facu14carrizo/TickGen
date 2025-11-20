import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Event {
  id: string;
  name: string;
  description: string;
  event_date: string;
  created_at: string;
  created_by: string;
}

export interface TicketDesign {
  id: string;
  event_id: string;
  background_image: string;
  title: string;
  subtitle: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  event_id: string;
  qr_code: string;
  is_used: boolean;
  used_at: string | null;
  ticket_number: number;
  created_at: string;
}
