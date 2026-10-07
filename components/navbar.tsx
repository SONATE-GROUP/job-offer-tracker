"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/cn";

interface NavbarProps {
  user: { name?: string | null; email?: string | null; role: string; workspaceName?: string | null };
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Offres & Leads" },
    { href: "/guide", label: "Guide" },
    ...(user.role === "ADMIN"
      ? [
          { href: "/settings", label: "Paramètres" },
          { href: "/admin/workspaces", label: "Workspaces" },
          { href: "/admin/users", label: "Utilisateurs" },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-sonate-green px-6 py-3 flex items-center justify-between">
      <nav className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-3 mr-4 shrink-0">
          <Image
            src="/brand/sonate-logo-beige.png"
            alt="Sonate, votre croissance est clé"
            width={140}
            height={42}
            priority
            className="h-auto w-[140px]"
          />
          <span className="border-l border-sonate-ivory/20 pl-3 text-sm font-semibold text-sonate-ivory">Job Offer Tracker</span>
        </Link>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-sm font-medium transition-colors",
              pathname === link.href
                ? "text-sonate-orange"
                : "text-sonate-ivory/70 hover:text-sonate-ivory"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        {user.workspaceName && <span className="text-sm text-sonate-ivory/50">{user.workspaceName}</span>}
        <span className="text-sm text-sonate-ivory/50">{user.name ?? user.email}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-sonate-ivory/50 hover:text-sonate-ivory transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
}
