import re
import logging
from typing import Optional, List, Literal
from urllib.parse import urlparse
import httpx
from pydantic import BaseModel, Field
from backend.app.config.settings import settings

logger = logging.getLogger(__name__)

ContextSourceType = Literal["resume+github_readme", "resume+github_tree", "resume_only"]


class GitHubParsedUrl(BaseModel):
    rawUrl: str
    owner: str
    repo: str


class GitHubRepoDetails(BaseModel):
    githubUrl: str
    owner: str
    repo: str
    repositoryAccessible: bool = False
    readmeAvailable: bool = False
    readmeContent: Optional[str] = None
    fileTree: Optional[List[str]] = Field(default_factory=list)
    contextSource: ContextSourceType = "resume_only"
    errorMessage: Optional[str] = None


def parse_github_url(url: str) -> Optional[GitHubParsedUrl]:
    """
    Parses a GitHub URL and extracts the owner and repository name.
    Rejects non-GitHub domains and malformed URLs.
    """
    if not url or not isinstance(url, str):
        return None

    try:
        clean_url = re.sub(r"[.,;)]+$", "", url.strip())
        target = clean_url if clean_url.startswith("http") else f"https://{clean_url}"
        parsed = urlparse(target)

        if parsed.hostname not in ("github.com", "www.github.com"):
            return None

        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) >= 2:
            owner = parts[0]
            repo = re.sub(r"\.git$", "", parts[1])
            return GitHubParsedUrl(rawUrl=clean_url, owner=owner, repo=repo)
    except Exception as e:
        logger.warning(f"Invalid URL format ({url}): {e}")

    return None


def sanitize_readme_content(raw_text: str) -> str:
    """
    Strips HTML comments, tags, badges, and excessive markdown image links
    to preserve pure technical content for interview context window.
    """
    text = raw_text
    # Strip HTML comments
    text = re.sub(r"<!--[\s\S]*?-->", "", text)
    # Strip HTML tags
    text = re.sub(r"<[^>]*>", "", text)
    # Strip image links ![alt](url)
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    # Replace standard links [text](url) with just text
    text = re.sub(r"\[([^\]]+)\]\(.*?\)", r"\1", text)
    # Truncate large code blocks
    def codeblock_replacer(match):
        code = match.group(0)
        return code[:300] + "\n... [code snippet truncated]"

    text = re.sub(r"```[\s\S]*?```", codeblock_replacer, text).strip()

    if len(text) > 3500:
        text = text[:3500] + "\n... [README truncated for interview context]"

    return text


async def fetch_github_repo_details(url: str) -> GitHubRepoDetails:
    """
    Fetches public GitHub repository details using httpx:
    1. Repository metadata (accessibility, default branch)
    2. README.md raw text
    3. Git tree file hierarchy (up to 50 paths)
    """
    parsed = parse_github_url(url)
    if not parsed:
        return GitHubRepoDetails(
            githubUrl=url,
            owner="",
            repo="",
            repositoryAccessible=False,
            readmeAvailable=False,
            contextSource="resume_only",
            errorMessage="Invalid or unsupported GitHub URL format."
        )

    owner, repo, raw_url = parsed.owner, parsed.repo, parsed.rawUrl
    headers = {
        "User-Agent": "IntervAI-App/1.0",
        "Accept": "application/vnd.github.v3+json",
    }

    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            # 1. Fetch Repository Metadata
            repo_res = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}",
                headers=headers
            )

            if repo_res.status_code != 200:
                return GitHubRepoDetails(
                    githubUrl=raw_url,
                    owner=owner,
                    repo=repo,
                    repositoryAccessible=False,
                    readmeAvailable=False,
                    contextSource="resume_only",
                    errorMessage=f"GitHub repo inaccessible (HTTP {repo_res.status_code}). Falling back to resume description."
                )

            repo_data = repo_res.json()
            default_branch = repo_data.get("default_branch", "main")

            # 2. Fetch README
            readme_available = False
            readme_content: Optional[str] = None
            try:
                readme_headers = {**headers, "Accept": "application/vnd.github.v3.raw"}
                readme_res = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/readme",
                    headers=readme_headers
                )
                if readme_res.status_code == 200:
                    readme_available = True
                    readme_content = sanitize_readme_content(readme_res.text)
            except Exception as e:
                logger.warning(f"Failed to fetch README for {owner}/{repo}: {e}")

            # 3. Fetch File Tree
            file_tree: List[str] = []
            try:
                tree_res = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1",
                    headers=headers
                )
                if tree_res.status_code == 200:
                    tree_data = tree_res.json()
                    tree_items = tree_data.get("tree", [])
                    if isinstance(tree_items, list):
                        file_tree = [
                            item["path"]
                            for item in tree_items
                            if item.get("type") in ("blob", "tree") and "path" in item
                        ][:50]
            except Exception as e:
                logger.warning(f"Failed to fetch tree for {owner}/{repo}: {e}")

            context_source: ContextSourceType = (
                "resume+github_readme" if readme_available else (
                    "resume+github_tree" if file_tree else "resume_only"
                )
            )

            return GitHubRepoDetails(
                githubUrl=raw_url,
                owner=owner,
                repo=repo,
                repositoryAccessible=True,
                readmeAvailable=readme_available,
                readmeContent=readme_content,
                fileTree=file_tree,
                contextSource=context_source
            )

    except Exception as error:
        logger.error(f"Error connecting to GitHub API for {owner}/{repo}: {error}")
        return GitHubRepoDetails(
            githubUrl=raw_url,
            owner=owner,
            repo=repo,
            repositoryAccessible=False,
            readmeAvailable=False,
            contextSource="resume_only",
            errorMessage="Network error connecting to GitHub API."
        )
