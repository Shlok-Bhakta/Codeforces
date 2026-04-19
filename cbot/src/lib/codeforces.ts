import { createHash } from "crypto";
import { loadCodeforcesConfig } from "./config";
import {
  getSolutionFile,
  getLanguageFromId,
  resolveCfProblemRef,
  type CfProblemRef,
} from "./problems";

// Codeforces verdict strings returned by the API
const VERDICT_MAP: Record<string, string> = {
  FAILED: "Failed",
  OK: "Accepted",
  PARTIAL: "Partial",
  COMPILATION_ERROR: "Compile Error",
  RUNTIME_ERROR: "Runtime Error",
  WRONG_ANSWER: "Wrong Answer",
  PRESENTATION_ERROR: "Presentation Error",
  TIME_LIMIT_EXCEEDED: "Time Limit Exceeded",
  MEMORY_LIMIT_EXCEEDED: "Memory Limit Exceeded",
  IDLENESS_LIMIT_EXCEEDED: "Idleness Limit Exceeded",
  SECURITY_VIOLATED: "Security Violated",
  CRASHED: "Crashed",
  INPUT_PREPARATION_CRASHED: "Input Preparation Crashed",
  CHALLENGED: "Challenged",
  SKIPPED: "Skipped",
  TESTING: "Testing",
  REJECTED: "Rejected",
};

// programTypeId values for the submit form
// These are the current CF language IDs (verified from web UI)
const LANG_ID: Record<string, number> = {
  cpp: 89,   // C++20 (GCC 13-64) — fallback if C++23 ID unknown
  python: 71, // Python 3
};

// Language string as returned by CF API (for display)
const LANG_STRING: Record<string, string> = {
  cpp: "C++20 (GCC 13-64)",
  python: "Python 3",
};

export interface SubmissionStatus {
  submissionId?: number;
  statusId: string;
  statusText: string;
  testcasesDone: number;
  testcasesTotal: number;
  done: boolean;
  accepted: boolean;
}

