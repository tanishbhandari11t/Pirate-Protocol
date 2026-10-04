"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "../icons";
import { TopBar } from "../layout/TopBar";

interface CrewFormShellProps {
  form: ReactNode;
  preview: ReactNode;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** Two-column layout: the parchment form on the left, the living preview on the right. */
export function CrewFormShell({ form, preview }: CrewFormShellProps) {
  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar />
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-10 pt-2 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 short:pb-6">
        <div className="mx-auto w-full max-w-xl lg:max-w-none">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 font-ui text-[0.65rem] uppercase tracking-[0.3em] text-brass/70 transition hover:text-brass-light short:mb-2"
          >
            <ArrowLeftIcon size={14} /> Back to the harbour
          </Link>
          <motion.div
            initial={{ opacity: 0, clipPath: "inset(-5% -5% 100% -5%)", y: -10 }}
            animate={{ opacity: 1, clipPath: "inset(-5% -5% -5% -5%)", y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.15 }}
          >
            {form}
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.45 }}
          className="order-first lg:order-none"
        >
          {preview}
        </motion.div>
      </div>
    </main>
  );
}
