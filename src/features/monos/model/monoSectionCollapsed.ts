import { useState } from "react";
import { readFlag, writeFlag } from "../../settings/model/storageFlags";

const COLLAPSED_KEY = "monocode.monoSectionCollapsed";

export function useMonoSectionCollapsed(): [boolean, () => void] {
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
