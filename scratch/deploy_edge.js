const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  const fileContent = fs.readFileSync('/home/anuhas/programming/calling-agent-development/buildstart-wacaller/supabase/functions/wa-pair-wacaller/index.ts', 'utf8');
  conn.exec(`cat > /var/www/buildstart/supabase/functions/wa-pair-wacaller/index.ts`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => { console.log("Uploaded successfully. " + out); conn.end(); });
    stream.on('data', (d) => { out += d.toString(); });
    stream.stderr.on('data', (d) => { out += 'STDERR: ' + d.toString(); });
    stream.write(fileContent);
    stream.end();
  });
}).on('error', (err) => {
  console.error("SSH ERROR:", err.message);
}).connect({ host: '178.104.127.220', port: 22, username: 'root', password: 'JXRMVeRM7Wcq', readyTimeout: 10000 });
