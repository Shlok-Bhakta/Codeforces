import { loadKattisConfig, type KattisConfig } from "./config";
import { getSolutionFile, getKattisIdFromId } from "./problems";

const STATUS_MAP: Record<number, string> = {
  0: "New",
  1: "New",
  2: "Waiting for compile",
  3: "Compiling",
  4: "Waiting for run",
  5: "Running",
  6: "Judge Error",
  8: "Compile Error",
  9: "Run Time Error",
  10: "Memory Limit Exceeded",
  11: "Output Limit Exceeded",
  12: "Time Limit Exceeded",
  13: "Illegal Function",
  14: "Wrong Answer",
  16: "Accepted",
};

const LANGUAGE_MAP: Record<string, string> = {
  ".py": "Python 3",
  ".cpp": "C++",
};

interface LoginResult {
  cookies: string;
}

async function login(config: KattisConfig): Promise<LoginResult> {
  const formData = new URLSearchParams();
  formData.append("user", config.username);
  formData.append("token", config.token);
  formData.append("script", "true");

  const response = await fetch(config.loginurl, {
    method: "POST",
    body: formData,
    headers: {
      "User-Agent": "kbot-cli",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    redirect: "manual",
  });

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const cookies = response.headers.getSetCookie().join("; ");
  return { cookies };
}

export interface SubmissionStatus {
  statusId: number;
  statusText: string;
  testcasesDone: number;
  testcasesTotal: number;
  done: boolean;
  accepted: boolean;
}

interface StatusResponse {
  status_id: number;
  testcase_index?: number;
  row_html?: string;
}

async function getSubmissionStatus(
  submissionUrl: string,
  cookies: string
): Promise<SubmissionStatus> {
  const response = await fetch(`${submissionUrl}?json`, {
    headers: {
      "User-Agent": "kbot-cli",
      Cookie: cookies,
    },
  });

  const data = (await response.json()) as StatusResponse;
  const statusId = data.status_id;
  const testcasesDone = data.testcase_index ?? 0;
  const rowHtml = data.row_html ?? "";
  const testcasesTotal = (rowHtml.match(/<i/g) || []).length - 1;

  return {
    statusId,
    statusText: STATUS_MAP[statusId] || `Unknown (${statusId})`,
    testcasesDone,
    testcasesTotal: Math.max(0, testcasesTotal),
    done: statusId > 5,
    accepted: statusId === 16,
  };
}

export interface SubmitResult {
  submissionId: string;
  submissionUrl: string;
}

export async function submitSolution(
  problemId: string,
  onStatus?: (status: SubmissionStatus) => void
): Promise<{ success: boolean; finalStatus: SubmissionStatus }> {
  const config = await loadKattisConfig();
  const { cookies } = await login(config);

  const solutionFile = await getSolutionFile(problemId);
  if (!solutionFile) {
    throw new Error("No solution file found");
  }

  const ext = solutionFile.endsWith(".py") ? ".py" : ".cpp";
  const language = LANGUAGE_MAP[ext];
  const filename = solutionFile.split("/").pop()!;
  const content = await Bun.file(solutionFile).text();

  const formData = new FormData();
  formData.append("submit", "true");
  formData.append("submit_ctr", "2");
  formData.append("language", language ?? "Python 3");
  formData.append("problem", getKattisIdFromId(problemId));
  formData.append("script", "true");
  formData.append(
    "sub_file[]",
    new Blob([content], { type: "application/octet-stream" }),
    filename
  );

  const submitResponse = await fetch(config.submissionurl, {
    method: "POST",
    body: formData,
    headers: {
      "User-Agent": "kbot-cli",
      Cookie: cookies,
    },
  });

  if (submitResponse.status !== 200) {
    throw new Error(`Submit failed: ${submitResponse.status}`);
  }

  const resultText = await submitResponse.text();
  const match = resultText.match(/Submission ID: (\d+)/);
  if (!match) {
    throw new Error(`Could not parse submission ID: ${resultText}`);
  }

  const submissionId = match[1];
  const submissionUrl = `${config.submissionsurl}/${submissionId}`;

  let finalStatus: SubmissionStatus;
  while (true) {
    finalStatus = await getSubmissionStatus(submissionUrl, cookies);
    onStatus?.(finalStatus);

    if (finalStatus.done) {
      break;
    }
    await Bun.sleep(250);
  }

  return { success: finalStatus.accepted, finalStatus };
}
