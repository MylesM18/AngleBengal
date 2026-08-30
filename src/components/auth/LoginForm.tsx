"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import { loginErrorMessage } from "@/lib/auth/loginMessage";

const INPUT =
  "w-full rounded-input border border-ink-faint bg-paper-0 px-2.5 py-1.5 text-ui text-ink disabled:opacity-60 max-lg:py-3";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        // Full navigation, not a client transition: the new cookie should be
        // on the very next document request and nothing cached should linger.
        window.location.replace("/learn");
        return;
      }
      setError(loginErrorMessage(response.status));
    } catch {
      setError(loginErrorMessage(0));
    }
    setChecking(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-meta font-semibold text-ink-soft">Username</span>
        <input
          type="text"
          name="username"
          autoComplete="username"
          autoFocus
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={checking}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-meta font-semibold text-ink-soft">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={checking}
          className={INPUT}
        />
      </label>
      {error && (
        <p role="alert" className="text-meta font-semibold text-red">
          {error}
        </p>
      )}
      <Button type="submit" loading={checking} className="mt-1">
        {checking ? "Checking..." : "Sign in"}
      </Button>
    </form>
  );
}
