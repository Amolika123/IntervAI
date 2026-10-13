async function verifyLandingPage() {
  const res = await fetch('http://localhost:3000/');
  const html = await res.text();
  
  console.log('--- Checking Landing Page HTML ---');
  const checks = [
    { name: 'Video URL Present', pass: html.includes('hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4') },
    { name: 'Headline Your Work', pass: html.includes('Your Work.') },
    { name: 'Headline Your Interview', pass: html.includes('Your Interview.') },
    { name: 'Subtitle Present', pass: html.includes('Practice technical interviews grounded in your resume') },
    { name: 'Built Around Your Experience Badge', pass: html.includes('BUILT AROUND YOUR EXPERIENCE') },
    { name: 'Marquee FAANG Style', pass: html.includes('FAANG Interview Style') },
    { name: 'Marquee MANGOS Style', pass: html.includes('MANGOS Interview Style') },
    { name: 'Marquee Big 4 Style', pass: html.includes('Big 4 Interview Style') },
    { name: 'Section How It Works', pass: html.includes('id="how-it-works"') },
    { name: 'Section Interview Styles', pass: html.includes('id="interview-styles"') },
    { name: 'Section Features', pass: html.includes('id="features"') },
    { name: 'Meta Description Brand', pass: html.includes('Your Work. Your Interview.') },
    { name: 'Upload CTA Present', pass: html.includes('Upload Your Resume') },
  ];
  
  let allPass = true;
  checks.forEach(c => {
    console.log((c.pass ? '[PASS]' : '[FAIL]') + ' ' + c.name);
    if (!c.pass) allPass = false;
  });
  
  if (!allPass) process.exit(1);
  console.log('\nLanding page HTML verification: 100% Passed!');
}

verifyLandingPage().catch(console.error);
