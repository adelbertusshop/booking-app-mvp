export interface Provider {
  id: string
  slug: string
  name: string
  description?: string
  business_type?: 'hair' | 'barber' | 'beauty' | 'nails' | 'it' | 'other'
  logo_url?: string
  timezone: string
  working_hours: WorkingHours
  terms?: string
  default_buffer_before: number
  default_buffer_after: number
  require_confirmation_hours: number
  quarantine_after_no_show: number
  created_at: string
  updated_at: string
}

export interface WorkingHours {
  [key: string]: {
    open: string
    close: string
    breaks: Array<{ start: string; end: string }>
  } | null
}

export interface Service {
  id: string
  provider_id: string
  name: string
  description?: string
  duration_minutes: number
  price?: number
  color: string
  min_advance_hours: number
  max_advance_days: number
  allow_online_booking: boolean
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Client {
  id: string
  provider_id: string
  first_name: string
  last_name?: string
  email?: string
  phone?: string
  tags: string[]
  no_show_count: number
  late_cancel_count: number
  late_arrival_count: number
  total_visits: number
  last_visit_date?: string
  notes?: string
  gdpr_consent: boolean
  gdpr_consent_date?: string
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  provider_id: string
  service_id?: string
  client_id?: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'cancelled_by_provider' | 'rescheduled'
  confirmation_required: boolean
  confirmation_sent_at?: string
  confirmed_at?: string
  confirmation_deadline?: string
  source: 'online' | 'phone' | 'walk_in' | 'waitlist'
  notes?: string
  cancellation_reason?: string
  created_at: string
  updated_at: string
  clients?: Client
  services?: Service
  providers?: Provider
}

export interface WaitlistEntry {