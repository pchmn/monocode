import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  CODE_FONT_LIMITS,
  CODE_FONTS_DEFAULT,
  saveCodeFonts,
  useCodeFonts,
  type CodeFontNumberKey,
} from "../model/codeFonts";

type RowProps = {
  label: ReactNode;
  description?: string;
  children?: ReactNode;
};

const NUMBER_ROWS: {
  key: CodeFontNumberKey;
  label: string;
  description: string;
}[] = [
  {
    key: "codeFontSize",
    label: "Code font size",
    description: "Text size in the file editor and the diff view, in pixels.",
  },
  {
    key: "codeLineHeight",
    label: "Code line height",
    description: "Row height in the file editor and the diff view, in pixels.",
  },
  {
    key: "explorerFontSize",
    label: "Explorer font size",
    description:
      "Text size of the file explorer and the Changes list, in pixels.",
  },
  {
    key: "explorerRowHeight",
    label: "Explorer row height",
    description:
      "Row height of the file explorer and the Changes list, in pixels.",
  },
];

const FIELD_CLASS =
  "flex h-7 shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20";
const INPUT_CLASS =
  "min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35";

export function CodeFontSettings({ Row }: { Row: ComponentType<RowProps> }) {
  const fonts = useCodeFonts();
  return (
    <>
      <Row
        label="Code font"
        description="Font family of the file editor and the diff view. Falls back to the system monospace font when it is not installed."
      >
        <DraftInput
          label="Code font"
          value={fonts.codeFontFamily}
          placeholder={CODE_FONTS_DEFAULT.codeFontFamily}
          className="w-52 max-w-full"
          onCommit={(codeFontFamily) => saveCodeFonts({ codeFontFamily })}
        />
      </Row>
      {NUMBER_ROWS.map(({ key, label, description }) => (
        <Row key={key} label={label} description={description}>
          <DraftInput
            label={label}
            type="number"
            min={CODE_FONT_LIMITS[key].min}
            max={CODE_FONT_LIMITS[key].max}
            value={String(fonts[key])}
            placeholder={String(CODE_FONTS_DEFAULT[key])}
            className="w-20"
            onCommit={(value) =>
              saveCodeFonts({ [key]: value === "" ? undefined : Number(value) })
            }
          />
        </Row>
      ))}
    </>
  );
}

// Commits on blur or Enter, so typing "1" on the way to "14" never applies.
function DraftInput({
  label,
  value,
  onCommit,
  className,
  ...input
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  className: string;
  type?: "number";
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() === value) return;
    onCommit(draft.trim());
    setDraft(value);
  };
  return (
    <label className={`${FIELD_CLASS} ${className}`}>
      <input
        {...input}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(value);
        }}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        className={INPUT_CLASS}
      />
    </label>
  );
}
