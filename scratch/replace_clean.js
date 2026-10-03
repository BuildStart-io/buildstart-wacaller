const fs = require('fs');

const functions = ['agent-sync-wacaller', 'wa-pair-wacaller', 'get-calls-wacaller', 'schedule-call-wacaller'];

for (const fn of functions) {
  const path = `supabase/functions/${fn}/index.ts`;
  let content = fs.readFileSync(path, 'utf8');
  
  const oldStr1 = `    const supabaseWacaller = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'wacaller_customization' } });
    const { data: userData, error: userError } = await supabaseWacaller
      .from('users')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.business_id) {
      return new Response(JSON.stringify({ error: "User or business not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const businessId = userData.business_id;`;

  const oldStr2 = `    const supabaseWacaller = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'wacaller_customization' } });
    const { data: userData, error: userError } = await supabaseWacaller
      .from('users')
      .select('business_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.business_id) {
      return new Response(JSON.stringify({ error: "User or business not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const businessId = userData.business_id;`;
    
  const oldStr3 = `    // Get the business_id from wacaller_customization.users
    const supabaseWacaller = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'wacaller_customization' } });
    const { data: userData, error: userError } = await supabaseWacaller
      .from('users')
      .select('business_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.business_id) {
      return new Response(JSON.stringify({ error: "User or business not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const businessId = userData.business_id;`;

  const replacement = `    const supabaseWacaller = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'wacaller_customization' } });
    
    // Check if the user is a staff member
    const { data: staffData } = await supabaseWacaller
      .from('staff_accounts')
      .select('owner_id')
      .eq('staff_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const businessId = staffData?.owner_id || user.id;`;
    
  // Since agent-sync-wacaller declares businessId differently (earlier version had it inside/outside)
  // Let me just replace the specific strings.
  
  // Actually agent-sync-wacaller is slightly different:
  const agentSyncRegex = /\/\/ Get the business_id from wacaller_customization\.users[\s\S]*?const businessId = userData\.business_id;/m;
  
  if (fn === 'agent-sync-wacaller') {
    content = content.replace(agentSyncRegex, replacement);
  } else {
    content = content.replace(oldStr1, replacement);
  }
  
  fs.writeFileSync(path, content, 'utf8');
  console.log(`Replaced in ${fn}`);
}
