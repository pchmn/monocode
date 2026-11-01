import { useEffect, useState } from "react";
import { githubAccounts } from "../model/githubAccounts";

export function GithubAccountsList() {
  const [accounts, setAccounts] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void githubAccounts()
      .then((next) => {
        if (active) setAccounts(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (accounts.length === 0) return null;
  return (
    <p className="border-b border-content/5 px-4 pb-3 text-[12px] text-content/50 last:border-b-0">
      Signed-in accounts: {accounts.join(", ")}.
      {accounts.length > 1
        ? " Pick one per project from the project's menu → GitHub account."
        : null}
    </p>
  );
}
