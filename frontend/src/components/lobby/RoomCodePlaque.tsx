"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { CheckIcon, CopyIcon, LinkIcon } from "../icons";
import { useNotify } from "../ui/Notifications";
import { Panel } from "../ui/Panel";
import { Tooltip } from "../ui/Tooltip";

export function RoomCodePlaque({ code }: { code: string }) {
  const { notify } = useNotify();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const copy = async (kind: "code" | "link") => {
    const text = kind === "code" ? code : `${window.location.origin}/crew/join?code=${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
      notify({
        tone: "success",
        title: kind === "code" ? "Code copied" : "Invitation copied",
        message: kind === "code" ? "Share the runes with your crew." : "Send the link — it opens straight to boarding.",
        duration: 2600,
      });
    } catch {
      notify({ tone: "warning", title: "Copy failed", message: `Tell your crew the code by hand: ${code}` });
    }
  };

  return (
    <Panel padded={false}>
      <div className="px-5 pb-5 pt-4 sm:px-6 short:pb-4 short:pt-3">
        <p className="font-ui text-[0.62rem] uppercase tracking-[0.35em] text-brass/80">Ship&apos;s code</p>
        <div className="brass-surface relative mt-3 rounded-[4px] px-4 py-3 text-center short:mt-2 short:py-2">
          <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-brass-dark/80" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brass-dark/80" />
          <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-brass-dark/80" />
          <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-brass-dark/80" />
          <div className="flex justify-center gap-1.5" aria-label={`Room code ${code.split("").join(" ")}`}>
            {code.split("").map((char, i) => (
              <motion.span
                key={`${char}-${i}`}
                initial={{ opacity: 0, y: -12, rotateX: 90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: 0.3 + i * 0.08, type: "spring", stiffness: 260, damping: 18 }}
                className="font-display text-5xl leading-none text-ink [text-shadow:0_1px_0_rgba(255,240,200,0.6)] short:text-4xl"
              >
                {char}
              </motion.span>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 short:mt-3">
          <Tooltip content="Copy the six runes" className="w-full">
            <button
              type="button"
              onClick={() => copy("code")}
              className="flex w-full items-center justify-center gap-2 rounded border border-brass/40 bg-abyss/40 py-2 font-ui text-[0.62rem] font-bold uppercase tracking-[0.2em] text-brass-light transition hover:border-brass-light hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
            >
              {copied === "code" ? <CheckIcon size={14} /> : <CopyIcon size={14} />} Code
            </button>
          </Tooltip>
          <Tooltip content="Copy a boarding link" className="w-full">
            <button
              type="button"
              onClick={() => copy("link")}
              className="flex w-full items-center justify-center gap-2 rounded border border-brass/40 bg-abyss/40 py-2 font-ui text-[0.62rem] font-bold uppercase tracking-[0.2em] text-brass-light transition hover:border-brass-light hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
            >
              {copied === "link" ? <CheckIcon size={14} /> : <LinkIcon size={14} />} Invite
            </button>
          </Tooltip>
        </div>
      </div>
    </Panel>
  );
}
