import { useState } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { ProblemList, ProblemView } from "./components";
import type { Problem } from "./lib";

function App() {
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);

  if (currentProblem) {
    return (
      <ProblemView
        problem={currentProblem}
        onBack={() => setCurrentProblem(null)}
        onProblemUpdated={setCurrentProblem}
      />
    );
  }

  return <ProblemList onSelectProblem={setCurrentProblem} />;
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
});
createRoot(renderer).render(<App />);
