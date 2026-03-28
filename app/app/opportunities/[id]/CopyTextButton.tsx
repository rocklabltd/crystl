"use client";

import { useState } from "react";

export default function CopyTextButton({ text, label = "Copy text" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Copy text failed:", error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
