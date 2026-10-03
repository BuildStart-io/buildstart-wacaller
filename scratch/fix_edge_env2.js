const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`sed -i 's/wacaller.bandara.me/wacaller.buildstart.io/' /root/supabase/supabase/docker/.env && cd /root/supabase/supabase/docker && docker compose up -d`, (err, stream) => {
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
