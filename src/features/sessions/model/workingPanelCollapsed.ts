import { useState } from "react";
import { readFlag, writeFlag } from "../../settings/model/storageFlags";

const COLLAPSED_KEY = "monocode.workingPanelCollapsed";

export function useWorkingPanelCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(
    () => readFlag(COLLAPSED_KEY) ?? false,
  );
  return [
    collapsed,
    () => {
      writeFlag(COLLAPSED_KEY, !collapsed);
      setCollapsed(!collapsed);
    },
  ];
}
