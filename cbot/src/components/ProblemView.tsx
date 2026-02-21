import { useState, useEffect, useCallback, useRef } from "react";
import { useKeyboard } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import { KeybindHelp } from "./KeybindHelp";
import {
  getSampleFiles,
  getSolutionFile,
  runAllTests,
  openProblemInBrowser,
  refreshProblemMetadata,
  getProblemDir,
  createCustomTestCase,
  deleteTestCase,
  updateProblemTimeSpent,
  commitProblemDir,
  theme,
  type Problem,
  type TestResult,
} from "../lib";
import { join } from "path";

interface ProblemViewProps {
  problem: Problem;
  onBack: () => void;
  onProblemUpdated?: (problem: Problem) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

const FAILURE_MESSAGES = [
  "lol nice try buddy",
  "were you even trying?",
  "i've seen better code from a toaster",
  "did you test this locally?",
  "maybe read the problem statement again?",
  "skill issue detected",
  "better luck next time champ",
  "that's definitely not it chief",
  "yikes... just yikes",
  "have you considered switching to python?",
  "the algorithm called, it wants its logic back",
  "imagine failing this one lmao",
  "not even close",
  "back to the drawing board",
  "at least you tried... i guess",
  "oof size: MEGA",
  "computer says no",
  "wrong answer: skill issue edition",
  "try harder next time",
  "git gud",
];

const SUCCESS_MESSAGES = [
  "▓▓ ACCEPTED ▓▓ YOU'RE A GOD",
  "▓▓ ABSOLUTELY CRUSHING IT ▓▓",
  "▓▓ FLAWLESS VICTORY ▓▓",
  "▓▓ PERFECT EXECUTION ▓▓",
  "▓▓ ELITE TIER CODING ▓▓",
  "▓▓ LEGENDARY STATUS ▓▓",
  "▓▓ GIGABRAIN MOMENT ▓▓",
  "▓▓ BUILT DIFFERENT ▓▓",
  "▓▓ COMPETITIVE PROGRAMMING GOD ▓▓",
  "▓▓ ALGORITHM MASTERY ▓▓",
];

export function ProblemView({ problem, onBack, onProblemUpdated }: ProblemViewProps) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedTest, setSelectedTest] = useState(0);
  const [running, setRunning] = useState(false);
  const [showDeleteTestDialog, setShowDeleteTestDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentProblem, setCurrentProblem] = useState(problem);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [lastTestTime, setLastTestTime] = useState<number>(0);
  const [testRunCount, setTestRunCount] = useState<number>(0);
  const [creatingCustomTest, setCreatingCustomTest] = useState(false);
  const [idleFlash, setIdleFlash] = useState<boolean>(false);
  const [displayTick, setDisplayTick] = useState<number>(0); // Force re-render for live timer
  // Timer state with improved logic:
  // - accumulatedTime: total time from all previous active sessions
  // - sessionStartTime: when the current active session started
  // - lastSaveTime: last file modification time for idle detection
  // - isIdle: whether we're currently in idle state
  const [accumulatedTime, setAccumulatedTime] = useState<number>(0);
  const [sessionStartTime, setSessionStartTime] = useState<number>(performance.now());
  const [lastSaveTime, setLastSaveTime] = useState<number>(Date.now());
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const watcherRef = useRef<{ close: () => void } | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const isIdleRef = useRef<boolean>(false);
  const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

  useEffect(() => {
    setCurrentProblem(problem);
    setSessionStartTime(performance.now());
    setLastSaveTime(Date.now());
    setIsIdle(false);
    setAccumulatedTime(0);
    accumulatedTimeRef.current = 0;
    isIdleRef.current = false;
  }, [problem]);

  // Keep refs in sync with state
  useEffect(() => {
    accumulatedTimeRef.current = accumulatedTime;
  }, [accumulatedTime]);
  
  useEffect(() => {
    isIdleRef.current = isIdle;
  }, [isIdle]);

  // Timer effect to track elapsed time with idle detection
  // Logic:
  // - When active: display accumulatedTime + (now - sessionStartTime)
  // - When becoming idle: add current session to accumulatedTime, stop counting
  // - When resuming from idle: start new session from current accumulatedTime
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSave = now - lastSaveTime;
      const shouldBeIdle = timeSinceLastSave > IDLE_THRESHOLD_MS;
      
      // Force re-render for live timer display
      setDisplayTick(prev => prev + 1);
      
      if (shouldBeIdle !== isIdleRef.current) {
        setIsIdle(shouldBeIdle);
        if (shouldBeIdle) {
          // Transitioning to idle: freeze the timer by adding current session to accumulated
          const currentSessionTime = performance.now() - sessionStartTime;
          const newAccumulated = accumulatedTimeRef.current + currentSessionTime;
          setAccumulatedTime(newAccumulated);
        } else {
          // Transitioning to active: start a new session
          setSessionStartTime(performance.now());
        }
      }
    }, 100); // Update every 100ms for smooth display

    return () => {
      clearInterval(interval);
    };
  }, [problem.id, sessionStartTime, lastSaveTime]);

  // Flash red/white when idle for peripheral vision
  useEffect(() => {
    if (!isIdle) {
      setIdleFlash(false);
      return;
    }

    const flashInterval = setInterval(() => {
      setIdleFlash(prev => !prev);
    }, 500); // Flash every 500ms

    return () => clearInterval(flashInterval);
  }, [isIdle]);

  // Save time only on unmount or problem change
  useEffect(() => {
    return () => {
      // Calculate total time: accumulated + current session (if active)
      let totalTime = accumulatedTimeRef.current;
      if (!isIdleRef.current) {
        // Still active, add current session
        totalTime += (performance.now() - sessionStartTime);
      }
      if (totalTime > 0) {
        updateProblemTimeSpent(problem.id, totalTime).catch(() => {});
      }
    };
  }, [problem.id, sessionStartTime]);

  const runTests = useCallback(async () => {
    setRunning(true);
    setError(null);
    const startTime = Date.now();
    try {
      const solutionFile = await getSolutionFile(problem.id);
      if (!solutionFile) {
        setError("No solution file found");
        setRunning(false);
        return;
      }
      const samples = await getSampleFiles(problem.id);
      if (samples.length === 0) {
        setError("No sample files found");
        setRunning(false);
        return;
      }
      const testResults = await runAllTests(solutionFile, samples);
      setResults(testResults);
      setLastTestTime(Date.now() - startTime);
      setTestRunCount(c => c + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [problem.id]);

  useEffect(() => {
    runTests();

    (async () => {
      const problemDir = await getProblemDir(problem.id);
      const samplesDir = join(problemDir, "samples");
      const solutionFile = await getSolutionFile(problem.id);
      
      let lastMtimes = new Map<string, number>();

      const checkFiles = async () => {
        try {
          const glob = new Bun.Glob("*");
          let hasChanged = false;

          for await (const filename of glob.scan(samplesDir)) {
            const filepath = join(samplesDir, filename);
            try {
              const stat = await Bun.file(filepath).stat();
              const lastMtime = lastMtimes.get(filepath);
              if (lastMtime === undefined) {
                lastMtimes.set(filepath, stat.mtime.getTime());
              } else if (stat.mtime.getTime() > lastMtime) {
                lastMtimes.set(filepath, stat.mtime.getTime());
                hasChanged = true;
              }
            } catch {}
          }

          if (solutionFile) {
            try {
              const stat = await Bun.file(solutionFile).stat();
              const mtime = stat.mtime?.getTime() || Date.now();
              const lastMtime = lastMtimes.get(solutionFile);
              if (lastMtime === undefined) {
                lastMtimes.set(solutionFile, mtime);
                // Don't update lastSaveTime on initial load - use the grace period from when assignment opened
              } else if (mtime > lastMtime) {
                lastMtimes.set(solutionFile, mtime);
                setLastSaveTime(mtime);
                hasChanged = true;
              }
            } catch {}
          }

          if (hasChanged) {
            runTests();
          }
        } catch {}
      };

      await checkFiles();
      const interval = setInterval(checkFiles, 500);

      watcherRef.current = {
        close: () => clearInterval(interval),
      };
    })();

    return () => {
      watcherRef.current?.close();
    };
  }, [problem.id, runTests]);

  const handleRefreshMetadata = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const updated = await refreshProblemMetadata(problem.id);
      if (updated) {
        setCurrentProblem(updated);
        onProblemUpdated?.(updated);
        setError("✓ Metadata refreshed successfully");
        setTimeout(() => setError(null), 2000);
      } else {
        setError("Failed to refresh metadata");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [problem.id, onProblemUpdated]);

  const handleCreateCustomTest = useCallback(async () => {
    setCreatingCustomTest(true);
    setError(null);
    try {
      await createCustomTestCase(problem.id);
      setError("✓ Custom test case created");
      setTimeout(() => setError(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingCustomTest(false);
    }
  }, [problem.id]);

  const handleDeleteTest = useCallback(async () => {
    if (results.length === 0) return;
    const currentResult = results[selectedTest];
    if (!currentResult) return;
    
    try {
      await deleteTestCase(problem.id, currentResult.name);
      setShowDeleteTestDialog(false);
      setError("✓ Test case deleted");
      setTimeout(() => setError(null), 2000);
      // Re-run tests to refresh the list
      await new Promise(resolve => setTimeout(resolve, 100));
      // The file watcher will pick up the change and re-run tests automatically
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [problem.id, results, selectedTest]);

  useKeyboard((key) => {
    if (showDeleteTestDialog) {
      if (key.name === "escape" || key.name === "n") {
        setShowDeleteTestDialog(false);
      } else if (key.name === "y") {
        handleDeleteTest();
      }
      return;
    }

    if (key.name === "escape") {
      commitProblemDir(problem.id).catch(() => {});
      onBack();
    } else if (key.name === "r") {
      runTests();
    } else if (key.name === "s") {
      openProblemInBrowser(problem.id).catch(() => {});
    } else if (key.name === "m" && !refreshing) {
      handleRefreshMetadata();
    } else if (key.name === "n" && !creatingCustomTest) {
      handleCreateCustomTest();
    } else if (key.name === "x" && results.length > 0) {
      setShowDeleteTestDialog(true);
    } else if (key.name === "f") {
      setDescriptionExpanded((e) => !e);
    } else if (key.name === "left" && results.length > 0) {
      setSelectedTest((i) => Math.max(0, i - 1));
    } else if (key.name === "right" && results.length > 0) {
      setSelectedTest((i) => Math.min(results.length - 1, i + 1));
    } else if (key.name === "1" && results.length >= 1) setSelectedTest(0);
    else if (key.name === "2" && results.length >= 2) setSelectedTest(1);
    else if (key.name === "3" && results.length >= 3) setSelectedTest(2);
    else if (key.name === "4" && results.length >= 4) setSelectedTest(3);
    else if (key.name === "5" && results.length >= 5) setSelectedTest(4);
  });

  // Helper function to calculate current elapsed time
  // Returns accumulated time + current session time (if active)
  const getCurrentElapsedTime = (): number => {
    if (isIdle) {
      return accumulatedTime;
    }
    return accumulatedTime + (performance.now() - sessionStartTime);
  };

  const accentColor = theme.blue;
  const currentResult = results[selectedTest];
  const meta = currentProblem.metadata;
  const passedCount = results.filter(r => r.passed).length;
  const allPassed = results.length > 0 && passedCount === results.length;
  const compileError = results.find(r => r.error?.startsWith("Compile error:"))?.error;
  const avgTestTime = results.length > 0 ? results.reduce((sum, r) => sum + r.time, 0) / results.length : 0;
  const maxTestTime = results.length > 0 ? Math.max(...results.map(r => r.time)) : 0;
  
  // Calculate elapsed time once per render for consistency between timer and total
  const currentElapsedTime = getCurrentElapsedTime();
  const totalTime = (currentProblem.timeSpentMs || 0) + currentElapsedTime;

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
      <box flexDirection="row" gap={2} height={1}>
        <text fg={accentColor} attributes={TextAttributes.BOLD}>▓▓</text>
        <text fg={accentColor} attributes={TextAttributes.BOLD}>{meta?.title || currentProblem.id}</text>
        <text fg={theme.overlay1}>│</text>
        <text fg={theme.subtext0}>{meta?.cpuLimit || "?"}</text>
        <text fg={theme.subtext0}>{meta?.memoryLimit || "?"}</text>
        <text fg={theme.mauve} attributes={TextAttributes.BOLD}>[{meta?.difficulty || "?"}]</text>
        <text fg={theme.overlay1}>│</text>
        <text fg={isIdle ? (idleFlash ? theme.red : theme.text) : theme.teal} attributes={TextAttributes.BOLD}>
          ⏱ {formatTime(currentElapsedTime)}{isIdle ? " [PAUSED]" : ""}
        </text>
        <text fg={theme.subtext0}>(total: {formatTime(totalTime)})</text>
        {refreshing && <text bg={accentColor} fg={theme.crust} attributes={TextAttributes.BOLD}> REFRESHING </text>}
        {testRunCount > 0 && (
          <>
            <text fg={theme.overlay1}>│</text>
            <text fg={theme.subtext0}>runs: {testRunCount}</text>
          </>
        )}
      </box>

      <text fg={accentColor}>{"▀".repeat(78)}</text>

      <box height={descriptionExpanded ? "90%" : "50%"}>
        <scrollbox focused={true} flexGrow={1}>
          <text fg={theme.subtext1}>{meta?.description || "No description available."}</text>
        </scrollbox>
      </box>

      {!descriptionExpanded && (
        <>
          <text fg={accentColor}>{"▀".repeat(78)}</text>

          <box flexDirection="row" gap={2} height={1}>
            <text fg={theme.text} attributes={TextAttributes.BOLD}>TESTS</text>
            {running ? (
              <box flexDirection="row" gap={1}>
                <text fg={accentColor} attributes={TextAttributes.BOLD}>⟳</text>
                <text fg={accentColor}>RUNNING</text>
              </box>
            ) : error ? (
              <text fg={theme.red}>{error}</text>
            ) : results.length === 0 ? (
              <text fg={theme.overlay1}>none</text>
            ) : (
              <>
                {results.map((r, i) => (
                  <text
                    key={r.name}
                    bg={i === selectedTest ? (r.passed ? theme.green : theme.red) : undefined}
                    fg={i === selectedTest ? theme.crust : (r.passed ? theme.green : theme.red)}
                    attributes={i === selectedTest ? TextAttributes.BOLD : undefined}
                  >
                    {i === selectedTest ? ` ${r.passed ? "✓" : "✗"} ${r.name} ` : ` ${r.passed ? "✓" : "✗"} ${r.name} `}
                  </text>
                ))}
                <text fg={theme.overlay1}>│</text>
                <text fg={allPassed ? theme.green : theme.red} attributes={TextAttributes.BOLD}>
                  {passedCount}/{results.length}
                </text>
                {results.length > 0 && (
                  <>
                    <text fg={theme.overlay1}>│</text>
                    <text fg={theme.subtext0}>avg: {avgTestTime.toFixed(0)}ms</text>
                    <text fg={theme.subtext0}>max: {maxTestTime.toFixed(0)}ms</text>
                  </>
                )}
              </>
            )}
          </box>

          <box flexDirection="column" flexGrow={1} marginTop={1}>
            {compileError ? (
              <scrollbox flexGrow={1}>
                <box flexDirection="column">
                  <text bg={theme.red} fg={theme.text} attributes={TextAttributes.BOLD}> ▓▓ COMPILE ERROR ▓▓ </text>
                  <text fg={theme.red}>{compileError.replace("Compile error:\n", "")}</text>
                </box>
              </scrollbox>
            ) : currentResult ? (
              <scrollbox flexGrow={1}>
                <box flexDirection="column" gap={1}>
                  <box flexDirection="row" gap={2}>
                    <text bg={currentResult.passed ? theme.green : theme.red} fg={theme.crust} attributes={TextAttributes.BOLD}>
                      {currentResult.passed ? " ▓▓ PASS ▓▓ " : " ▓▓ FAIL ▓▓ "}
                    </text>
                    <text fg={theme.text} attributes={TextAttributes.BOLD}>{currentResult.name}</text>
                    <text fg={theme.subtext0}>{currentResult.time.toFixed(0)}ms</text>
                  </box>
                  <text fg={theme.overlay0}>INPUT:</text>
                  <text fg={theme.sky}>{currentResult.input.trim()}</text>
                  {!currentResult.passed && (
                    <box flexDirection="column" gap={1}>
                      {currentResult.error ? (
                        <box flexDirection="column" gap={1}>
                          <text fg={theme.red}>{currentResult.error}</text>
                          {currentResult.actual && (
                            <>
                              <text fg={theme.overlay0}>STDOUT:</text>
                              <text fg={theme.text}>{currentResult.actual}</text>
                            </>
                          )}
                        </box>
                      ) : (
                        <box flexDirection="column" gap={1}>
                          <text fg={theme.overlay0}>EXPECTED:</text>
                          <text fg={theme.green}>{currentResult.expected}</text>
                          <text fg={theme.overlay0}>GOT:</text>
                          <text fg={theme.red}>{currentResult.actual || "(empty)"}</text>
                        </box>
                      )}
                    </box>
                  )}
                  {currentResult.passed && (
                    <box flexDirection="column" gap={1}>
                      <text fg={theme.overlay0}>OUTPUT:</text>
                      <text fg={theme.green}>{currentResult.actual}</text>
                    </box>
                  )}
                  {currentResult.debug && (
                    <box flexDirection="column" gap={1}>
                      <text fg={theme.overlay0}>DEBUG (stderr):</text>
                      <text fg={theme.overlay2}>{currentResult.debug}</text>
                    </box>
                  )}
                </box>
              </scrollbox>
            ) : (
              <text fg={theme.overlay1}>select a test</text>
            )}
          </box>
        </>
      )}

      {showDeleteTestDialog && (
        <box
          position="absolute"
          top="30%"
          left="20%"
          width="60%"
          flexDirection="column"
          backgroundColor={theme.mantle}
          padding={2}
          alignItems="center"
        >
          <text fg={theme.red} attributes={TextAttributes.BOLD}>
            {"▓".repeat(50)}
          </text>
          
          <box flexDirection="column" alignItems="center" gap={1} padding={2}>
            <text fg={theme.red} attributes={TextAttributes.BOLD}>
              DELETE TEST "{results[selectedTest]?.name}"?
            </text>
            <text fg={theme.overlay0}>This will permanently remove the test files.</text>
            <text fg={theme.overlay0}>This action cannot be undone.</text>
            
            <box flexDirection="row" gap={2} marginTop={1}>
              <text bg={theme.red} fg={theme.crust} attributes={TextAttributes.BOLD}> Y </text>
              <text fg={theme.subtext0}>yes, delete</text>
              <text fg={theme.overlay1}>│</text>
              <text bg={theme.surface1} fg={theme.text} attributes={TextAttributes.BOLD}> N </text>
              <text fg={theme.subtext0}>cancel</text>
            </box>
          </box>
          
          <text fg={theme.red} attributes={TextAttributes.BOLD}>
            {"▓".repeat(50)}
          </text>
        </box>
      )}

      <KeybindHelp
        keybinds={[
          { key: "←/→", action: "switch test" },
          { key: "1-5", action: "jump test" },
          { key: "r", action: "run tests" },
          { key: "s", action: "open in browser" },
          { key: "n", action: "new test" },
          { key: "x", action: "delete test" },
          { key: "f", action: descriptionExpanded ? "collapse" : "expand" },
          { key: "m", action: "refresh meta" },
          { key: "esc", action: "back" },
        ]}
      />
    </box>
  );
}
