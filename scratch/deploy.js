const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat > /tmp/functions.tar.gz && cd /var/www/buildstart/supabase/functions && tar -xzf /tmp/functions.tar.gz && rm /tmp/functions.tar.gz`, (err, stream) => {
    if (err) throw err;
    const fileStream = fs.createReadStream('supabase/functions.tar.gz');
    fileStream.pipe(stream);
    
    stream.on('close', (code, signal) => {
      console.log('Deployed');
      
      // Also write the .env file with secrets to the functions root
      conn.exec(`cat >> /var/www/buildstart/supabase/docker/.env << 'ENV_EOF'
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODY0NDc4NjYsImV4cCI6MjEwMTgwNzg2Nn0.X3SLU9ShCNBzlwY91D1CVoHsLHOfYOv6R6eJ8UpkhsQ
GO_SERVER_URL=https://wacaller.bandara.me
ENV_EOF
cd /var/www/buildstart/supabase/docker && docker compose restart edge-runtime
`, (err2, stream2) => {
        stream2.on('close', () => conn.end());
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
  password: 'JXRMVeRM7Wcq'
});
