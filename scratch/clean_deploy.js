const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat > /tmp/server.tar.gz && cd /opt/wacaller && rm -rf internal cmd pkg assets client scripts go.mod go.sum server && tar -xzf /tmp/server.tar.gz && rm /tmp/server.tar.gz && docker compose up -d --build`, (err, stream) => {
    if (err) throw err;
    const fileStream = fs.createReadStream('../server.tar.gz');
    fileStream.pipe(stream);
    
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
