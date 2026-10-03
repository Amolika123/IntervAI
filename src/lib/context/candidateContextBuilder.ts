import { CandidateProfile } from '../nlp/resumeParser';
import { fetchGitHubRepoDetails, GitHubRepoDetails } from '../github/githubService';

export interface CompiledProjectContext {
  id?: string;
  name: string;
  resumeDescription: string;
  githubUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  repositoryAccessible: boolean;
  readmeAvailable: boolean;
  readmeText?: string;
  repositoryStructure?: string[];
  contextSource: 'resume+github_readme' | 'resume+github_tree' | 'resume_only';
}

export interface CandidateContext {
  candidate: {
    name: string;
    education: CandidateProfile['education'];
    skills: string[];
    technologies: string[];
    experience: CandidateProfile['experience'];
  };
  projects: CompiledProjectContext[];
}

export async function buildCandidateContext(profile: CandidateProfile): Promise<CandidateContext> {
  const processedProjects: CompiledProjectContext[] = [];

  for (const proj of profile.projects) {
    if (proj.url && proj.url.includes('github.com')) {
      const ghDetails: GitHubRepoDetails = await fetchGitHubRepoDetails(proj.url);
      processedProjects.push({
        name: proj.name,
        resumeDescription: proj.description,
        githubUrl: ghDetails.githubUrl,
        githubOwner: ghDetails.owner,
        githubRepo: ghDetails.repo,
        repositoryAccessible: ghDetails.repositoryAccessible,
        readmeAvailable: ghDetails.readmeAvailable,
        readmeText: ghDetails.readmeContent,
        repositoryStructure: ghDetails.fileTree,
        contextSource: ghDetails.contextSource
      });
    } else {
      processedProjects.push({
        name: proj.name,
        resumeDescription: proj.description,
        githubUrl: proj.url,
        repositoryAccessible: false,
        readmeAvailable: false,
        contextSource: 'resume_only'
      });
    }
  }

  return {
    candidate: {
      name: profile.name || 'Candidate',
      education: profile.education || [],
      skills: profile.skills || [],
      technologies: profile.technologies || [],
      experience: profile.experience || []
    },
    projects: processedProjects
  };
}
