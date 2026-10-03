const https = require('https');

const req = https.request('https://buildstart-calling-agent.buildstart.io/api/events?session_id=test', (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  res.on('data', (chunk) => {
    console.log('DATA:', chunk.toString());
  });
  
  res.on('end', () => {
    console.log('Connection closed by server.');
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();

setTimeout(() => {
  req.destroy();
  console.log('Manually destroyed after 10s');
}, 10000);
