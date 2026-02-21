import { describe, test, expect } from "bun:test";
import { fetchProblemMetadata, extractProblemId } from "./problems";

describe("extractProblemId", () => {
  test("extracts ID from URL", () => {
    expect(extractProblemId("https://open.kattis.com/problems/hello")).toBe("hello");
    expect(extractProblemId("https://nus.kattis.com/problems/nsum")).toBe("nsum");
  });

  test("handles direct ID input", () => {
    expect(extractProblemId("hello")).toBe("hello");
    expect(extractProblemId("HELLO")).toBe("hello");
  });

  test("handles IDs with hyphens and underscores", () => {
    expect(extractProblemId("army-strength-hard")).toBe("army-strength-hard");
    expect(extractProblemId("test_case_123")).toBe("test_case_123");
  });
});

describe("fetchProblemMetadata", () => {
  test("fetches metadata for hello problem", async () => {
    const metadata = await fetchProblemMetadata("hello", "open.kattis.com");
    
    expect(metadata.title).toBe("Hello World!");
    expect(metadata.cpuLimit).toBe("5 seconds");
    expect(metadata.memoryLimit).toBe("1024 MB");
    expect(metadata.difficulty).toBe("Easy");
    expect(metadata.description).toContain("Input");
    expect(metadata.description).toContain("Output");
    expect(metadata.description).toContain("World");
  }, 10000);

  test("fetches metadata for nsum problem", async () => {
    const metadata = await fetchProblemMetadata("nsum", "open.kattis.com");
    
    expect(metadata.title).toBeTruthy();
    expect(metadata.cpuLimit).toBeTruthy();
    expect(metadata.memoryLimit).toBeTruthy();
    expect(metadata.difficulty).toBeTruthy();
    expect(metadata.description).toBeTruthy();
  }, 10000);

  test("parses CPU limit correctly", async () => {
    const metadata = await fetchProblemMetadata("hello", "open.kattis.com");
    expect(metadata.cpuLimit).toMatch(/\d+(\.\d+)?\s*(second|seconds|s)/i);
  }, 10000);

  test("parses memory limit correctly", async () => {
    const metadata = await fetchProblemMetadata("hello", "open.kattis.com");
    expect(metadata.memoryLimit).toMatch(/\d+\s*(MB|GB)/i);
  }, 10000);

  test("handles HTML entities in description", async () => {
    const metadata = await fetchProblemMetadata("hello", "open.kattis.com");
    expect(metadata.description).not.toContain("&nbsp;");
    expect(metadata.description).not.toContain("&lt;");
    expect(metadata.description).not.toContain("&gt;");
    expect(metadata.description).not.toContain("&amp;");
  }, 10000);

  test("strips HTML tags from description", async () => {
    const metadata = await fetchProblemMetadata("hello", "open.kattis.com");
    expect(metadata.description).not.toContain("<div");
    expect(metadata.description).not.toContain("<p>");
    expect(metadata.description).not.toContain("</p>");
    expect(metadata.description).not.toContain("<h2>");
  }, 10000);
});
