import { join, dirname } from "path";

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

async function compileCpp(
  solutionFile: string,
  binPath: string
): Promise<{ success: boolean; error?: string }> {
  const dir = dirname(solutionFile);
  const objPath = binPath + ".o";
  
  // Compile to object file (ccache-able) with LOCAL_DEBUG flag and cpp-dump include
  // Find the project root by going up from this file's location
  const projectRoot = join(import.meta.dir, "../..");
  const cppDumpInclude = join(projectRoot, "cpp-dump-lib");
  const compile = Bun.spawn([
    "g++", "-O2", "-std=c++23", "-pipe", 
    "-DLOCAL_DEBUG",  // Define LOCAL_DEBUG for debug output
    `-I${cppDumpInclude}`,  // Include cpp-dump library
    "-c", "-o", objPath, solutionFile
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const compileErr = await new Response(compile.stderr).text();
  await compile.exited;

  if (compile.exitCode !== 0) {
    return { success: false, error: compileErr };
  }
  
  // Link the object file
  const link = Bun.spawn(["g++", objPath, "-o", binPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const linkErr = await new Response(link.stderr).text();
  await link.exited;
  
  if (link.exitCode !== 0) {
    return { success: false, error: linkErr };
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

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    await proc.exited;

    if (proc.exitCode !== 0) {
      error = stderr || `Exit code: ${proc.exitCode}`;
    }
    actual = stdout.trim();
    debug = stderr.trim();  // Capture debug output from stderr
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
    debug: debug || undefined,  // Include debug output
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

  try {
    const proc = Bun.spawn(["python3", solutionFile], {
      stdin: new Blob([input]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    await proc.exited;

    if (proc.exitCode !== 0) {
      error = stderr || `Exit code: ${proc.exitCode}`;
    }
    actual = stdout.trim();
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
  return results[0];
}
