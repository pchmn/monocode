# Skill highlight in sent messages

A sent message that opens with a skill or command (`/triage …`) shows that token in the skill color, like the composer does while typing.

## Fork files
- `src/features/skills/model/leadingSkill.ts` — `splitLeadingSkill`
- `src/features/skills/ui/LeadingSkillText.tsx`

## Upstream hooks
- `src/features/sessions/ui/AgentTranscript.tsx` — `LeadingSkillText` around `messageLink.beforeText` in `UserMessageBlock`
- `src/features/sessions/ui/SentImageTokens.tsx` (fork file) — `LeadingSkillText` on the first text run

## Verify
- `src/features/skills/model/leadingSkill.test.ts`, `src/features/sessions/ui/SentImageTokens.test.ts`
- Manual: send `/triage <issue link> en français`; `/triage` stays yellow in the bubble.
