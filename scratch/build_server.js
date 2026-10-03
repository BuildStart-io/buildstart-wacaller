const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cd /opt/buildstart-calling-agent && docker run --rm -v /opt/buildstart-calling-agent:/app -w /app golang:1.22 go build -o /app/buildstart-calling-agent ./cmd/server && cp /opt/buildstart-calling-agent/buildstart-calling-agent /usr/local/bin/buildstart-calling-agent && systemctl restart buildstart-calling-agent.service`, (err, stream) => {
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
  password: 'JXRMVeRM7Wcq',
  readyTimeout: 30000
});
