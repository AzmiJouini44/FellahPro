import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function CropCycleMissing({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale).cropCycles.missing;
  return (
    <section className="plot-state-card">
      <span className="plot-state-icon" aria-hidden="true">?</span>
      <h1>{dictionary.title}</h1>
      <p>{dictionary.description}</p>
      <Link className="button button-primary" href={`/${locale}/app/crop-cycles`}>
        {dictionary.back}
      </Link>
    </section>
  );
}
