import Image from "next/image";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Invictus Branding */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Brought to you by:</span>
            <div className="relative h-6 w-24">
              <Image
                src="/logo-invictus.png"
                alt="Invictus"
                fill
                className="object-contain object-left"
                sizes="96px"
              />
            </div>
          </div>

          {/* Copyright */}
          <div className="text-sm text-muted-foreground text-center md:text-right">
            <p>© {currentYear} iK OneWorld. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
