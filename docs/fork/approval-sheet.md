# Approval sheet

Pending tool approvals show in a keyboard-driven sheet above the composer, shaped like the queued-message card (same inset, open bottom, flush on the composer) but dashed. Above a queue card it steps in one more notch, so the two read as a pile. The sheet takes focus when a request appears and again when clicked. (PRs #7, #22, #26)

## Fork files
- `src/features/sessions/ui/ApprovalSheet.tsx`
- `src/features/sessions/model/approvalSheetKeys.ts` — key bindings
- `src/features/sessions/model/approvalSheetLedge.ts` — finds the sheet so the working runner walks on it

## Upstream hooks
- `src/features/sessions/ui/SessionPane.tsx` — `<ApprovalSheet>` rendered in `LocalSessionPane` unless `session.worktreeRemoved`
- `src/features/sessions/ui/ComposerRunner.tsx` — `approvalSheetLedge(box)` comes first in the runner's ledge lookup

## Verify
- `src/features/sessions/model/approvalSheetKeys.test.ts`
- Manual: trigger a tool permission request; the sheet appears focused and the keys approve or deny it.
