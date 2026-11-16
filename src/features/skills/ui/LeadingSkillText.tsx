import { splitLeadingSkill } from "../model/leadingSkill";

export function LeadingSkillText({ text }: { text: string }) {
  const split = splitLeadingSkill(text);
  if (!split) return <>{text}</>;
  return (
    <>
      {split.lead}
      <span className="text-skill">{split.skill}</span>
      {split.rest}
    </>
  );
}
