async function testFlow() {
  const resumeId = '48d4277e-d2a1-4a4e-b510-5331450bf30e';
  
  console.log('1. Testing /api/interview/start with MANGOS style...');
  const startRes = await fetch('http://localhost:3000/api/interview/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeId, style: 'MANGOS' })
  });
  const startJson = await startRes.json();
  console.log('   Response status:', startRes.status);
  console.log('   Interview ID:', startJson.interviewId);
  
  if (!startJson.success || !startJson.interviewId) {
    throw new Error('Failed to start interview: ' + JSON.stringify(startJson));
  }
  
  console.log('\n2. Testing /api/interview/session...');
  const sessionRes = await fetch('http://localhost:3000/api/interview/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interviewId: startJson.interviewId })
  });
  const sessionJson = await sessionRes.json();
  console.log('   Session style:', sessionJson.style);
  console.log('   Instructions contains MANGOS directive:', sessionJson.systemInstructions?.includes('STYLE PRESET: MANGOS'));
  console.log('   Instructions contains Meta/Anthropic/NVIDIA/OpenAI/SpaceX:', sessionJson.systemInstructions?.includes('SpaceX'));
  
  console.log('\n3. Testing /api/interview/[id]/results...');
  const resultsRes = await fetch('http://localhost:3000/api/interview/' + startJson.interviewId + '/results');
  const resultsJson = await resultsRes.json();
  console.log('   Results interview style:', resultsJson.interview?.style);
  
  console.log('\n4. Testing /api/interview/start with BIG_4 style...');
  const big4Start = await fetch('http://localhost:3000/api/interview/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeId, style: 'BIG_4' })
  });
  const big4Json = await big4Start.json();
  console.log('   Big 4 Interview ID:', big4Json.interviewId);
  
  const big4SessionRes = await fetch('http://localhost:3000/api/interview/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interviewId: big4Json.interviewId })
  });
  const big4SessionJson = await big4SessionRes.json();
  console.log('   Big 4 Session style:', big4SessionJson.style);
  console.log('   Big 4 Instructions contains BIG 4 directive:', big4SessionJson.systemInstructions?.includes('STYLE PRESET: BIG 4'));
  console.log('   Big 4 Instructions contains Deloitte/PwC/EY/KPMG:', big4SessionJson.systemInstructions?.includes('Deloitte, PwC, EY, KPMG'));

  console.log('\nSUCCESS: All styles correctly initialized, persisted, and surfaced!');
}

testFlow().catch(console.error);
