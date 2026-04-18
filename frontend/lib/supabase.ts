// This file creates and exports a single Supabase client instance for the frontend.
// We import it wherever we need to interact with Supabase — auth, database, etc.
// Using a single shared instance avoids creating multiple connections.
import { createClient } from '@supabase/supabase-js';

// These environment variables are loaded from .env.local
// The NEXT_PUBLIC_ prefix means Next.js exposes them to the browser (not just the server)
// Without NEXT_PUBLIC_, the variable would be undefined on the client side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createClient initializes the connection to our Supabase project
// supabaseUrl: the unique URL of our Supabase database
// supabaseAnonKey: a public key that allows safe read/write access based on RLS policies
export const supabase = createClient(supabaseUrl, supabaseAnonKey);