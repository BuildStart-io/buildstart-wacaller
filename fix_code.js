const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Fix createClient calls
      content = content.replace(/createClient\(([^,]+),\s*([^,\)]+)\)/g, "createClient($1, $2, { db: { schema: 'wacaller_customization' } })");
      
      content = content.replace(/createClient\(([^,]+),\s*([^,]+),\s*\{/g, "createClient($1, $2, { db: { schema: 'wacaller_customization' }, ");

      // Avoid double nesting if we ran it multiple times (safety)
      content = content.replace(/db: \{ schema: 'wacaller_customization' \}, db: \{ schema: 'wacaller_customization' \}/g, "db: { schema: 'wacaller_customization' }");

      // Fix invoke calls
      content = content.replace(/'([\w-]+)'/g, (match, p1) => {
        const edgeFunctions = [
          'admin-manage-users', 'ai-chat', 'assetlinks', 'main', 'manage-staff', 
          'media-storage', 'process-message', 'register-device', 'send-followups', 
          'send-push', 'send-whatsapp', 'sync-usage-crm', 'sync-usage-crm-global', 
          'webhook-wsender', 'wsender-sessions', 'broadcast-manager'
        ];
        if (edgeFunctions.includes(p1)) {
          return `'${p1}-wacaller'`;
        }
        return match;
      });
      content = content.replace(/"([\w-]+)"/g, (match, p1) => {
        const edgeFunctions = [
          'admin-manage-users', 'ai-chat', 'assetlinks', 'main', 'manage-staff', 
          'media-storage', 'process-message', 'register-device', 'send-followups', 
          'send-push', 'send-whatsapp', 'sync-usage-crm', 'sync-usage-crm-global', 
          'webhook-wsender', 'wsender-sessions', 'broadcast-manager'
        ];
        if (edgeFunctions.includes(p1)) {
          return `"${p1}-wacaller"`;
        }
        return match;
      });

      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir('./supabase/functions');
processDir('./frontend/src');
