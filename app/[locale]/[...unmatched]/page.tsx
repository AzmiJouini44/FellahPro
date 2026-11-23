import { notFound } from "next/navigation";

// Keep unknown localized URLs inside the locale layout and its translated 404.
export const instant = false;

export default function UnknownPage() {
  notFound();
}
