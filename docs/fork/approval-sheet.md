# Approval sheet

Pending tool approvals show in a keyboard-driven sheet above the composer. The sheet takes focus when a request appears and again when clicked. (PRs #7, #22, #26)

## Fork files
- `src/features/sessions/ui/ApprovalSheet.tsx`
- `src/features/sessions/model/approvalSheetKeys.ts` — key bindings

## Upstream hooks
- `src/features/sessions/ui/SessionPane.tsx` — `<ApprovalSheet>` rendered in `LocalSessionPane` unless `session.worktreeRemoved`

## Verify
- `src/features/sessions/model/approvalSheetKeys.test.ts`
- Manual: trigger a tool permission request; the sheet appears focused and the keys approve or deny it.
