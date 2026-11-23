"use client";

import { LocalizedPageState } from "@/components/localized-page-state";

export default function LocaleError({ retry }: { error: unknown; retry: () => void }) {
  return <LocalizedPageState retry={retry} />;
}
