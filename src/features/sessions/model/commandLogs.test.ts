import { expect, it } from "vitest";
import {
  backgroundTaskId,
  redirectedLogFile,
  taskOutputFile,
} from "./commandLogs";
import type { Block } from "./session";

const OUTPUT =
  "/private/tmp/claude-501/-Users-me-app/sess/tasks/bybzjk79e.output";

const bashCall: Block = {
  id: "toolu_bash",
  role: "tool",
  text: "npm test",
  tool: {
    callId: "toolu_bash",
    title: "npm test",
    kind: "execute",
    status: "completed",
    detail: `Command running in background with ID: bybzjk79e. Output is being written to: ${OUTPUT}. You will be notified when it completes.`,
  },
};

const backgroundRow: Block = {
  id: "background:bybzjk79e",
  role: "tool",
  text: "npm test",
  tool: {
    callId: "background:bybzjk79e",
    title: "npm test",
    kind: "execute",
    status: "completed",
    detail: 'Background command "npm test" completed (exit code 0)',
  },
};

it("finds the task of a background call and of its live row", () => {
  expect(backgroundTaskId(bashCall)).toBe("bybzjk79e");
  expect(backgroundTaskId(backgroundRow)).toBe("bybzjk79e");
  expect(
    backgroundTaskId({
      ...bashCall,
      tool: { ...bashCall.tool!, detail: "ok" },
    }),
  ).toBeUndefined();
});

it("reads the output file from the call that started the task", () => {
  expect(taskOutputFile([backgroundRow, bashCall], "bybzjk79e")).toBe(OUTPUT);
  expect(taskOutputFile([backgroundRow], "bybzjk79e")).toBeUndefined();
});

it("follows the command's own stdout redirect", () => {
  expect(
    redirectedLogFile(
      'cd /repo && EVALS_REPEAT=3 pnpm eval -t "a|b" > /tmp/eval.log 2>&1; echo "exit $?" >> /tmp/eval.log',
    ),
  ).toBe("/tmp/eval.log");
  expect(redirectedLogFile("cd /repo && npm test > out.log 2>&1")).toBe(
    "/repo/out.log",
  );
  expect(redirectedLogFile("npm test &> 'build log.txt'", "/app")).toBe(
    "/app/build log.txt",
  );
  expect(redirectedLogFile("npm test 2> err.log", "/app")).toBeUndefined();
  expect(redirectedLogFile("npm test > /dev/null 2>&1")).toBeUndefined();
  expect(redirectedLogFile("npm test 2>&1 | tee x", "/app")).toBeUndefined();
});
