import { join } from "path";
import { appendFileSync } from "fs";
import { loadCodeforcesConfig, buildCfApiUrl } from "./config";

const PROBLEMS_DIR = join(import.meta.dir, "../../../problems");
const PROBLEMS_JSON = join(PROBLEMS_DIR, "problems.json");
const LOG_FILE = "/tmp/cbot-debug.log";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Fetch a URL via curl subprocess to bypass Cloudflare TLS fingerprinting. */
async function curlFetch(url: string): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }> {
  const result = await Bun.$`curl -s -L -w "\n__STATUS__%{http_code}" -A ${USER_AGENT} ${url}`.quiet().text();
  const statusMatch = result.match(/\n__STATUS__(\d+)$/);
  const status = statusMatch ? parseInt(statusMatch[1]!, 10) : 0;
  const body = statusMatch ? result.slice(0, result.lastIndexOf("\n__STATUS__")) : result;
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

function log(msg: string) {
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
  } catch {
    // ignore logging errors
  }
}

export interface ProblemMetadata {
  title: string;
  cpuLimit: string;
  memoryLimit: string;
  difficulty: string;
  description: string;
  tags?: string[];
  contestId?: number;
  index?: string;
  isGym?: boolean;
}

export interface Problem {
  id: string;
  name: string;
  addedAt: number;
  metadata?: ProblemMetadata;
  timeSpentMs?: number;
  solved?: boolean;
  solvedAt?: number;
}

/** Parsed Codeforces problem reference */
export interface CfProblemRef {
  contestId: number;
  index: string;
  isGym: boolean;
}

export function getLanguageFromId(id: string): "python" | "cpp" {
  if (id.endsWith("-cpp")) return "cpp";
  return "python";
}

/** Extract the contestId/index portion from an internal problem ID like "1A-cpp" */
export function getCfRefFromId(id: string): CfProblemRef {
  // Remove the language suffix
  const base = id.replace(/-(?:py|cpp)$/, "");
  // base is like "1A", "100B", "gym100001A"
  const gymMatch = base.match(/^gym(\d+)([A-Z][1-9]?)$/i);
  if (gymMatch) {
    return {
      contestId: parseInt(gymMatch[1]!, 10),
      index: gymMatch[2]!.toUpperCase(),
      isGym: true,
    };
  }
  const match = base.match(/^(\d+)([A-Z][1-9]?)$/i);
  if (match) {
    return {
      contestId: parseInt(match[1]!, 10),
      index: match[2]!.toUpperCase(),
      isGym: false,
    };
  }
  // Fallback — shouldn't happen
  return { contestId: 0, index: base, isGym: false };
}

export async function getProblemsDir(): Promise<string> {
  await Bun.$`mkdir -p ${PROBLEMS_DIR}`.quiet();
  return PROBLEMS_DIR;
}

export async function loadProblems(): Promise<Problem[]> {
  const file = Bun.file(PROBLEMS_JSON);
  if (!(await file.exists())) {
    return [];
  }
  try {
    return await file.json();
  } catch {
    return [];
  }
}

export async function saveProblems(problems: Problem[]): Promise<void> {
  await getProblemsDir();
  await Bun.write(PROBLEMS_JSON, JSON.stringify(problems, null, 2));
}

export async function addProblem(problem: Problem): Promise<void> {
  const problems = await loadProblems();
  const existing = problems.findIndex((p) => p.id === problem.id);
  if (existing >= 0) {
    problems[existing] = problem;
  } else {
    problems.push(problem);
  }
  await saveProblems(problems);
}

export async function removeProblem(id: string): Promise<void> {
  const problems = await loadProblems();
  const filtered = problems.filter((p) => p.id !== id);
  await saveProblems(filtered);
  const problemDir = join(PROBLEMS_DIR, id);
  await Bun.$`rm -rf ${problemDir}`.quiet();
}

