const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`
    cp -r /opt/buildstart-calling-agent_old/client /opt/buildstart-calling-agent/client &&
    cp /opt/buildstart-calling-agent_old/.env /opt/buildstart-calling-agent/.env &&
    echo "DATABASE_URL=postgres://postgres:83e92d24de107ec7ad36e5b47f82fc9d@127.0.0.1:5434/postgres?search_path=whatsapp_infra&sslmode=disable" >> /opt/buildstart-calling-agent/.env &&
    sed -i 's|-db /opt/buildstart-calling-agent/data/wacalls.db ||' /etc/systemd/system/buildstart-calling-agent.service &&
    systemctl daemon-reload &&
    systemctl enable --now buildstart-calling-agent.service &&
    systemctl status buildstart-calling-agent.service
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
