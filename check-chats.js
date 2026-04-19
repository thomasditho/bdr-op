import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://ifxbrtlelvmnckicscwi.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeGJydGxlbHZtbmNraWNzY3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzE0OTAsImV4cCI6MjA5MDY0NzQ5MH0.9JMwkQXbpUZWK4w7-wsVdjlaFEuvejqYPtZCVpRPV9I');

async function check() {
  const { data: chats, error } = await supabase.from('evo_chats').select('*');
  console.log('Chats in DB (count):', chats ? chats.length : 0);
  console.log('Full chats data:', JSON.stringify(chats, null, 2));
  if(error) console.error(error);
}

check();
