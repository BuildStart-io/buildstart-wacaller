const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut('/home/anuhas/programming/calling-agent-development/buildstart-calling-agent/cmd/server/httpapi.go', '/opt/buildstart-calling-agent/cmd/server/httpapi.go', (err1) => {
      if (err1) throw err1;
      console.log('Uploaded httpapi.go');
      conn.exec(`cd /opt/buildstart-calling-agent && docker run --rm -v /opt/buildstart-calling-agent:/app -w /app golang:latest go build -o /app/buildstart-calling-agent ./cmd/server && cp /opt/buildstart-calling-agent/buildstart-calling-agent /usr/local/bin/buildstart-calling-agent && systemctl restart buildstart-calling-agent.service`, (err3, stream) => {
        stream.on('close', () => { console.log('Done'); conn.end(); });
        stream.on('data', d => console.log('STDOUT: ' + d));
        stream.stderr.on('data', d => console.log('STDERR: ' + d));
      });
    });
  });
}).connect({
  host: '178.104.127.220',
  port: 22,
  username: 'root',
  password: 'JXRMVeRM7Wcq',
  readyTimeout: 30000
});
