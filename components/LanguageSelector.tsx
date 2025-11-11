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
}

export function LanguageSelector({
  value,
  onChange,
  label,
  placeholder = "Select language",
  className,
}: LanguageSelectorProps) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);

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
        {label && <span className="text-sm font-medium text-gray-900">{label}</span>}
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      {label && <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{label}</span>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[200px] text-gray-900">
          <SelectValue placeholder={placeholder} className="text-gray-900" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
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