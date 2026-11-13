import { useEffect, useRef } from "react";
import type { OpenFileFn } from "../../search/model/search";
import {
  OPEN_DEFINITION_EVENT,
  type OpenDefinitionDetail,
} from "../editor/editorGoToDefinition";

export function useOpenDefinitionEvents(onOpenFile: OpenFileFn) {
  const onOpenFileRef = useRef(onOpenFile);
  onOpenFileRef.current = onOpenFile;

  useEffect(() => {
    const onOpen = (event: Event) => {
      const { path, line, column } = (
        event as CustomEvent<OpenDefinitionDetail>
      ).detail;
      onOpenFileRef.current(path, { line, column }, { exact: true });
    };
    window.addEventListener(OPEN_DEFINITION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DEFINITION_EVENT, onOpen);
  }, []);
}
