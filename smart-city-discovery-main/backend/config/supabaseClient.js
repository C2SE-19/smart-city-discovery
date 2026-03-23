import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ywgmkbxibgognsuzxacd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3Z21rYnhpYmdvZ25zdXp4YWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODA3MzYsImV4cCI6MjA4ODc1NjczNn0.vEvjHyZG1dHoGhfhYy2vzToyddMhpzHLErLZffR8UsQ'

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase