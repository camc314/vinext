import { describe, expect, it } from "vite-plus/test";
import {
  renderMetadataToHtml,
  resolveModuleMetadata,
  type Metadata,
} from "../packages/vinext/src/shims/metadata.js";

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

  it("supplies resolved title and robots values to child resolvers", async () => {
    const result = await resolveModuleMetadata(
      {
        async generateMetadata(
          _props: unknown,
          resolving: Promise<{ title: { absolute: string }; robots: { basic: string } }>,
        ) {
          const parent = await resolving;
          return {
            title: `${parent.title.absolute} child`,
            description: parent.robots.basic,
            robots: parent.robots,
          };
        },
      },
      {},
      undefined,
      Promise.resolve({ title: "Parent", robots: { index: false, follow: true } }),
    );
    expect(result).toMatchObject({ title: "Parent child", description: "noindex, follow" });
    expect(renderMetadataToHtml(result!)).toContain('name="robots" content="noindex, follow"');
  });

  it("does not let child mutations change nested ancestor metadata", async () => {
    const parent = {
      authors: [{ name: "Original" }],
      openGraph: { images: [{ url: new URL("https://example.com/og.png") }] },
    };
    await resolveModuleMetadata(
      {
        async generateMetadata(
          _props: unknown,
          resolving: Promise<{
            authors: Array<{ name: string }>;
            openGraph: { images: Array<{ url: string | URL }> };
          }>,
        ) {
          const metadata = await resolving;
          metadata.authors[0].name = "Changed";
          metadata.openGraph.images[0].url = "https://example.com/other.png";
          return {};
        },
      },
      {},
      undefined,
      Promise.resolve(parent),
    );
    expect(parent.authors[0].name).toBe("Original");
    expect(parent.openGraph.images[0].url.toString()).toBe("https://example.com/og.png");
  });

  it("converts URL values nested in the resolved parent without mutating the source", async () => {
    const parent = {
      authors: [{ url: new URL("https://example.com/author") }],
      openGraph: { images: [{ url: new URL("https://example.com/og.png") }] },
      icons: { icon: [{ url: new URL("https://example.com/icon.ico") }] },
      appLinks: { ios: [{ url: new URL("https://example.com/app") }] },
    };
    await resolveModuleMetadata(
      {
        async generateMetadata(
          _props: unknown,
          resolving: Promise<{
            authors: Array<{ url: string }>;
            openGraph: { images: Array<{ url: string }> };
            icons: { icon: Array<{ url: string }> };
            appLinks: { ios: Array<{ url: string }> };
          }>,
        ) {
          const metadata = await resolving;
          expect(metadata.authors[0].url.replace("author", "writer")).toBe(
            "https://example.com/writer",
          );
          expect(metadata.openGraph.images[0].url.replace("og", "image")).toBe(
            "https://example.com/image.png",
          );
          expect(metadata.icons.icon[0].url).toBe("https://example.com/icon.ico");
          expect(metadata.appLinks.ios[0].url).toBe("https://example.com/app");
          return {};
        },
      },
      {},
      undefined,
      Promise.resolve(parent as unknown as Metadata),
    );
    expect(parent.authors[0].url).toBeInstanceOf(URL);
    expect(parent.openGraph.images[0].url).toBeInstanceOf(URL);
  });

  it("preserves URL-instance canonical resolution when children spread parent metadata", async () => {
    const result = await resolveModuleMetadata(
      {
        async generateMetadata(_props: unknown, resolving: Promise<Metadata>) {
          return { ...(await resolving) };
        },
      },
      {},
      undefined,
      Promise.resolve({
        alternates: { canonical: { url: new URL("https://other.example/root?ref=source") } },
      }),
      undefined,
      "/article",
    );
    expect(renderMetadataToHtml(result!, "/article")).toContain(
      'rel="canonical" href="https://other.example/article?ref=source"',
    );
  });
});
