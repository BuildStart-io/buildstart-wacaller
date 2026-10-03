const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat > /tmp/functions.tar.gz && cd /root/supabase/supabase/docker/volumes/functions && tar -xzf /tmp/functions.tar.gz && rm /tmp/functions.tar.gz`, (err, stream) => {
    if (err) throw err;
    const fileStream = fs.createReadStream('functions.tar.gz');
    fileStream.pipe(stream);
    
    stream.on('close', (code, signal) => {
      console.log('Deployed');
      conn.end();
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
  password: 'JXRMVeRM7Wcq'
});
