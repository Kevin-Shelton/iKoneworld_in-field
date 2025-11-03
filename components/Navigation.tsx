'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Home, Languages, User, LogOut, Settings } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/select-language", label: "Translate", icon: Languages },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-gray-800 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <Link href="/dashboard" className="flex items-center group">
            {/* iK OneWorld Logo */}
            <div className="relative h-8 w-32 transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/logo-ikoneworld.png"
                alt="iK OneWorld - Where the world speaks your language"
                fill
                className="object-contain object-left"
                priority
                sizes="128px"
              />
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-smooth ${
                    isActive
                      ? "bg-white/10 text-white font-medium"
                      : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-white">{user?.email}</p>
              <p className="text-xs text-gray-400">
                {(user as any)?.role === 'admin' ? 'Admin' : 'Employee'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/profile')}
              className="transition-smooth hover:bg-white/10 text-white px-3"
              title="Profile"
            >
              <User className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="transition-smooth hover:bg-white/10 text-white px-3"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
