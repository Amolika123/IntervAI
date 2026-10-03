import OpenAI from 'openai';

export interface CandidateProfile {
  name: string;
  email?: string;
  phone?: string;
  summary?: string;
  education: Array<{
    degree: string;
    institution: string;
    year?: string;
  }>;
  skills: string[];
  technologies: string[];
  experience: Array<{
    role: string;
    company: string;
    period?: string;
    description: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    url?: string;
    technologies?: string[];
  }>;
  certifications?: string[];
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  let extractedText = '';

  // STRATEGY 1: Try unpdf (Modern PDF.js engine)
  try {
    const unpdf = await import('unpdf');
    const uint8Array = new Uint8Array(pdfBuffer);
    const pdf = await unpdf.getDocumentProxy(uint8Array);
    const { text } = await unpdf.extractText(pdf, { mergePages: true });
    if (text && text.trim().length > 10) {
      extractedText = text;
      return extractedText;
    }
  } catch (err) {
    console.warn('Strategy 1 (unpdf) extraction attempt failed:', err);
  }

  // STRATEGY 2: Try pdf-parse lib engine
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const data = await pdfParse(pdfBuffer);
    if (data && data.text && data.text.trim().length > 10) {
      extractedText = data.text;
      return extractedText;
    }
  } catch (err) {
    console.warn('Strategy 2 (pdf-parse) extraction attempt failed:', err);
  }

  // STRATEGY 3: Fallback raw stream text extractor (Extracts readable text objects from PDF stream)
  try {
    const rawString = pdfBuffer.toString('binary');
    const matches = rawString.match(/\(([^()]+)\)\s*Tj/g) || rawString.match(/T[dD]\s*\(([^()]+)\)/g);
    if (matches && matches.length > 0) {
      extractedText = matches.map(m => m.replace(/.*\(|\).*/g, '')).join(' ');
      if (extractedText.trim().length > 10) {
        return extractedText;
      }
    }

    // Direct printable ASCII string extraction fallback
    const asciiText = rawString.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ');
    if (asciiText.length > 50) {
      return asciiText;
    }
  } catch (err) {
    console.warn('Strategy 3 (raw buffer) extraction attempt failed:', err);
  }

  if (!extractedText || extractedText.trim().length < 10) {
    throw new Error('Unable to extract readable text from PDF file.');
  }

  return extractedText;
}

export function extractGitHubUrlsFromText(text: string): string[] {
  const githubRegex = /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/gi;
  const matches = text.match(githubRegex) || [];
  return Array.from(new Set(matches.map(url => url.replace(/[.,;)]+$/, '').replace(/\/$/, ''))));
}

export async function parseResumeTextWithNLP(rawText: string): Promise<CandidateProfile> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const prompt = `
You are an expert technical resume parser NLP engine.
Extract structured information from the following raw resume text into JSON matching the schema provided.

Rules:
1. Identify the candidate's name accurately.
2. Extract all technical skills, programming languages, databases, frameworks, and cloud platforms into "skills" and "technologies".
3. Extract all distinct projects, their technical descriptions, and ANY GitHub or project URLs mentioned near or in that project.
4. If a project has a GitHub link anywhere in the resume, associate it with that specific project's "url" field.
5. Keep descriptions clear and preserve key details (e.g. vector databases, models, frameworks, architecture mentioned).

RAW RESUME TEXT:
${rawText}
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'candidate_profile',
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                summary: { type: 'string' },
                education: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      degree: { type: 'string' },
                      institution: { type: 'string' },
                      year: { type: 'string' }
                    },
                    required: ['degree', 'institution'],
                    additionalProperties: false
                  }
                },
                skills: {
                  type: 'array',
                  items: { type: 'string' }
                },
                technologies: {
                  type: 'array',
                  items: { type: 'string' }
                },
                experience: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      company: { type: 'string' },
                      period: { type: 'string' },
                      description: { type: 'string' }
                    },
                    required: ['role', 'company', 'description'],
                    additionalProperties: false
                  }
                },
                projects: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      url: { type: 'string' },
                      technologies: {
                        type: 'array',
                        items: { type: 'string' }
                      }
                    },
                    required: ['name', 'description'],
                    additionalProperties: false
                  }
                },
                certifications: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['name', 'education', 'skills', 'technologies', 'experience', 'projects'],
              additionalProperties: false
            }
          }
        }
      });

      const jsonContent = response.choices[0].message.content;
      if (jsonContent) {
        return JSON.parse(jsonContent) as CandidateProfile;
      }
    } catch (err) {
      console.warn('OpenAI NLP parsing failed or unavailable, using rule-based fallback parsing:', err);
    }
  }

  return fallbackRuleBasedParser(rawText);
}

function fallbackRuleBasedParser(rawText: string): CandidateProfile {
  const extractedUrls = extractGitHubUrlsFromText(rawText);
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  const name = lines[0] || 'Technical Candidate';
  const skills = Array.from(new Set(rawText.match(/(?:Python|JavaScript|TypeScript|React|Next\.js|Node\.js|PyTorch|TensorFlow|ChromaDB|PostgreSQL|Docker|Kubernetes|Go|Rust|C\+\+|Java|AWS|Redis|RAG|LLM|REST API)/gi) || []));

  const projects: Array<{ name: string; description: string; url?: string; technologies?: string[] }> = [];

  if (extractedUrls.length > 0) {
    extractedUrls.forEach((url, i) => {
      const repoName = url.split('/').pop() || `Project ${i + 1}`;
      projects.push({
        name: repoName.replace(/[-_]/g, ' ').toUpperCase(),
        description: `Project extracted from resume containing link ${url}. Includes work with ${skills.slice(0, 4).join(', ')}.`,
        url: url,
        technologies: skills.slice(0, 3)
      });
    });
  } else {
    projects.push({
      name: 'Primary Technical Project',
      description: rawText.slice(0, 300) || 'Candidate technical project details.',
      technologies: skills
    });
  }

  return {
    name,
    education: [{ degree: 'B.S. Computer Science / Software Engineering', institution: 'University' }],
    skills,
    technologies: skills,
    experience: [{ role: 'Software Developer / Engineer', company: 'Tech Projects', description: rawText.slice(0, 200) }],
    projects
  };
}
