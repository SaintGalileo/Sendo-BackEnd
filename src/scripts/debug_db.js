const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkColumns() {
  const { data, error } = await supabase.from('users').select('*').limit(1).single();
  if (error) {
    console.error(error);
    return;
  }
  console.log('--- User Columns ---');
  console.log(Object.keys(data));
  console.log('--- Sample User ---');
  console.log(JSON.stringify(data, null, 2));
}

checkColumns();
