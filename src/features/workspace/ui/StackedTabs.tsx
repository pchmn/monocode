import { HarnessIcon } from "../../sessions/ui/HarnessIcon";
import { TerminalSpinner } from "../../sessions/ui/TerminalSpinner";
import { BackgroundBadge } from "../../sessions/ui/BackgroundTasks";
import { isBackgroundOnly } from "../../sessions/model/backgroundTasks";
import {
  sessionDisplayTitle,
  type Session,
} from "../../sessions/model/session";
import { TabLabel } from "../../../shared/ui/TabLabel";
import { SurfaceTabs } from "./SurfaceTabs";
import { stackedSurface, type StackedPair } from "../model/stackedLayout";
import type { EditorPane } from "../model/layout";

type Props = {
  stacked: StackedPair;
  pane: EditorPane;
  session: Session | undefined;
  focusedId: string;
  dirtyFileIds: Set<string>;
  fileErrorCounts: Map<string, number>;
  onFocus: (paneId: string) => void;
  onSelectFile: (paneId: string, fileId: string) => void;
  onCloseFile: (paneId: string, fileId: string) => void;
  onCloseOtherFiles: (paneId: string, fileId: string) => void;
  onPinFile?: (fileId: string) => void;
  onReorderFiles: (paneId: string, ids: string[]) => void;
};

export function StackedTabs({
  stacked,
  pane,
  session,
  focusedId,
  dirtyFileIds,
  fileErrorCounts,
  onFocus,
  onSelectFile,
  onCloseFile,
  onCloseOtherFiles,
  onPinFile,
  onReorderFiles,
}: Props) {
  const { sessionId } = stacked;
  const showingSession = stackedSurface(stacked, focusedId) === "session";
  return (
    <SurfaceTabs
      leading={
        <div className="relative flex h-full w-56 min-w-28 shrink items-center">
          <button
            type="button"
            role="tab"
            aria-selected={showingSession}
            onClick={() => onFocus(sessionId)}
            className={`flex h-7.5 min-w-0 flex-1 cursor-default items-center gap-1.5 self-center rounded-md px-2 text-left text-[13px] ${
              showingSession
                ? "bg-selection text-content"
                : "text-content/50 hover:bg-content/5 hover:text-content"
            }`}
          >
            {session && isBackgroundOnly(session) ? (
              <BackgroundBadge tasks={session.backgroundTasks}>
                <HarnessIcon
                  harness={session.harness}
                  className="size-3.5 shrink-0"
                />
              </BackgroundBadge>
            ) : session?.busy ? (
              <TerminalSpinner className="inline-block w-3.5 select-none text-center text-[11px] leading-none text-accent" />
            ) : session ? (
              <HarnessIcon
                harness={session.harness}
                className="size-3.5 shrink-0"
              />
            ) : null}
            <TabLabel className="flex-1">
              {session
                ? sessionDisplayTitle(session.title, session.harness)
                : "Session"}
            </TabLabel>
          </button>
        </div>
      }
      files={pane.files}
      activeFileId={showingSession ? "" : pane.activeFileId}
      dirtyFileIds={dirtyFileIds}
      fileErrorCounts={fileErrorCounts}
      onSelectFile={(fileId) => {
        onSelectFile(pane.id, fileId);
        onFocus(pane.id);
      }}
      onCloseFile={(fileId) => onCloseFile(pane.id, fileId)}
      onCloseOtherFiles={(fileId) => onCloseOtherFiles(pane.id, fileId)}
      onPinFile={onPinFile}
      onReorder={(ids) => onReorderFiles(pane.id, ids)}
    />
  );
}
