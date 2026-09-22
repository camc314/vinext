import { describe, expect, it } from "vite-plus/test";
import { resolveModuleMetadata } from "../packages/vinext/src/shims/metadata.js";

// Ported from Next.js: test/e2e/app-dir/metadata/metadata.test.ts
// https://github.com/vercel/next.js/blob/v16.2.6/test/e2e/app-dir/metadata/metadata.test.ts
describe("generateMetadata parent values", () => {
  it("supplies keyword arrays and string URLs to child resolvers", async () => {
    const result = await resolveModuleMetadata(
      {
        async generateMetadata(
          _props: unknown,
          parent: Promise<{ keywords: string[]; metadataBase: string }>,
        ) {
          const metadata = await parent;
          return {
            keywords: metadata.keywords.concat(["child"]),
            metadataBase: metadata.metadataBase.replace("base", "case"),
          };
        },
      },
      {},
      undefined,
      Promise.resolve({ keywords: "parent", metadataBase: new URL("https://example.com/base") }),
    );
    expect(result).toEqual({
      keywords: ["parent", "child"],
      metadataBase: "https://example.com/case",
    });
  });

  it("clones normalized parent arrays without mutating ancestor metadata", async () => {
    const parent = {
      keywords: ["parent"],
      authors: { name: "Author", url: "https://example.com/author" },
    };
    const result = await resolveModuleMetadata(
      {
        async generateMetadata(
          _props: unknown,
          resolving: Promise<{
            keywords: string[];
            authors: unknown[];
          }>,
        ) {
          const metadata = await resolving;
          expect(metadata.authors).toEqual([parent.authors]);

          metadata.keywords.push("child");
          return { keywords: metadata.keywords };
        },
      },
      {},
      undefined,
      Promise.resolve(parent),
    );
    expect(result?.keywords).toEqual(["parent", "child"]);
    expect(parent.keywords).toEqual(["parent"]);
  });
});
