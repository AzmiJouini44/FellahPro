"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppNavLinkProps = {
  children: React.ReactNode;
  className?: string;
  href: string;
  match?: "exact" | "prefix" | "none";
};

export function AppNavLink({
  children,
  className = "",
  href,
  match = "exact",
}: AppNavLinkProps) {
  const pathname = usePathname();
  const targetPath = href.split("#")[0];
  const isActive =
    match === "exact"
      ? pathname === targetPath
      : match === "prefix"
        ? pathname === targetPath || pathname.startsWith(`${targetPath}/`)
        : false;

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`${className}${isActive ? " is-active" : ""}`.trim()}
      href={href}
    >
      {children}
    </Link>
  );
}
