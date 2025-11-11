import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Language {
  code: string;
  name: string;
  nativeName: string;
  dir: string;
}

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  textColor?: string;
  variant?: "light" | "dark"; // New prop for easier usage
}

export function LanguageSelector({
  value,
  onChange,
  label,
  placeholder = "Select language",
  className,
  textColor,
  variant = "light", // Default to light background (black text)
}: LanguageSelectorProps) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine text color based on variant or custom textColor
  const labelColor = textColor || (variant === "dark" ? "text-white" : "text-gray-900");
  const triggerColor = textColor || (variant === "dark" ? "text-white" : "text-gray-900");

  useEffect(() => {
    async function fetchLanguages() {
      try {
        const response = await fetch("/api/demo/languages");
        if (response.ok) {
          const data = await response.json();
          setLanguages(data);
        }
      } catch (error) {
        console.error("Failed to fetch languages:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLanguages();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        {label && <span className={`text-sm font-medium ${labelColor}`}>{label}</span>}
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      {label && <span className={`text-sm font-medium ${labelColor} whitespace-nowrap`}>{label}</span>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={`w-[200px] ${triggerColor} [&>span]:${triggerColor}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] bg-white">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="text-gray-900">
              {lang.name} ({lang.nativeName})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}