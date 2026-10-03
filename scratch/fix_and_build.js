const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`
    cd /opt/buildstart-calling-agent && 
    sed -i '121,126d' cmd/server/main.go &&
    sed -i '65,120d' cmd/server/main.go &&
    docker run --rm -v /opt/buildstart-calling-agent:/app -w /app golang:alpine sh -c "apk add git && go mod download && CGO_ENABLED=0 GOOS=linux go build -o buildstart-calling-server ./cmd/server"
  `, (err, stream) => {
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
  password: 'JXRMVeRM7Wcq'
});
