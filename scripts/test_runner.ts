import { parseResumeTextWithNLP, extractGitHubUrlsFromText } from '../src/lib/nlp/resumeParser';
import { parseGitHubUrl, fetchGitHubRepoDetails } from '../src/lib/github/githubService';
import { buildCandidateContext } from '../src/lib/context/candidateContextBuilder';
import { buildInterviewerSystemPrompt } from '../src/lib/interviewer/systemPrompt';

async function runSystemIntegrityTests() {
  console.log('==================================================');
  console.log('RUNNING INTERVAI END-TO-END INTEGRITY TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: GitHub URL Parsing & Validation
  console.log('--- Test 1: GitHub URL Parser ---');
  const validUrl = parseGitHubUrl('https://github.com/torvalds/linux');
  assert(validUrl !== null && validUrl.owner === 'torvalds' && validUrl.repo === 'linux', 'Parses valid GitHub URL');

  const invalidUrl = parseGitHubUrl('https://google.com/search');
  assert(invalidUrl === null, 'Rejects non-GitHub URL');

  // TEST 2: Resume Text GitHub URL Extraction
  console.log('\n--- Test 2: URL Extraction Regex ---');
  const rawTextWithUrl = `
  Jane Doe - AI Engineer
  Project: RAG Fake News Detector
  Link: https://github.com/janedoe/fake-news-rag.
  Built using ChromaDB and PyTorch.
  `;
  const extractedUrls = extractGitHubUrlsFromText(rawTextWithUrl);
  assert(extractedUrls.length === 1 && extractedUrls[0] === 'https://github.com/janedoe/fake-news-rag', 'Extracts clean GitHub URL without trailing period');

  // TEST 3: Candidate Context Construction & Source Attribution
  console.log('\n--- Test 3: Candidate Context Aggregator ---');
  const mockProfile = {
    name: 'Jane Doe',
    education: [{ degree: 'B.S. Computer Science', institution: 'Tech Univ' }],
    skills: ['Python', 'PyTorch', 'ChromaDB', 'Next.js'],
    technologies: ['Python', 'ChromaDB'],
    experience: [{ role: 'AI Intern', company: 'Tech Corp', description: 'Developed RAG retrieval system' }],
    projects: [
      {
        name: 'Fake News Detection System',
        description: 'Built a RAG-based fake-news detection system using ChromaDB.',
        url: 'https://github.com/janedoe/fake-news-rag'
      },
      {
        name: 'React Dashboard App',
        description: 'Built frontend supply chain tracking app in React.',
        url: undefined
      }
    ]
  };

  const context = await buildCandidateContext(mockProfile);
  assert(context.candidate.name === 'Jane Doe', 'Candidate name correctly compiled');
  assert(context.projects.length === 2, 'All projects included in context');
  assert(context.projects[1].contextSource === 'resume_only', 'Project without link marked as resume_only');

  // TEST 4: Grounded Prompt Rule Validation
  console.log('\n--- Test 4: System Prompt Grounding Guardrails ---');
  const defaultPromptText = buildInterviewerSystemPrompt(context);
  assert(defaultPromptText.includes('CRITICAL GROUNDING RULES'), 'Includes mandatory grounding rules header');
  assert(defaultPromptText.includes('Fake News Detection System'), 'Includes candidate project name');
  assert(defaultPromptText.includes('ChromaDB'), 'Includes candidate technology claim');
  assert(defaultPromptText.includes('DO NOT ASK UNGROUNDED GENERIC CS TRIVIA'), 'Includes explicit anti-trivia guardrail');

  // TEST 5: FAANG Style Preset Validation
  console.log('\n--- Test 5: FAANG Style Preset Directives ---');
  const faangPrompt = buildInterviewerSystemPrompt(context, 'FAANG');
  assert(faangPrompt.includes('STYLE PRESET: FAANG'), 'Identifies FAANG preset header');
  assert(faangPrompt.includes('Meta, Amazon, Apple, Netflix, Google'), 'Lists official FAANG companies');
  assert(faangPrompt.includes('Technical Depth, Algorithms, Complexity'), 'Emphasizes algorithms and computational complexity');
  assert(faangPrompt.includes('Fake News Detection System'), 'Maintains candidate project grounding in FAANG style');
  assert(faangPrompt.includes('ChromaDB'), 'Maintains candidate technology grounding in FAANG style');

  // TEST 6: MANGOS Style Preset Validation
  console.log('\n--- Test 6: MANGOS Style Preset Directives ---');
  const mangosPrompt = buildInterviewerSystemPrompt(context, 'MANGOS');
  assert(mangosPrompt.includes('STYLE PRESET: MANGOS'), 'Identifies MANGOS preset header');
  assert(mangosPrompt.includes('Meta, Anthropic, NVIDIA, Google, OpenAI, SpaceX'), 'Lists official MANGOS companies');
  assert(mangosPrompt.includes('Architectural Reasoning, AI/ML & Systems Concepts'), 'Emphasizes AI/ML, architecture, and system trade-offs');
  assert(mangosPrompt.includes('Fake News Detection System'), 'Maintains candidate project grounding in MANGOS style');
  assert(mangosPrompt.includes('ChromaDB'), 'Maintains candidate technology grounding in MANGOS style');

  // TEST 7: Big 4 Style Preset Validation
  console.log('\n--- Test 7: Big 4 Style Preset Directives ---');
  const big4Prompt = buildInterviewerSystemPrompt(context, 'BIG_4');
  assert(big4Prompt.includes('STYLE PRESET: BIG 4'), 'Identifies Big 4 preset header');
  assert(big4Prompt.includes('Deloitte, PwC, EY, KPMG'), 'Lists official Big 4 companies');
  assert(big4Prompt.includes('Practical Software Engineering, Databases, APIs, Debugging'), 'Emphasizes practical SE, databases, APIs & debugging');
  assert(big4Prompt.includes('Fake News Detection System'), 'Maintains candidate project grounding in Big 4 style');
  assert(big4Prompt.includes('ChromaDB'), 'Maintains candidate technology grounding in Big 4 style');

  // TEST 8: Distinct Probing Differentiators
  console.log('\n--- Test 8: Probing Strategy Differentiation ---');
  assert(faangPrompt !== mangosPrompt, 'FAANG and MANGOS prompts produce distinct directives');
  assert(mangosPrompt !== big4Prompt, 'MANGOS and Big 4 prompts produce distinct directives');
  assert(faangPrompt !== big4Prompt, 'FAANG and Big 4 prompts produce distinct directives');

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) process.exit(1);
}

runSystemIntegrityTests();