export async function getProblemDir(id: string): Promise<string> {
  const dir = join(PROBLEMS_DIR, id);
  await Bun.$`mkdir -p ${dir}`.quiet();
  return dir;
}

/**
 * Parse a CF problem URL or short form into a CfProblemRef + language.
 * Accepted formats:
 *   https://codeforces.com/contest/1/problem/A
 *   https://codeforces.com/problemset/problem/1/A
 *   https://codeforces.com/gym/100001/problem/A
 *   1/A   or   1A   (contestId + index)
 */
export function parseCfInput(
  input: string,
  language: "python" | "cpp"
): { ref: CfProblemRef; internalId: string } | null {
  const s = input.trim();

  // Gym URL
  let m = s.match(
    /https?:\/\/codeforces\.com\/gym\/(\d+)\/problem\/([A-Z][1-9]?)/i
  );
  if (m) {
    const ref: CfProblemRef = {
      contestId: parseInt(m[1]!, 10),
      index: m[2]!.toUpperCase(),
      isGym: true,
    };
    const suffix = language === "python" ? "py" : "cpp";
    return { ref, internalId: `gym${ref.contestId}${ref.index}-${suffix}` };
  }

  // Contest or problemset URL
  m = s.match(
    /https?:\/\/codeforces\.com\/(?:contest|problemset\/problem)\/(\d+)\/(?:problem\/)?([A-Z][1-9]?)/i
  );
  if (m) {
    const ref: CfProblemRef = {
      contestId: parseInt(m[1]!, 10),
      index: m[2]!.toUpperCase(),
      isGym: false,
    };
    const suffix = language === "python" ? "py" : "cpp";
    return { ref, internalId: `${ref.contestId}${ref.index}-${suffix}` };
  }

  // Short form: "1/A" or "1A" or "1 A"
  m = s.match(/^(\d+)\s*[\/\s]\s*([A-Z][1-9]?)$/i);
  if (m) {
    const ref: CfProblemRef = {
      contestId: parseInt(m[1]!, 10),
      index: m[2]!.toUpperCase(),
      isGym: false,
    };
    const suffix = language === "python" ? "py" : "cpp";
    return { ref, internalId: `${ref.contestId}${ref.index}-${suffix}` };
  }

  m = s.match(/^(\d+)([A-Z][1-9]?)$/i);
  if (m) {
    const ref: CfProblemRef = {
      contestId: parseInt(m[1]!, 10),
      index: m[2]!.toUpperCase(),
      isGym: false,
    };
    const suffix = language === "python" ? "py" : "cpp";
    return { ref, internalId: `${ref.contestId}${ref.index}-${suffix}` };
  }

  return null;
}

function cfProblemUrl(ref: CfProblemRef): string {
  if (ref.isGym) {
    return `https://codeforces.com/gym/${ref.contestId}/problem/${ref.index}`;
  }
  return `https://codeforces.com/problemset/problem/${ref.contestId}/${ref.index}`;
}

/**
 * Fetch the CF problem page HTML and extract sample test cases.
 * Returns array of { input, output } strings.
 */
