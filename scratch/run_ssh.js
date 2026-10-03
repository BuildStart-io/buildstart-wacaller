const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`docker exec supabase-db psql -U postgres -d postgres -c "ALTER TABLE wacaller_customization.products ADD COLUMN IF NOT EXISTS add_to_calling_agent BOOLEAN DEFAULT true; ALTER TABLE wacaller_customization.faqs ADD COLUMN IF NOT EXISTS add_to_calling_agent BOOLEAN DEFAULT true;" && docker ps | grep functions`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
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
