const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`docker exec supabase-db psql -U postgres -d postgres -c "SELECT call_id, transcript_json::text from whatsapp_infra.call_logs order by started_at desc limit 2;"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => { console.log(out); conn.end(); });
    stream.on('data', (d) => { out += d.toString(); });
    stream.stderr.on('data', (d) => { out += 'STDERR: ' + d.toString(); });
  });
}).on('error', (err) => {
  console.error("SSH ERROR:", err.message);
}).connect({ host: '178.104.127.220', port: 22, username: 'root', password: 'JXRMVeRM7Wcq', readyTimeout: 10000 });
