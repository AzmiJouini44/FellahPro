"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { TASK_REFRESH_MS } from "@/lib/task-validation";

// Calendar reminders refresh only on visible read screens. Nothing is delivered
// in the background, and edit forms do not mount this component.
export function TaskReminderRefresh() {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = Date.now();
    function refresh() {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 5000) return;
      lastRefresh = Date.now();
      startTransition(() => router.refresh());
    }
    const timer = window.setInterval(refresh, TASK_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
