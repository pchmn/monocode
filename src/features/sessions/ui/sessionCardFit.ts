// The card widens to keep the PR line whole; the other lines wrap without widening it.
export const SESSION_CARD_FIT =
  "min-w-[260px] max-w-[480px] [&>p]:[container-type:inline-size] [&_dd]:[container-type:inline-size] [&_dd:has([data-one-line])]:[container-type:normal]";
