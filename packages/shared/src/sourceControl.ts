const GITHUB_PULL_REQUEST_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/u;

/**
 * Graphite's address for a GitHub pull request, or null when the link is not one it can show.
 *
 * Graphite serves GitHub's own path behind a `/github` prefix, so this is a rewrite rather than a
 * lookup. Only github.com maps: Graphite does not host Enterprise installs, and a link built from
 * one would take the reader out of their browser to a page that cannot find the pull request.
 */
export function graphitePullRequestUrl(pullRequestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(pullRequestUrl);
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== "github.com") {
    return null;
  }
  const match = GITHUB_PULL_REQUEST_PATH.exec(url.pathname);
  const owner = match?.[1];
  const repository = match?.[2];
  const number = Number(match?.[3]);
  if (!owner || !repository || !Number.isSafeInteger(number) || number <= 0) {
    return null;
  }
  return `https://app.graphite.dev/github/pr/${owner}/${repository}/${number}`;
}

const SCP_SSH_REMOTE_PATTERN = /^[a-zA-Z0-9._-]+@([^:/]+):/;

export function isSshRemoteUrl(remoteUrl: string): boolean {
  const trimmed = remoteUrl.trim();
  return SCP_SSH_REMOTE_PATTERN.test(trimmed) || trimmed.toLowerCase().startsWith("ssh://");
}
