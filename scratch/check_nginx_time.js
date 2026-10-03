const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Let's change nginx log format temporarily to see request time? No, we can't easily change and reload for past logs.
  // But wait! Is there a way to see if the connection is still open? 
  conn.exec(`netstat -anp | grep 8080`, (err, stream) => {
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
