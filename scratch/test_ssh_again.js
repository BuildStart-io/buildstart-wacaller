const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log("SSH SUCCESS!");
  conn.end();
}).on('error', (err) => {
  console.error("SSH ERROR:", err);
}).connect({
  host: '178.104.127.220',
  port: 22,
  username: 'root',
  password: 'JXRMVeRM7Wcq',
  readyTimeout: 5000
});
