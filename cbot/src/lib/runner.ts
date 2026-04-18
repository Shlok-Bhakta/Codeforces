import { join, dirname } from "path";
import { stat } from "fs/promises";

export interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  input: string;
  error?: string;
  time: number;
  debug?: string;  // Add debug output field
}

const FAST_COMPILER = "clang++";
const FAST_PCH_FILE = "cbot-prelude.debug.pch";
const EXEC_TIMEOUT_MS = 10_000;
const STDERR_TAIL_LINES = 100;

function formatTleStderr(text: string, maxLines: number): string {
  const lines = text.split(/\r?\n/);
  const end = lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  const cleanLines = lines.slice(0, end);

  if (cleanLines.length <= maxLines) {
    return cleanLines.join("\n");
  }

  return ["..", ...cleanLines.slice(cleanLines.length - maxLines)].join("\n");
}

async function compileCpp(
  solutionFile: string,
  binPath: string
): Promise<{ success: boolean; error?: string }> {
  const projectRoot = join(import.meta.dir, "../..");
  const cppDumpInclude = join(projectRoot, "cpp-dump-lib");
  const cacheDir = join(projectRoot, ".cbot-cache");
  const pchPath = join(cacheDir, FAST_PCH_FILE);
  const gccLibDir = process.env.CBOT_GCC_LIB_DIR?.trim();

  if (!gccLibDir) {
    return {
      success: false,
      error:
        "C++ builds require CBOT_GCC_LIB_DIR (directory containing libstdc++.so for the linker rpath).",
    };
  }

  try {
    await stat(pchPath);
  } catch {
    return {
      success: false,
      error:
        `Missing ${pchPath}. Generate it once with: ` +
        `clang++ -std=c++23 -DLOCAL_DEBUG -I${cppDumpInclude} -x c++-header ${join(cacheDir, "cbot-prelude.hpp")} -o ${pchPath}`,
    };
  }

  const compileAndLink = Bun.spawn(
    [
      FAST_COMPILER,
      "-std=c++23",
      "-DLOCAL_DEBUG",
      "-pipe",
      `-I${cppDumpInclude}`,
      "-fuse-ld=mold",
      `-Wl,-rpath,${gccLibDir}`,
      "-include-pch",
      pchPath,
      solutionFile,
      "-o",
      binPath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const buildErr = await new Response(compileAndLink.stderr).text();
  await compileAndLink.exited;

  if (compileAndLink.exitCode !== 0) {
    return { success: false, error: buildErr };
  }

  return { success: true };
}

async function runSingleTest(
  binPath: string,
  inFile: string,
  ansFile: string,
  name: string
): Promise<TestResult> {
  const startTime = performance.now();
  const input = await Bun.file(inFile).text();
  const expected = (await Bun.file(ansFile).text()).trim();

  let actual = "";
  let error: string | undefined;
  let debug = "";

  try {
    const proc = Bun.spawn([binPath], {
      stdin: new Blob([input]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdoutPromise = new Response(proc.stdout).text();
    const stderrPromise = new Response(proc.stderr).text();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, EXEC_TIMEOUT_MS);

    await proc.exited;
    clearTimeout(timeoutId);

    const [stdout, stderr] = await Promise.all([
      stdoutPromise.catch(() => ""),
      stderrPromise.catch(() => ""),
    ]);

    const fullStderr = stderr.trim();
    const tleStderr = formatTleStderr(stderr, STDERR_TAIL_LINES).trim();

    if (timedOut) {
      error = tleStderr
        ? `TLE (${EXEC_TIMEOUT_MS / 1000}s limit)\n${tleStderr}`
        : `TLE (${EXEC_TIMEOUT_MS / 1000}s limit)`;
    } else if (proc.exitCode !== 0) {
      error = fullStderr || `Exit code: ${proc.exitCode}`;
    }
    actual = stdout.trim();
    debug = timedOut ? tleStderr : fullStderr;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const passed = !error && actual === expected;
  return {
    name,
    passed,
    expected,
    actual,
    input,
    error,
    time: performance.now() - startTime,
    debug: debug || undefined,
  };
}

async function runPythonTest(
  solutionFile: string,
  inFile: string,
  ansFile: string,
  name: string
): Promise<TestResult> {
  const startTime = performance.now();
  const input = await Bun.file(inFile).text();
  const expected = (await Bun.file(ansFile).text()).trim();

  let actual = "";
  let error: string | undefined;
  let debug = "";

  try {
    const proc = Bun.spawn(["python3", solutionFile], {
      stdin: new Blob([input]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdoutPromise = new Response(proc.stdout).text();
    const stderrPromise = new Response(proc.stderr).text();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, EXEC_TIMEOUT_MS);

    await proc.exited;
    clearTimeout(timeoutId);

    const [stdout, stderr] = await Promise.all([
      stdoutPromise.catch(() => ""),
      stderrPromise.catch(() => ""),
    ]);

    const fullStderr = stderr.trim();
    const tleStderr = formatTleStderr(stderr, STDERR_TAIL_LINES).trim();

    if (timedOut) {
      error = tleStderr
        ? `TLE (${EXEC_TIMEOUT_MS / 1000}s limit)\n${tleStderr}`
        : `TLE (${EXEC_TIMEOUT_MS / 1000}s limit)`;
    } else if (proc.exitCode !== 0) {
      error = fullStderr || `Exit code: ${proc.exitCode}`;
    }
    actual = stdout.trim();
    debug = timedOut ? tleStderr : fullStderr;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const passed = !error && actual === expected;
  return {
    name,
    passed,
    expected,
    actual,
    input,
    error,
    time: performance.now() - startTime,
    debug: debug || undefined,
  };
}

export async function runAllTests(
  solutionFile: string,
  samples: { name: string; inFile: string; ansFile: string }[]
): Promise<TestResult[]> {
  const ext = solutionFile.endsWith(".py") ? "python" : "cpp";
  const results: TestResult[] = [];

  if (ext === "cpp") {
    // Compile ONCE before running all tests
    const dir = dirname(solutionFile);
    const binPath = join(dir, "solution");

    const compileResult = await compileCpp(solutionFile, binPath);
    if (!compileResult.success) {
      // Return compile error for all tests
      for (const sample of samples) {
        const input = await Bun.file(sample.inFile).text();
        const expected = (await Bun.file(sample.ansFile).text()).trim();
        results.push({
          name: sample.name,
          passed: false,
          expected,
          actual: "",
          input,
          error: `Compile error:\n${compileResult.error}`,
          time: 0,
        });
      }
      return results;
    }

    // Run all tests with the compiled binary
    for (const sample of samples) {
      const result = await runSingleTest(
        binPath,
        sample.inFile,
        sample.ansFile,
        sample.name
      );
      results.push(result);
    }
  } else {
    // Python - no compilation needed
    for (const sample of samples) {
      const result = await runPythonTest(
        solutionFile,
        sample.inFile,
        sample.ansFile,
        sample.name
      );
      results.push(result);
    }
  }

  return results;
}

// Keep runTest for backwards compatibility / single test use
export async function runTest(
  solutionFile: string,
  inFile: string,
  ansFile: string,
  name: string
): Promise<TestResult> {
  const results = await runAllTests(solutionFile, [
    { name, inFile, ansFile },
  ]);
  const result = results[0];
  if (!result) {
    throw new Error("No test result was produced");
  }
  return result;
}
