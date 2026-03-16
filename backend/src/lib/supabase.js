const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ywgmkbxibgognsuzxacd.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3Z21rYnhpYmdvZ25zdXp4YWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODA3MzYsImV4cCI6MjA4ODc1NjczNn0.vEvjHyZG1dHoGhfhYy2vzToyddMhpzHLErLZffR8UsQ';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client for public (anon) operations
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Client for admin/service operations (use with caution, server-side only)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

module.exports = {
  supabaseClient,
  supabaseAdmin
};
