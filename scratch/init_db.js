const { Client } = require('ssh2');
const fs = require('fs');

const sql = fs.readFileSync('/home/anuhas/.gemini/antigravity-ide/brain/983c03b6-afbd-4548-87f8-da927bc4ef04/scratch/db_init.sql', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat > /tmp/db_init.sql && docker exec -i supabase-db psql -U postgres -d postgres < /tmp/db_init.sql`, (err, stream) => {
    if (err) throw err;
    stream.write(sql);
    stream.end();
    
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT: ' + out);
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '178.104.127.220',
  port: 22,
  username: 'root',
  password: 'JXRMVeRM7Wcq'
});
