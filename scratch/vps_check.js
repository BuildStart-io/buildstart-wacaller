const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`echo "=== NGINX CONFIG ===" && cat /etc/nginx/sites-enabled/* 2>/dev/null && echo "=== SERVICE STATUS ===" && systemctl status buildstart-calling-agent.service --no-pager -l | head -20`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => { console.log(out); conn.end(); });
    stream.on('data', (d) => { out += d.toString(); });
    stream.stderr.on('data', (d) => { out += 'STDERR: ' + d.toString(); });
  });
}).on('error', (err) => {
  console.error("SSH ERROR:", err.message);
}).connect({ host: '178.104.127.220', port: 22, username: 'root', password: 'JXRMVeRM7Wcq', readyTimeout: 30000 });
