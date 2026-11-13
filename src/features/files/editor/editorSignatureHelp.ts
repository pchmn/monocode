import { completionStatus } from "@codemirror/autocomplete";
import {
  Prec,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  showTooltip,
  ViewPlugin,
  type Command,
  type ViewUpdate,
} from "@codemirror/view";
import type * as lsp from "vscode-languageserver-protocol";
import { languageForPath } from "./editorLanguage";
import { renderHover } from "./editorHover";
import { lspRequest } from "./lsp/languageServer";
import { highlightSource } from "./syntaxTokens";

const FOLLOW_DELAY_MS = 150;
const FUNCTION_LABEL = /^[\w$]+\s*[(<]/;
const LABEL_PREFIX = "function ";
const TRIGGERS = ["(", ",", "<"];
const RETRIGGERS = [...TRIGGERS, ")"];

type Shown = {
  help: lsp.SignatureHelp;
  active: number;
  pos: number;
  dom: HTMLElement;
};

const showSignature = StateEffect.define<Shown | null>();

const signatureField = StateField.define<Shown | null>({
  create: () => null,
  update(shown, tr) {
    for (const effect of tr.effects) {
      if (effect.is(showSignature)) return effect.value;
    }
    return shown && tr.docChanged
      ? { ...shown, pos: tr.changes.mapPos(shown.pos) }
      : shown;
  },
  provide: (field) =>
    showTooltip.from(field, (shown) =>
      shown
        ? {
            pos: shown.pos,
            above: true,
            create: () => ({ dom: shown.dom }),
          }
        : null,
    ),
});

type Request = lsp.SignatureHelpContext;

class SignaturePlugin {
  private generation = 0;
  private timer: number | undefined;

  constructor(private readonly view: EditorView) {}

  update(update: ViewUpdate) {
    const shown = update.state.field(signatureField);
    const trigger = typedTrigger(update, shown ? RETRIGGERS : TRIGGERS);
    if (trigger) {
      this.request({
        triggerKind: 2,
        triggerCharacter: trigger,
        isRetrigger: Boolean(shown),
        activeSignatureHelp: shown?.help,
      });
    } else if (shown && (update.docChanged || update.selectionSet)) {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(
        () =>
          this.request({
            triggerKind: 3,
            isRetrigger: true,
            activeSignatureHelp: shown.help,
          }),
        FOLLOW_DELAY_MS,
      );
    }
  }

  request(context: Request) {
    window.clearTimeout(this.timer);
    const generation = ++this.generation;
    const { view } = this;
    const pos = view.state.selection.main.head;
    void lspRequest<lsp.SignatureHelp | null>(
      view,
      "textDocument/signatureHelp",
      (plugin) => ({
        textDocument: { uri: plugin.uri },
        position: plugin.toPosition(view.state.selection.main.head),
        context,
      }),
      { background: context.triggerKind !== 1 },
    )
      .then(async (response) => {
        const help = response?.result;
        if (!help?.signatures.length) return null;
        const current = view.state.field(signatureField, false);
        const sameSignatures =
          current &&
          current.help.signatures.length === help.signatures.length &&
          current.help.signatures.every(
            (signature, index) =>
              signature.label === help.signatures[index]?.label,
          );
        const active =
          sameSignatures && context.triggerKind === 3
            ? current.active
            : Math.min(help.activeSignature ?? 0, help.signatures.length - 1);
        return {
          help,
          active,
          pos: sameSignatures ? current.pos : pos,
          dom: await renderSignature(help, active),
        };
      })
      .catch(() => null)
      .then((shown) => {
        if (generation !== this.generation) return;
        if (!shown && !view.state.field(signatureField, false)) return;
        view.dispatch({ effects: showSignature.of(shown) });
      });
  }

  destroy() {
    window.clearTimeout(this.timer);
    this.generation += 1;
  }
}

// Typing `(` inserts `()` when brackets auto-close.
function typedTrigger(update: ViewUpdate, triggers: string[]): string | null {
  if (!update.transactions.some((tr) => tr.isUserEvent("input.type"))) {
    return null;
  }
  let inserted = "";
  update.changes.iterChanges((_fromA, _toA, _fromB, _toB, text) => {
    inserted += text.toString();
  });
  return triggers.find((trigger) => inserted.includes(trigger)) ?? null;
}

const signaturePlugin = ViewPlugin.fromClass(SignaturePlugin);

/** Where the active parameter sits in the signature label. */
export function activeParameterRange(
  signature: lsp.SignatureInformation,
  activeParameter: number | null | undefined,
): [number, number] | null {
  const index = signature.activeParameter ?? activeParameter;
  const parameter = index == null ? undefined : signature.parameters?.[index];
  if (!parameter) return null;
  if (Array.isArray(parameter.label)) return parameter.label;
  // Parameters follow the opening parenthesis, never the name before it.
  let from = signature.label.indexOf("(") + 1;
  if (index != null) {
    for (const previous of signature.parameters?.slice(0, index) ?? []) {
      if (typeof previous.label !== "string") continue;
      const at = signature.label.indexOf(previous.label, from);
      if (at >= 0) from = at + previous.label.length;
    }
  }
  const at = signature.label.indexOf(parameter.label, from);
  return at < 0 ? null : [at, at + parameter.label.length];
}

async function renderSignature(help: lsp.SignatureHelp, active: number) {
  const signature = help.signatures[active]!;
  const range = activeParameterRange(signature, help.activeParameter);
  const parameter =
    range &&
    signature.parameters?.find((candidate) =>
      Array.isArray(candidate.label)
        ? candidate.label[0] === range[0]
        : signature.label.slice(range[0], range[1]) === candidate.label,
    );
  const docs = [parameter?.documentation, signature.documentation]
    .map((doc) => (typeof doc === "string" ? doc : doc?.value)?.trim())
    .filter(Boolean)
    .join("\n\n");
  const dom = docs ? await renderHover(docs) : document.createElement("div");
  dom.className = "cm-lsp-hover cm-lsp-signature";
  const code = await renderLabel(signature.label, range);
  if (help.signatures.length > 1) {
    const counter = document.createElement("span");
    counter.className = "cm-lsp-signature-counter";
    counter.textContent = `${active + 1}/${help.signatures.length}`;
    code.prepend(counter);
  }
  dom.prepend(code);
  return dom;
}

async function renderLabel(label: string, range: [number, number] | null) {
  const prefixed = FUNCTION_LABEL.test(label);
  const source = prefixed ? LABEL_PREFIX + label : label;
  const skip = prefixed ? LABEL_PREFIX.length : 0;
  const tokens = highlightSource(
    source,
    await languageForPath("signature.ts"),
  ).flatMap((line, index) => (index > 0 ? [{ text: "\n" }, ...line] : line));
  const pre = document.createElement("pre");
  pre.className = "cm-lsp-hover-code";
  let offset = -skip;
  for (const token of tokens) {
    const start = offset;
    offset += token.text.length;
    const visible = token.text.slice(Math.max(0, -start));
    if (!visible) continue;
    const from = Math.max(0, start);
    const cuts = range
      ? [range[0], range[1]].filter((cut) => cut > from && cut < offset)
      : [];
    let at = from;
    for (const end of [...cuts, offset]) {
      const span = document.createElement(
        range && at >= range[0] && end <= range[1] ? "strong" : "span",
      );
      span.textContent = label.slice(at, end);
      if ("color" in token && token.color) span.style.color = token.color;
      pre.append(span);
      at = end;
    }
  }
  return pre;
}

function cycle(by: number): Command {
  return (view) => {
    const shown = view.state.field(signatureField, false);
    if (!shown || shown.help.signatures.length < 2) return false;
    if (completionStatus(view.state) === "active") return false;
    const count = shown.help.signatures.length;
    const active = (shown.active + by + count) % count;
    void renderSignature(shown.help, active).then((dom) =>
      view.dispatch({ effects: showSignature.of({ ...shown, active, dom }) }),
    );
    return true;
  };
}

export const triggerParameterHints: Command = (view) => {
  const plugin = view.plugin(signaturePlugin);
  if (!plugin) return false;
  const shown = view.state.field(signatureField, false);
  plugin.request({
    triggerKind: 1,
    isRetrigger: Boolean(shown),
    activeSignatureHelp: shown?.help,
  });
  return true;
};

export const editorSignatureHelp: Extension = [
  signatureField,
  signaturePlugin,
  Prec.high(
    keymap.of([
      { key: "ArrowUp", run: cycle(-1) },
      { key: "ArrowDown", run: cycle(1) },
      {
        key: "Escape",
        run: (view) => {
          if (!view.state.field(signatureField, false)) return false;
          view.dispatch({ effects: showSignature.of(null) });
          return true;
        },
      },
    ]),
  ),
  EditorView.theme({
    ".cm-tooltip:has(.cm-lsp-signature)": {
      maxWidth: "min(720px, 90vw)",
      marginTop: "-4px",
    },
    ".cm-lsp-signature strong": {
      fontWeight: "700",
      textDecoration: "underline",
      textUnderlineOffset: "3px",
    },
    ".cm-lsp-signature-counter": {
      opacity: "0.6",
      marginRight: "8px",
    },
  }),
];