async function fetchSampleTests(
  ref: CfProblemRef
): Promise<{ input: string; output: string }[]> {
  const url = cfProblemUrl(ref);
  log(`fetchSampleTests: ${url}`);

  const response = await curlFetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch problem page: ${response.status} ${url}`);
  }

  const html = await response.text();
  log(`fetchSampleTests: got ${html.length} bytes`);

  // Pattern: <div class="input"><div class="title">Input</div><pre>CONTENT</pre></div>
  const inputRe =
    /<div class="input">(?:<div class="title">[^<]*<\/div>)?\s*<pre>([\s\S]*?)<\/pre>/g;
  const outputRe =
    /<div class="output">(?:<div class="title">[^<]*<\/div>)?\s*<pre>([\s\S]*?)<\/pre>/g;

  const inputs: string[] = [];
  const outputs: string[] = [];

  function parsePreContent(raw: string): string {
    return raw
      // CF wraps each line in <div class="test-example-line ...">...</div>
      // Replace closing div tags with newlines before stripping all tags
      .replace(/<\/div>/gi, "\n")
      // Replace <br /> and <br/> with newlines
      .replace(/<br\s*\/?>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse multiple consecutive newlines into a single newline
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  let match: RegExpExecArray | null;
  while ((match = inputRe.exec(html)) !== null) {
    inputs.push(parsePreContent(match[1]!));
  }

  while ((match = outputRe.exec(html)) !== null) {
    outputs.push(parsePreContent(match[1]!));
  }

  log(`fetchSampleTests: found ${inputs.length} inputs, ${outputs.length} outputs`);

  const samples: { input: string; output: string }[] = [];
  const count = Math.min(inputs.length, outputs.length);
  for (let i = 0; i < count; i++) {
    samples.push({ input: inputs[i]!, output: outputs[i]! });
  }
  return samples;
}

/**
 * Fetch problem metadata using the CF API (no auth needed for public data).
 * For rating/tags uses the problemset API; title/limits from the HTML page.
 */
export async function fetchProblemMetadata(
  ref: CfProblemRef
): Promise<ProblemMetadata> {
  log(`fetchProblemMetadata: ${ref.contestId}${ref.index} gym=${ref.isGym}`);

  // Fetch HTML for title and limits
  const url = cfProblemUrl(ref);
  const response = await curlFetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch problem page: ${response.status}`);
  }

  const html = await response.text();

  // Title: <div class="title">A. Theatre Square</div>
  const titleMatch = html.match(
    /<div class="title">\s*[A-Z][^.]*\.\s*([^<]+)<\/div>/
  );
  const title = titleMatch?.[1]?.trim() ?? `${ref.contestId}${ref.index}`;

  // Time limit: "2 seconds"
  const tlMatch = html.match(/(\d+(?:\.\d+)?)\s*second/i);
  const cpuLimit = tlMatch ? `${tlMatch[1]}s` : "?";

  // Memory limit: "256 megabytes"
  const mlMatch = html.match(/(\d+)\s*megabyte/i);
  const memoryLimit = mlMatch ? `${mlMatch[1]} MB` : "?";

  // Description: .problem-statement .header + body
  let description = "";
  const bodyMatch = html.match(
    /<div class="problem-statement">([\s\S]*?)<div class="sample-tests">/
  );
  if (bodyMatch) {
    description = bodyMatch[1]!
      .replace(/<div class="header">[\s\S]*?<\/div>/g, "")
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n$1\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<\/div>/gi, "\n")
      .replace(/<div[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n +/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Fetch rating/tags from CF API (only works for non-gym problems)
  let difficulty = "?";
  let tags: string[] = [];

  if (!ref.isGym) {
    try {
      const apiUrl = `https://codeforces.com/api/contest.standings?contestId=${ref.contestId}&from=1&count=1`;
      const apiResp = await curlFetch(apiUrl);
      if (apiResp.ok) {
        const data = (await apiResp.json()) as {
          status: string;
          result?: {
            problems?: Array<{
              index: string;
              rating?: number;
              tags?: string[];
            }>;
          };
        };
        if (data.status === "OK" && data.result?.problems) {
          const prob = data.result.problems.find(
            (p) => p.index === ref.index
          );
          if (prob) {
            if (prob.rating) difficulty = String(prob.rating);
            if (prob.tags) tags = prob.tags;
          }
        }
      }
    } catch (e) {
      log(`Failed to fetch rating/tags: ${e}`);
    }
  }

  return {
    title,
    cpuLimit,
    memoryLimit,
    difficulty,
    description,
    tags,
    contestId: ref.contestId,
    index: ref.index,
    isGym: ref.isGym,
  };
}

export async function initProblem(
  input: string,
  language: "python" | "cpp",
): Promise<Problem> {
  log(`=== initProblem START ===`);
  log(`input: ${input}, language: ${language}`);

  const parsed = parseCfInput(input, language);
  if (!parsed) {
    throw new Error(
      `Could not parse problem: "${input}"\n` +
      `Try formats like: 1A, 1/A, https://codeforces.com/contest/1/problem/A`
    );
  }

  const { ref, internalId } = parsed;
  log(`ref: ${JSON.stringify(ref)}, internalId: ${internalId}`);

  const problemDir = await getProblemDir(internalId);
  const samplesDir = join(problemDir, "samples");
  await Bun.$`mkdir -p ${samplesDir}`.quiet();

  // Fetch and write sample test cases
  const samples = await fetchSampleTests(ref);
  log(`Found ${samples.length} sample tests`);

  if (samples.length === 0) {
    log("WARNING: No sample tests found");
  }

  for (let i = 0; i < samples.length; i++) {
    const num = i + 1;
    await Bun.write(join(samplesDir, `${num}.in`), samples[i]!.input + "\n");
    await Bun.write(join(samplesDir, `${num}.ans`), samples[i]!.output + "\n");
  }

  // Create solution template
  const solutionFile =
    language === "python"
      ? join(problemDir, "solution.py")
      : join(problemDir, "solution.cpp");

  const solutionExists = await Bun.file(solutionFile).exists();
  if (!solutionExists) {
    let template: string;
    if (language === "python") {
      template = `# ${ref.contestId}${ref.index}\n\n`;
    } else {
      const templatePath = join(
        import.meta.dir,
        "../../templates/cpp-template.cpp"
      );
      const templateFile = Bun.file(templatePath);
      if (await templateFile.exists()) {
        template = await templateFile.text();
        template = template.replace(
          "{{PROBLEM_ID}}",
          `${ref.contestId}${ref.index}`
        );
      } else {
        template = `// ${ref.contestId}${ref.index}\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    return 0;\n}\n`;
      }
    }
    await Bun.write(solutionFile, template);
  }

  // Fetch metadata
  let metadata: ProblemMetadata | undefined;
  try {
    metadata = await fetchProblemMetadata(ref);
    log(`Metadata: title=${metadata.title}, difficulty=${metadata.difficulty}`);
  } catch (e) {
    log(`Failed to fetch metadata: ${e}`);
    metadata = undefined;
  }

  const problem: Problem = {
    id: internalId,
    name: metadata?.title || `${ref.contestId}${ref.index}`,
    addedAt: Date.now(),
    metadata,
    timeSpentMs: 0,
    solved: false,
  };

  log(`Problem: ${JSON.stringify(problem, null, 2)}`);
  log(`=== initProblem END ===`);

  await addProblem(problem);
  return problem;
}

export async function getSampleFiles(
  problemId: string
): Promise<{ name: string; inFile: string; ansFile: string }[]> {
  const problemDir = await getProblemDir(problemId);
  const samplesDir = join(problemDir, "samples");

  const glob = new Bun.Glob("*.in");
  const samples: { name: string; inFile: string; ansFile: string }[] = [];

  for await (const inFile of glob.scan(samplesDir)) {
    const name = inFile.replace(".in", "");
    const ansFile = inFile.replace(".in", ".ans");
    const ansPath = join(samplesDir, ansFile);
    if (await Bun.file(ansPath).exists()) {
      samples.push({
        name,
        inFile: join(samplesDir, inFile),
        ansFile: ansPath,
      });
    }
  }

  return samples.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCustomTestCase(problemId: string): Promise<void> {
  const problemDir = await getProblemDir(problemId);
  const samplesDir = join(problemDir, "samples");

  const glob = new Bun.Glob("c*.in");
  let maxNum = 0;
  for await (const file of glob.scan(samplesDir)) {
    const match = file.match(/^c(\d+)\.in$/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1]!, 10));
    }
  }

  const nextNum = maxNum + 1;
  const newInFile = join(samplesDir, `c${nextNum}.in`);
  const newAnsFile = join(samplesDir, `c${nextNum}.ans`);

  const samples = await getSampleFiles(problemId);
  if (samples.length === 0) {
    await Bun.write(newInFile, "");
    await Bun.write(newAnsFile, "");
  } else {
    const firstSample = samples[0]!;
    const inContent = await Bun.file(firstSample.inFile).text();
    const ansContent = await Bun.file(firstSample.ansFile).text();
    await Bun.write(newInFile, inContent);
    await Bun.write(newAnsFile, ansContent);
  }
}

