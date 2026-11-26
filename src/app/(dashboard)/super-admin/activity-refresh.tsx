"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ActivityRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return <p className="text-xs text-muted-foreground">Updates every 30 seconds while open.</p>;
}
