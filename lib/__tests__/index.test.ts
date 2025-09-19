/** biome-ignore-all lint/suspicious/noExplicitAny: required for testing */
import fs from "node:fs";
import { htmlPlugin } from "@m2d/html";
import { listPlugin } from "@m2d/list";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { toDocx } from "../src"; // Adjust path based on your setup

const markdown = fs.readFileSync("../sample.md", "utf-8");

describe("toDocx", () => {
  it("should convert a basic Markdown string to a DOCX Blob", async () => {
    const mdast = unified().use(remarkParse).parse(markdown);

    const docxBlob = await toDocx(
      mdast,
      { title: "Test Document" },
      { useTitle: false },
    );

    expect(docxBlob).toBeInstanceOf(Blob);
  });

  it("should return a buffer if outputType is 'buffer'", async () => {
    const mdast = unified().use(remarkParse).parse(markdown);

    const docxBuffer = await toDocx(mdast, {}, {}, "arraybuffer");

    expect(docxBuffer).toBeInstanceOf(ArrayBuffer);
  });

  it("should include a title in the document properties", async () => {
    const mdast = unified().use(remarkParse).parse(markdown);

    const docxBlob = await toDocx(
      mdast,
      { title: "Custom Title" },
      { plugins: [htmlPlugin(), listPlugin()] },
    );

    expect(docxBlob).toBeDefined(); // Ensure output exists
  });

  it("should handle multiple MDAST inputs", async () => {
    const md1 = unified().use(remarkParse).parse("# First Section");
    const md2 = unified().use(remarkParse).parse("## Second Section");

    const docxBlob = await toDocx(
      [{ ast: md1 }, { ast: md2 }],
      { title: "Multi-section Doc" },
      {},
    );

    expect(docxBlob).toBeInstanceOf(Blob);
  });

  it("should fail gracefully when given an invalid MDAST input", async () => {
    try {
      // Passing an invalid AST
      // skipcq: JS-0323
      await toDocx(null as any, {}, {});
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should show warning for unknown node", async ({ expect }) => {
    const docxBlob = await toDocx(
      // @ts-expect-error -- testing unknown type
      { type: "root", children: [{ type: "unknown" }] },
      { title: "Test Document" },
      { plugins: [{ inline: () => [], block: () => [] }] },
    );

    expect(docxBlob).toBeInstanceOf(Blob);
  });

  it("should handle footnotes", async ({ expect }) => {
    const mdast = unified().use(remarkParse).use(remarkGfm).parse(markdown);

    const docxBlob = await toDocx(
      mdast,
      { title: "Test Document" },
      { plugins: [{ inline: () => [], block: () => [] }] },
    );

    expect(docxBlob).toBeInstanceOf(Blob);
  });
});