export async function deleteTestCase(
  problemId: string,
  testName: string
): Promise<void> {
  const problemDir = await getProblemDir(problemId);
  const samplesDir = join(problemDir, "samples");

  const inFile = join(samplesDir, `${testName}.in`);
  const ansFile = join(samplesDir, `${testName}.ans`);

  await Bun.$`rm -f ${inFile} ${ansFile}`.quiet();
}

export async function getSolutionFile(
  problemId: string
): Promise<string | null> {
  const problemDir = await getProblemDir(problemId);
  const lang = getLanguageFromId(problemId);
  const file =
    lang === "python"
      ? join(problemDir, "solution.py")
      : join(problemDir, "solution.cpp");

  if (await Bun.file(file).exists()) return file;
  return null;
}

export async function refreshProblemMetadata(
  problemId: string
): Promise<Problem | null> {
  log(`=== refreshProblemMetadata START ===`);

  const problems = await loadProblems();
  const problemIndex = problems.findIndex((p) => p.id === problemId);
  if (problemIndex < 0) return null;

  const ref = getCfRefFromId(problemId);
  const metadata = await fetchProblemMetadata(ref);

  const problem = problems[problemIndex]!;
  problem.metadata = metadata;
  problem.name = metadata.title;

  await saveProblems(problems);
  log(`=== refreshProblemMetadata END ===`);
  return problem;
}

