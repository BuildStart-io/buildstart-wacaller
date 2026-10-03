const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut('/home/anuhas/programming/calling-agent-development/buildstart-calling-agent/cmd/server/broker.go', '/opt/buildstart-calling-agent/cmd/server/broker.go', (err1) => {
      if (err1) throw err1;
      sftp.fastPut('/home/anuhas/programming/calling-agent-development/buildstart-calling-agent/cmd/server/sessionmanager.go', '/opt/buildstart-calling-agent/cmd/server/sessionmanager.go', (err2) => {
        if (err2) throw err2;
        sftp.fastPut('/home/anuhas/programming/calling-agent-development/buildstart-calling-agent/cmd/server/session.go', '/opt/buildstart-calling-agent/cmd/server/session.go', (err3) => {
          if (err3) throw err3;
          console.log('Uploaded files');
          conn.exec(`cd /opt/buildstart-calling-agent && docker run --rm -v /opt/buildstart-calling-agent:/app -w /app golang:latest go build -o /app/buildstart-calling-agent ./cmd/server && cp /opt/buildstart-calling-agent/buildstart-calling-agent /usr/local/bin/buildstart-calling-agent && systemctl restart buildstart-calling-agent.service`, (err4, stream) => {
            stream.on('close', () => { console.log('Done'); conn.end(); });
            stream.on('data', d => console.log('STDOUT: ' + d));
            stream.stderr.on('data', d => console.log('STDERR: ' + d));
          });
        });
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
