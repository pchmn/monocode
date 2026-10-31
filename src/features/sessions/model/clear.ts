import type { BuiltinSkill } from "../../skills/model/skills";

export const CLEAR_COMMAND: BuiltinSkill = {
  kind: "builtin",
  name: "clear",
  invocation: "clear",
  description: "Start a fresh session here, replacing this one.",
  scope: "builtin",
  source: "monocode",
};

export function isClearCommand(text: string): boolean {
  return /^\s*\/clear\s*$/i.test(text);
}
