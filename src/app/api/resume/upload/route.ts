import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTextFromPDF, parseResumeTextWithNLP } from '@/lib/nlp/resumeParser';
import { buildCandidateContext } from '@/lib/context/candidateContextBuilder';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file uploaded.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid file type. Only PDF resumes are accepted.' }, { status: 400 });
    }

    // Check size limit (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Extract raw text from PDF
    const rawText = await extractTextFromPDF(buffer);

    if (!rawText || rawText.trim().length < 20) {
      return NextResponse.json({
        error: 'Unable to extract text from PDF. Please upload a readable text-based PDF.'
      }, { status: 422 });
    }

    // 2. Structured NLP parsing
    const parsedProfile = await parseResumeTextWithNLP(rawText);

    // 3. Build candidate context & fetch GitHub public repository details
    const candidateContext = await buildCandidateContext(parsedProfile);

    // 4. Create Database Records
    const user = await db.user.create({ data: {} });

    const resume = await db.resume.create({
      data: {
        userId: user.id,
        fileName: file.name,
        rawText,
        parsedProfile: JSON.stringify(parsedProfile)
      }
    });

    const storedProjects = [];
    for (const proj of candidateContext.projects) {
      const dbProj = await db.project.create({
        data: {
          resumeId: resume.id,
          name: proj.name,
          resumeDescription: proj.resumeDescription,
          githubUrl: proj.githubUrl,
          githubOwner: proj.githubOwner,
          githubRepo: proj.githubRepo,
          repositoryAccessible: proj.repositoryAccessible,
          readmeAvailable: proj.readmeAvailable,
          contextSource: proj.contextSource
        }
      });

      if (proj.readmeText) {
        await db.projectSource.create({
          data: {
            projectId: dbProj.id,
            sourceType: 'README',
            content: proj.readmeText
          }
        });
      }

      if (proj.repositoryStructure && proj.repositoryStructure.length > 0) {
        await db.projectSource.create({
          data: {
            projectId: dbProj.id,
            sourceType: 'FILE_TREE',
            content: JSON.stringify(proj.repositoryStructure)
          }
        });
      }

      storedProjects.push({
        ...proj,
        id: dbProj.id
      });
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      resumeId: resume.id,
      parsedProfile,
      candidateContext: {
        ...candidateContext,
        projects: storedProjects
      }
    });

  } catch (error: unknown) {
    console.error('Resume upload endpoint error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process resume';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
