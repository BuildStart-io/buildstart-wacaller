const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`echo "SSH WORKS"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end());
    stream.on('data', d => console.log('STDOUT: ' + d));
    stream.stderr.on('data', d => console.log('STDERR: ' + d));
  });
}).on('error', (err) => {
  console.error("SSH ERROR: " + err.message);
}).connect({
  host: '178.104.127.220',
  port: 22,
  username: 'root',
  password: 'JXRMVeRM7Wcq',
  readyTimeout: 10000
});
