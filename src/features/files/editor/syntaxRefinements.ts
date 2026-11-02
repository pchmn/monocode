import { tags, type Tag } from "@lezer/highlight";

type Refinement = { tag: Tag[]; color: string; fontStyle?: string };

// Appended after the base groups, so they win for these tags. Each falls back
// to the colour the base group gave, so only themes setting the variable change.
export const SYNTAX_REFINEMENTS: readonly Refinement[] = [
  {
    tag: [tags.definitionKeyword, tags.modifier],
    color: "var(--syntax-storage, var(--syntax-keyword))",
  },
  {
    tag: [tags.moduleKeyword],
    color: "var(--syntax-module, var(--syntax-keyword))",
  },
  {
    tag: [tags.self, tags.bool, tags.null, tags.atom],
    color: "var(--syntax-constant, var(--syntax-keyword))",
  },
  {
    tag: [tags.operator, tags.function(tags.punctuation)],
    color: "var(--syntax-operator, currentColor)",
  },
  {
    tag: [tags.derefOperator, tags.punctuation],
    color: "var(--syntax-punctuation, currentColor)",
  },
  {
    tag: [
      tags.variableName,
      tags.paren,
      tags.squareBracket,
      tags.brace,
      tags.separator,
    ],
    color: "var(--syntax-plain, currentColor)",
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: "var(--syntax-comment)",
    fontStyle: "var(--syntax-comment-style, normal)",
  },
];
