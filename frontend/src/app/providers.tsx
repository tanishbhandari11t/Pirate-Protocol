"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { NotificationProvider } from "@/components/ui/Notifications";
import { CrewProvider } from "@/lib/crew/CrewProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <NotificationProvider>
        <CrewProvider>{children}</CrewProvider>
      </NotificationProvider>
    </MotionConfig>
  );
}
