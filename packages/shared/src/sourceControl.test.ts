import { describe, expect, it } from "vite-plus/test";
import { graphitePullRequestUrl } from "./sourceControl.ts";

describe("graphitePullRequestUrl", () => {
  it("rewrites a github.com pull request to its Graphite address", () => {
    expect(graphitePullRequestUrl("https://github.com/t3-oss/t3-code/pull/42")).toBe(
      "https://app.graphite.dev/github/pr/t3-oss/t3-code/42",
    );
  });

  it("ignores the trailing segments GitHub adds to a pull request path", () => {
    expect(graphitePullRequestUrl("https://github.com/t3-oss/t3-code/pull/42/files#diff-1")).toBe(
      "https://app.graphite.dev/github/pr/t3-oss/t3-code/42",
    );
  });

  it("shows nothing for links Graphite cannot open", () => {
    // Enterprise installs, other hosts, and anything on github.com that is not a pull request.
    expect(graphitePullRequestUrl("https://github.example.test/owner/repo/pull/42")).toBeNull();
    expect(graphitePullRequestUrl("https://gitlab.com/group/repo/-/merge_requests/42")).toBeNull();
    expect(graphitePullRequestUrl("https://github.com/t3-oss/t3-code/issues/42")).toBeNull();
    expect(graphitePullRequestUrl("https://github.com/t3-oss/t3-code")).toBeNull();
    expect(graphitePullRequestUrl("not a url")).toBeNull();
  });
});
