const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`
    sed -i '/container_name: supabase-db/!b;n;a\\    ports:\\n      - "127.0.0.1:5433:5432"' /root/supabase/supabase/docker/docker-compose.yml &&
    cd /root/supabase/supabase/docker && 
    docker compose up -d
  `, (err, stream) => {
    if (err) throw err;
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
