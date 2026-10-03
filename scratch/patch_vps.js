const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const diff = `--- /opt/buildstart-calling-agent/cmd/server/broker.go
+++ /opt/buildstart-calling-agent/cmd/server/broker.go
@@ -158,11 +158,18 @@
 }
 
 func (b *Broker) emitAuthState(sessionID string, a AuthSnapshot) {
+       // New format
        b.broadcast(map[string]any{
                "type": "auth-state", "sessionId": sessionID,
                "paired": a.Paired, "state": a.State, "qr": a.QR,
        })
+       // Backward compatible format
+       b.broadcast(map[string]any{
+               "type": "state", "sessionId": sessionID,
+               "paired": a.Paired, "state": a.State, "qr": a.QR,
+       })
 }
 
 func (b *Broker) emitSessionList(sessions []SessionInfo) {
@@ -169,5 +176,8 @@
 }
 
 func (b *Broker) emitSessionQR(sessionID, qr string) {
+       // New format
        b.broadcast(map[string]any{"type": "session-qr", "sessionId": sessionID, "qr": qr})
+       // Backward compatible format
+       b.broadcast(map[string]any{"type": "qr", "sessionId": sessionID, "qr": qr})
 }
`;
  conn.exec(`cat > /tmp/broker.patch << 'PATCH_EOF'\n${diff}\nPATCH_EOF\npatch /opt/buildstart-calling-agent/cmd/server/broker.go < /tmp/broker.patch`, (err, stream) => {
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
