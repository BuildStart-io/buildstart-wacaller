const { Client } = require('ssh2');

const sql = `
GRANT USAGE ON SCHEMA whatsapp_infra TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA whatsapp_infra TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA whatsapp_infra TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA whatsapp_infra TO service_role;

GRANT USAGE ON SCHEMA whatsapp_infra TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA whatsapp_infra TO postgres;

-- Also just in case, anon and authenticated
GRANT USAGE ON SCHEMA whatsapp_infra TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA whatsapp_infra TO anon, authenticated;
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`docker exec -i supabase-db psql -U postgres -d postgres`, (err, stream) => {
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
