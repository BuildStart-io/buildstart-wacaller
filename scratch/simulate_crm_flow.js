const https = require('https');

// Step 1: Create session (like the edge function does)
const postReq = https.request('https://buildstart-calling-agent.buildstart.io/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d.toString());
  res.on('end', () => {
    const data = JSON.parse(body);
    const sessionId = data.id;
    console.log('[1] Session created:', sessionId);
    
    // Step 2: IMMEDIATELY connect SSE (like the CRM does, no delay)
    const sseReq = https.request(`https://buildstart-calling-agent.buildstart.io/api/events?session_id=${sessionId}`, (sseRes) => {
      console.log('[2] SSE connected, status:', sseRes.statusCode);
      console.log('[2] SSE headers:', JSON.stringify(sseRes.headers));
      
      let eventCount = 0;
      sseRes.on('data', chunk => {
        eventCount++;
        const text = chunk.toString();
        console.log(`[3] SSE event #${eventCount} (${text.length} bytes):`, text.substring(0, 300));
        
        // Check if we got a QR
        if (text.includes('session-qr') || text.includes('"qr"')) {
          console.log('[!!!] GOT QR CODE EVENT');
        }
      });
      
      // Kill after 20 seconds
      setTimeout(() => {
        console.log(`[4] Timeout after 20s. Total events received: ${eventCount}`);
        sseReq.destroy();
        process.exit(0);
      }, 20000);
    });
    sseReq.end();
  });
});
postReq.write(JSON.stringify({ business_id: "5cb1756f-43c9-4707-a7bc-cc8d2b7dc4f5" }));
postReq.end();
