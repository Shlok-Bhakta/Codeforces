#!/usr/bin/env bun
/**
 * Script to mark all problems as solved
 */

import { loadProblems, saveProblems } from "../src/lib/problems";

async function markAllSolved() {
  console.log("🔄 Marking all problems as solved...");
  
  const problems = await loadProblems();
  console.log(`📊 Found ${problems.length} problems`);
  
  for (const problem of problems) {
    problem.solved = true;
    problem.solvedAt = problem.solvedAt || Date.now();
  }
  
  await saveProblems(problems);
  console.log(`✅ Marked all ${problems.length} problems as solved!`);
  console.log("🌈 You can now manually set unsolved ones to false in problems.json");
}

markAllSolved().catch((error) => {
  console.error("❌ Failed:", error);
  process.exit(1);
});
