import pytest
from backend.app.services.github_service import (
    parse_github_url,
    sanitize_readme_content,
    fetch_github_repo_details,
)


def test_parse_valid_github_url():
    parsed = parse_github_url("https://github.com/torvalds/linux")
    assert parsed is not None
    assert parsed.owner == "torvalds"
    assert parsed.repo == "linux"


def test_parse_github_url_with_git_extension():
    parsed = parse_github_url("https://github.com/pallets/flask.git")
    assert parsed is not None
    assert parsed.owner == "pallets"
    assert parsed.repo == "flask"


def test_reject_non_github_url():
    assert parse_github_url("https://google.com/search") is None
    assert parse_github_url("https://gitlab.com/group/project") is None
    assert parse_github_url("invalid-string") is None


def test_sanitize_readme_content():
    raw_readme = """
    <!-- build badge -->
    [![Build Status](https://travis-ci.org/repo.svg)](https://travis-ci.org/repo)
    # Project Title
    <div align="center"><p>Header</p></div>
    Here is a description with a [link](https://example.com).
    ```python
    def long_code():
        # Code that is longer than 300 characters
        """ + ("x = 1\n" * 50) + """
        return True
    ```
    """
    sanitized = sanitize_readme_content(raw_readme)
    assert "<!--" not in sanitized
    assert "<div" not in sanitized
    assert "code snippet truncated" in sanitized
    assert "Project Title" in sanitized


@pytest.mark.asyncio
async def test_fetch_inaccessible_repo_fallback():
    # Attempting to fetch non-existent repo should gracefully return contextSource="resume_only"
    details = await fetch_github_repo_details("https://github.com/nonexistent-user-1234567/nonexistent-repo-9876543")
    assert details.repositoryAccessible is False
    assert details.readmeAvailable is False
    assert details.contextSource == "resume_only"
    assert details.errorMessage is not None
