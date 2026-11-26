import { describe, expect, it } from "vitest";
import { assignRepoId, normalizeRemoteUrl, repoKey, slugify } from "../../src/domain/index.ts";

describe("repo identity (S-09)", () => {
  it("test_s09_two_repos_named_api_with_different_remotes_get_api_and_api_2", () => {
    const first = repoKey({ remoteUrl: "git@github.com:Acme/api.git", path: "C:/work/api" });
    const second = repoKey({ remoteUrl: "https://gitlab.com/other/api.git", path: "C:/work/api2" });
    expect(first).not.toBe(second);

    const known: Record<string, string> = {};
    known[first] = assignRepoId("api", first, known);
    known[second] = assignRepoId("api", second, known);

    expect(known[first]).toBe("api");
    expect(known[second]).toBe("api-2");
    // opening the first repo again keeps its id
    expect(assignRepoId("api", first, known)).toBe("api");
  });

  it("test_s09_a_repo_with_no_remote_is_keyed_by_its_lowercased_path", () => {
    expect(repoKey({ path: "C:\\Work\\MyRepo" })).toBe("path:c:\\work\\myrepo");
    expect(repoKey({ remoteUrl: "  ", path: "C:\\Work\\MyRepo" })).toBe("path:c:\\work\\myrepo");
    expect(repoKey({ remoteUrl: null, path: "/Home/Me/Repo", caseInsensitivePath: false })).toBe(
      "path:/Home/Me/Repo",
    );
  });

  it("gives the same key to every spelling of one remote", () => {
    const spellings = [
      "git@github.com:Acme/api.git",
      "https://user@GitHub.com/Acme/api.git/",
      "ssh://git@github.com:22/Acme/api",
      "github.com/Acme/api",
    ];
    for (const url of spellings) expect(normalizeRemoteUrl(url)).toBe("github.com/Acme/api");
  });

  it("keeps a non-ssh port in the key", () => {
    expect(normalizeRemoteUrl("https://git.example.com:8443/a/b.git")).toBe(
      "git.example.com:8443/a/b",
    );
  });

  it("slugifies folder names and finds the next free suffix", () => {
    expect(slugify("My Notes_App!")).toBe("my-notes-app");
    expect(slugify("***")).toBe("repo");
    const known = { a: "api", b: "api-2", c: "api-3" };
    expect(assignRepoId("API", "d", known)).toBe("api-4");
  });
});