export async function updateProblemTimeSpent(
  problemId: string,
  additionalMs: number
): Promise<void> {
  const problems = await loadProblems();
  const problemIndex = problems.findIndex((p) => p.id === problemId);

  if (problemIndex >= 0) {
    const problem = problems[problemIndex]!;
    problem.timeSpentMs = (problem.timeSpentMs || 0) + additionalMs;
    await saveProblems(problems);
  }
}

export async function markProblemAsSolved(problemId: string): Promise<void> {
  const problems = await loadProblems();
  const problemIndex = problems.findIndex((p) => p.id === problemId);

  if (problemIndex >= 0) {
    const problem = problems[problemIndex]!;
    problem.solved = true;
    problem.solvedAt = Date.now();
    await saveProblems(problems);
  }
}

export async function commitProblemDir(problemId: string): Promise<void> {
  log(`=== commitProblemDir START ===`);
  try {
    const problemDir = await getProblemDir(problemId);
    const gitRoot = join(problemDir, "../..");
    const problemsJson = PROBLEMS_JSON;
    const statusResult = await Bun.$`git -C ${gitRoot} status --porcelain ${problemDir} ${problemsJson}`
      .quiet()
      .text();

    if (statusResult.trim().length === 0) {
      log(`No changes to commit`);
      return;
    }

    await Bun.$`git -C ${gitRoot} add ${problemDir} ${problemsJson}`.quiet();
    const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
    const commitMessage = `WIP: ${problemId} - ${timestamp}`;
    await Bun.$`git -C ${gitRoot} commit -m ${commitMessage}`.quiet();
    log(`Commit created: ${commitMessage}`);
  } catch (e) {
    log(`Failed to commit: ${e}`);
  }
  log(`=== commitProblemDir END ===`);
}

// Keep extractProblemId as a compatibility shim (used in ProblemList)
export function extractProblemId(input: string): string {
  return input.trim();
}
