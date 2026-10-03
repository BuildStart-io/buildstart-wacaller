const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat > /opt/buildstart-calling-agent/cmd/server/broker.go`, (err, stream) => {
    if (err) throw err;
    const fileStream = fs.createReadStream('/home/anuhas/programming/calling-agent-development/buildstart-calling-agent/cmd/server/broker.go');
    fileStream.pipe(stream);
    
    stream.on('close', (code, signal) => {
      console.log('Uploaded broker.go');
      conn.exec(`cd /opt/buildstart-calling-agent && go build -o /usr/local/bin/buildstart-calling-agent ./cmd/server && systemctl restart buildstart-calling-agent.service`, (err2, stream2) => {
        stream2.on('close', () => {
           console.log('Rebuilt and restarted server');
           conn.end();
        });
        stream2.on('data', (data) => console.log('STDOUT2: ' + data));
        stream2.stderr.on('data', (data) => console.log('STDERR2: ' + data));
      });
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
  password: 'JXRMVeRM7Wcq',
  readyTimeout: 30000
});
