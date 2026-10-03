const fs = require('fs');

const functions = ['agent-sync-wacaller', 'wa-pair-wacaller', 'get-calls-wacaller', 'schedule-call-wacaller'];

for (const fn of functions) {
  const path = `supabase/functions/${fn}/index.ts`;
  let content = fs.readFileSync(path, 'utf8');
  
  const replacement = `const supabaseWacaller = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'wacaller_customization' } });
    
    // Check if the user is a staff member
    const { data: staffData } = await supabaseWacaller
      .from('staff_accounts')
      .select('owner_id')
      .eq('staff_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const businessId = staffData?.owner_id || user.id;`;
    
  const regex2 = /const\s+supabaseWacaller\s*=\s*createClient[^;]+;\s*(?:\/\/[^\n]*\n\s*)*const\s+\{\s*data:\s*userData\s*,\s*error:\s*userError\s*\}\s*=\s*await\s+supabaseWacaller[\s\S]*?\.single\(\);\s*if\s*\([^)]*\)\s*\{[\s\S]*?\}/m;
  
  if (regex2.test(content)) {
    content = content.replace(regex2, replacement);
    content = content.replace(/const\s+businessId\s*=\s*userData\.business_id;/g, '');
    fs.writeFileSync(path, content, 'utf8');
    console.log(`Replaced in ${fn}`);
  } else {
    console.log(`Pattern not found in ${fn}`);
  }
}
