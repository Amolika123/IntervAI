export interface GitHubParsedUrl {
  rawUrl: string;
  owner: string;
  repo: string;
}

export interface GitHubRepoDetails {
  githubUrl: string;
  owner: string;
  repo: string;
  repositoryAccessible: boolean;
  readmeAvailable: boolean;
  readmeContent?: string;
  fileTree?: string[];
  contextSource: 'resume+github_readme' | 'resume+github_tree' | 'resume_only';
  errorMessage?: string;
}

export function parseGitHubUrl(url: string): GitHubParsedUrl | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const cleanUrl = url.trim().replace(/[.,;)]+$/, '');
    const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
      return null;
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/, '');
      return { rawUrl: cleanUrl, owner, repo };
    }
  } catch (e) {
    console.warn(`Invalid URL format: ${url}`);
  }
  return null;
}

export async function fetchGitHubRepoDetails(url: string): Promise<GitHubRepoDetails> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return {
      githubUrl: url,
      owner: '',
      repo: '',
      repositoryAccessible: false,
      readmeAvailable: false,
      contextSource: 'resume_only',
      errorMessage: 'Invalid or unsupported GitHub URL format.'
    };
  }

  const { owner, repo, rawUrl } = parsed;
  const headers: Record<string, string> = {
    'User-Agent': 'IntervAI-App/1.0',
    'Accept': 'application/vnd.github.v3+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    // 1. Fetch Repository Metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      return {
        githubUrl: rawUrl,
        owner,
        repo,
        repositoryAccessible: false,
        readmeAvailable: false,
        contextSource: 'resume_only',
        errorMessage: `GitHub repo inaccessible (HTTP ${repoRes.status}). Falling back to resume description.`
      };
    }

    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || 'main';

    // 2. Fetch README content
    let readmeAvailable = false;
    let readmeContent: string | undefined;

    try {
      const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: {
          ...headers,
          'Accept': 'application/vnd.github.v3.raw'
        }
      });

      if (readmeRes.ok) {
        readmeAvailable = true;
        const rawReadme = await readmeRes.text();
        readmeContent = sanitizeReadmeContent(rawReadme);
      }
    } catch (e) {
      console.warn(`Failed to fetch README for ${owner}/${repo}:`, e);
    }

    // 3. Fetch Repository File Tree Structure
    let fileTree: string[] = [];
    try {
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
      if (treeRes.ok) {
        const treeData = await treeRes.json();
        if (Array.isArray(treeData.tree)) {
          fileTree = treeData.tree
            .filter((item: { type: string }) => item.type === 'blob' || item.type === 'tree')
            .map((item: { path: string }) => item.path)
            .slice(0, 50); // Keep top 50 relevant files for concise context
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch tree for ${owner}/${repo}:`, e);
    }

    const contextSource = readmeAvailable ? 'resume+github_readme' : (fileTree.length > 0 ? 'resume+github_tree' : 'resume_only');

    return {
      githubUrl: rawUrl,
      owner,
      repo,
      repositoryAccessible: true,
      readmeAvailable,
      readmeContent,
      fileTree,
      contextSource
    };

  } catch (error) {
    console.error(`Error fetching GitHub details for ${owner}/${repo}:`, error);
    return {
      githubUrl: rawUrl,
      owner,
      repo,
      repositoryAccessible: false,
      readmeAvailable: false,
      contextSource: 'resume_only',
      errorMessage: 'Network error connecting to GitHub API.'
    };
  }
}

function sanitizeReadmeContent(rawText: string): string {
  // Strip HTML comments, tags, badges, markdown image links to preserve pure technical content
  let text = rawText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/```[\s\S]*?```/g, (codeBlock) => codeBlock.slice(0, 300) + '\n... [code snippet truncated]')
    .trim();

  if (text.length > 3500) {
    text = text.slice(0, 3500) + '\n... [README truncated for interview context]';
  }
  return text;
}
