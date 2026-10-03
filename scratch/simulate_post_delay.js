const https = require('https');

const postReq = https.request('https://buildstart-calling-agent.buildstart.io/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d.toString());
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const data = JSON.parse(body);
    const sessionId = data.id || data.session_id;
    console.log('Session:', sessionId);
    
    // Wait 5 seconds to ensure QR is generated
    setTimeout(() => {
      const req = https.request(`https://buildstart-calling-agent.buildstart.io/api/events?session_id=${sessionId}`, (sseRes) => {
        console.log('SSE connected:', sseRes.statusCode);
        sseRes.on('data', chunk => {
          console.log('SSE DATA:', chunk.toString());
        });
        setTimeout(() => req.destroy(), 5000);
      });
      req.end();
    }, 5000);
  });
});
postReq.write(JSON.stringify({ business_id: "5cb1756f-43c9-4707-a7bc-cc8d2b7dc4f5" }));
postReq.end();