function buildCfApiUrl(
  method: string,
  params: Record<string, string>,
  apiKey: string,
  apiSecret: string
): string {
  const rand = Math.random().toString(36).slice(2, 8).padStart(6, "0");
  const allParams: Record<string, string> = {
    ...params,
    apiKey,
    time: Math.floor(Date.now() / 1000).toString(),
  };

  const sortedParams = Object.entries(allParams)
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const sigBase = `${rand}/${method}?${sortedParams}#${apiSecret}`;
  const hash = createHash("sha512").update(sigBase).digest("hex");
  const apiSig = rand + hash;

  return `https://codeforces.com/api/${method}?${sortedParams}&apiSig=${apiSig}`;
}

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Try to do a browser-assisted login and return session cookies */
async function tryBrowserLogin(): Promise<string | null> {
  try {
    // Open CF in the default browser
    const proc = Bun.spawn(["xdg-open", "https://codeforces.com/enter"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    return null; // Can't extract cookies automatically without browser extension
  } catch {
    return null;
  }
}

/** Load session cookies from .env */
async function getSessionCookies(): Promise<string | null> {
  try {
    const config = await loadCodeforcesConfig();
    if (config.jsessionid && config.cookie39ce7) {
      return `JSESSIONID=${config.jsessionid}; 39ce7=${config.cookie39ce7}`;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Get CSRF token from a CF page */
function getContestBaseUrl(ref: CfProblemRef): string {
  if (ref.groupCode) {
    return `https://codeforces.com/group/${ref.groupCode}/contest/${ref.contestId}`;
  }
  if (ref.isGym) {
    return `https://codeforces.com/gym/${ref.contestId}`;
  }
  return `https://codeforces.com/contest/${ref.contestId}`;
}

function getProblemUrl(ref: CfProblemRef): string {
  return `${getContestBaseUrl(ref)}/problem/${ref.index}`;
}

async function getCsrfToken(
  cookies?: string,
  pageUrl = "https://codeforces.com/problemset"
): Promise<{ csrf: string; cookies: string }> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (cookies) headers["Cookie"] = cookies;

  const resp = await fetch(pageUrl, { headers });
  if (!resp.ok) throw new Error(`Failed to load CF page: ${resp.status}`);

  const html = await resp.text();
  const csrfMatch = html.match(/name="X-Csrf-Token" content="([a-f0-9]+)"/);
  if (!csrfMatch) throw new Error("Could not find CSRF token on CF page");

  // Collect any new cookies
  const setCookies = resp.headers.getSetCookie?.() ?? [];
  const newCookies = setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");

  const mergedCookies = [cookies, newCookies].filter(Boolean).join("; ");
  return { csrf: csrfMatch[1]!, cookies: mergedCookies };
}

export interface SubmitResult {
  submissionId: string;
  submissionUrl: string;
}

export async function submitSolution(
  problemId: string,
  onStatus?: (status: SubmissionStatus) => void
): Promise<{ success: boolean; finalStatus: SubmissionStatus }> {
  const config = await loadCodeforcesConfig();

  const solutionFile = await getSolutionFile(problemId);
  if (!solutionFile) throw new Error("No solution file found");

  const lang = getLanguageFromId(problemId);
  const ref = await resolveCfProblemRef(problemId);
  const source = await Bun.file(solutionFile).text();

  // Try to get session cookies
  let cookies = await getSessionCookies();

  // If no cookies, open browser and tell user to add them
  if (!cookies) {
    await tryBrowserLogin();
    throw new Error(
      "No session cookies found.\n" +
      "To submit from cbot:\n" +
      "  1. Log in to codeforces.com in your browser\n" +
      "  2. Open DevTools → Application → Cookies → codeforces.com\n" +
      "  3. Copy JSESSIONID and 39ce7 values into .env:\n" +
      "     CF_SESSION_JSESSIONID=...\n" +
      "     CF_SESSION_39CE7=...\n\n" +
      "(The CF problem page has been opened in your browser for manual submission)"
    );
  }

  // Get CSRF token
  const contestBaseUrl = getContestBaseUrl(ref);
  const submitUrl = `${contestBaseUrl}/submit`;
  const { csrf, cookies: updatedCookies } = await getCsrfToken(cookies, submitUrl);
  cookies = updatedCookies;

  const formData = new URLSearchParams();
  formData.set("csrf_token", csrf);
  formData.set("action", "submitSolutionFormSubmit");
  formData.set("contestId", String(ref.contestId));
  formData.set("submittedProblemIndex", ref.index);
  formData.set("programTypeId", String(LANG_ID[lang] ?? 89));
  formData.set("source", source);
  formData.set("tabSize", "4");
  formData.set("sourceFile", "");

  const submitResp = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Cookie": cookies,
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": submitUrl,
    },
    body: formData.toString(),
    redirect: "manual",
  });

  // CF redirects to /contest/{id}/my after successful submit
  const location = submitResp.headers.get("location") ?? "";
  if (!location.includes("/my") && submitResp.status !== 302) {
    const body = await submitResp.text();
    // Check for common errors in the response HTML
    const errMatch = body.match(/class="error[^"]*for__source[^"]*"[^>]*>(.*?)<\/span>/s);
    const errMsg = errMatch?.[1]?.replace(/<[^>]+>/g, "").trim();
    throw new Error(errMsg || `Submit failed (status ${submitResp.status}). Check cookies.`);
  }

  // Poll for submission result using CF API
  // Wait a moment for CF to register the submission
  await Bun.sleep(1500);

  if (!config.handle) {
    throw new Error(
      "CF_HANDLE not set in .env — needed to poll submission status"
    );
  }

  // Find our submission by polling user.status
  let submissionId: number | undefined;
  let finalStatus: SubmissionStatus = {
    statusId: "TESTING",
    statusText: "Testing...",
    testcasesDone: 0,
    testcasesTotal: 0,
    done: false,
    accepted: false,
  };

  onStatus?.(finalStatus);

  for (let attempt = 0; attempt < 60; attempt++) {
    await Bun.sleep(attempt === 0 ? 500 : 1500);

    const url = buildCfApiUrl(
      "user.status",
      { handle: config.handle, from: "1", count: "5" },
      config.apiKey,
      config.apiSecret
    );

    const resp = await fetch(url);
    if (!resp.ok) continue;

    const data = (await resp.json()) as {
      status: string;
      result?: Array<{
        id: number;
        problem: { contestId: number; index: string };
        verdict?: string;
        passedTestCount: number;
        programmingLanguage: string;
        creationTimeSeconds: number;
      }>;
    };

    if (data.status !== "OK" || !data.result) continue;

    // Find the submission for this problem (most recent one matching contestId + index)
    const sub = data.result.find(
      (s) =>
        s.problem.contestId === ref.contestId &&
        s.problem.index === ref.index
    );

    if (!sub) continue;

    submissionId = sub.id;
    const verdict = sub.verdict ?? "TESTING";
    const isDone = verdict !== "TESTING";

    finalStatus = {
      submissionId: sub.id,
      statusId: verdict,
      statusText: VERDICT_MAP[verdict] ?? verdict,
      testcasesDone: sub.passedTestCount,
      testcasesTotal: 0,
      done: isDone,
      accepted: verdict === "OK",
    };

    onStatus?.(finalStatus);
    if (isDone) break;
  }

  return { success: finalStatus.accepted, finalStatus };
}

/** Open the CF problem page in the browser (fallback for manual submission) */
export async function openProblemInBrowser(problemId: string): Promise<void> {
  const ref = await resolveCfProblemRef(problemId);
  const url = getProblemUrl(ref);
  try {
    Bun.spawn(["xdg-open", url], { stdout: "ignore", stderr: "ignore" });
  } catch {
    // silently ignore
  }
}
