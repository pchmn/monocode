// Same token shape as the composer's skill highlight, anchored to the message start.
const LEADING_SKILL =
  /^(\s*)(\/[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)?)(?=\s|$)/;

export function splitLeadingSkill(
  text: string,
): { lead: string; skill: string; rest: string } | null {
  const match = LEADING_SKILL.exec(text);
  if (!match) return null;
  const [whole, lead, skill] = match;
  return { lead, skill, rest: text.slice(whole.length) };
}
