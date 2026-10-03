const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`sed -i 's/data.type === "qr"/data.type === "session-qr"/g' /opt/buildstart-calling-agent/client/src/components/settings/VoiceAgentConnection.tsx || true`, (err, stream) => {
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
