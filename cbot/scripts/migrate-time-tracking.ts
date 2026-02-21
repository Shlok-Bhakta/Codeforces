#!/usr/bin/env bun
/**
 * Migration script to add timeSpentMs and solved fields to existing problems
 */

import { loadProblems, saveProblems } from "../src/lib/problems";

async function migrate() {
  console.log("🔄 Starting migration...");
  
  const problems = await loadProblems();
  console.log(`📊 Found ${problems.length} problems`);
  
  let migratedTime = 0;
  let migratedSolved = 0;
  
  for (const problem of problems) {
    if (problem.timeSpentMs === undefined) {
      problem.timeSpentMs = 0;
      migratedTime++;
    }
    if (problem.solved === undefined) {
      problem.solved = false;
      migratedSolved++;
    }
  }
  
  if (migratedTime > 0 || migratedSolved > 0) {
    await saveProblems(problems);
    if (migratedTime > 0) {
      console.log(`✅ Added time tracking to ${migratedTime} problems`);
    }
    if (migratedSolved > 0) {
      console.log(`✅ Added solved status to ${migratedSolved} problems`);
    }
  } else {
    console.log("✅ All problems already have time tracking and solved status");
  }
  
  console.log("🎉 Migration complete!");
}

migrate().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
