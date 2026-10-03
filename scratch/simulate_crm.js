const https = require('https');

// 1. Create a session
const postReq = https.request('https://buildstart-calling-agent.buildstart.io/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d.toString());
  res.on('end', () => {
    const data = JSON.parse(body);
    const sessionId = data.id;
    console.log('Created session:', sessionId);
    
    // 2. Connect to SSE
    const req = https.request(`https://buildstart-calling-agent.buildstart.io/api/events?session_id=${sessionId}`, (sseRes) => {
      console.log('SSE connected:', sseRes.statusCode);
      sseRes.on('data', chunk => {
        console.log('SSE DATA:', chunk.toString());
      });
      setTimeout(() => {
        req.destroy();
        console.log('Destroyed SSE');
      }, 10000);
    });
    req.end();
  });
});
postReq.write(JSON.stringify({ business_id: "test" }));
postReq.end();
