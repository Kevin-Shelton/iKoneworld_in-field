"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import type { Language } from "../../drizzle/schema";

export default function LanguageSelection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  
  const [favoriteLanguages, setFavoriteLanguages] = useState<Language[]>([]);
  const [allLanguages, setAllLanguages] = useState<Language[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);

  // Fetch favorite languages
  useEffect(() => {
    fetch("/api/languages/favorites")
      .then((res) => res.json())
      .then((data) => {
        setFavoriteLanguages(data);
        setLoadingFavorites(false);
      })
      .catch((error) => {
        console.error("Error fetching favorite languages:", error);
        toast.error("Failed to load favorite languages");
        setLoadingFavorites(false);
      });
  }, []);

  // Fetch all languages
  useEffect(() => {
    fetch("/api/languages")
      .then((res) => res.json())
      .then((data) => {
        setAllLanguages(data);
        setLoadingAll(false);
      })
      .catch((error) => {
        console.error("Error fetching languages:", error);
        toast.error("Failed to load languages");
        setLoadingAll(false);
      });
  }, []);

  // Filter languages based on search query
  const filteredLanguages = useMemo(() => {
    if (!allLanguages) return [];
    if (!searchQuery.trim()) return allLanguages;

    const query = searchQuery.toLowerCase();
    return allLanguages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(query) ||
        lang.nativeName?.toLowerCase().includes(query) ||
        lang.code.toLowerCase().includes(query)
    );
  }, [allLanguages, searchQuery]);

  // Handle language selection
  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
    setIsConfirmModalOpen(true);
  };

  // Play sample TTS for confirmation
  const playSample = async () => {
    if (!selectedLanguage) return;

    setIsPlayingSample(true);
    try {
      const sampleText = "Hello, welcome to iK OneWorld";
      
      // Get available voices for this language
      const voicesResponse = await fetch(`/api/languages/voices?language=${selectedLanguage.code}`);

      if (!voicesResponse.ok) {
        throw new Error("Failed to fetch voices");
      }

      const voices = await voicesResponse.json();
      
      if (!voices || voices.length === 0) {
        toast.error("No voices available for this language");
        setIsPlayingSample(false);
        return;
      }

      // Use the first available voice
      const voice = voices[0].voice;

      // Request TTS synthesis
      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice,
          text: sampleText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to synthesize speech");
      }

      // Play the audio
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPlayingSample(false);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPlayingSample(false);
        toast.error("Failed to play audio sample");
      };

      await audio.play();
    } catch (error) {
      console.error("Error playing sample:", error);
      toast.error("Failed to play sample audio");
      setIsPlayingSample(false);
    }
  };

  // Confirm language selection
  const confirmLanguageSelection = () => {
    if (!selectedLanguage) return;

    // Store selected language in localStorage
    localStorage.setItem("selectedLanguage", JSON.stringify(selectedLanguage));
    
    toast.success(`Language set to ${selectedLanguage.name}`);
    setIsConfirmModalOpen(false);
    
    // Navigate to translation page
    router.push("/translate");
  };

  // Get flag emoji from country code
  const getFlagEmoji = (countryCode: string | null): string => {
    if (!countryCode) return "🌐";
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto max-w-6xl py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Select Your Language
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Choose your preferred language for real-time translation
          </p>
        </div>

        {/* Favorite Languages */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Popular Languages
          </h2>
          {loadingFavorites ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {favoriteLanguages?.map((language) => (
                <Card
                  key={language.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:border-blue-500"
                  onClick={() => handleLanguageSelect(language)}
                >
                  <CardContent className="p-6 text-center">
                    <div className="text-5xl mb-3">{getFlagEmoji(language.countryCode)}</div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {language.name}
                    </h3>
                    {language.nativeName && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {language.nativeName}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* All Languages with Search */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            All Languages
          </h2>
          
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-6 text-lg"
            />
          </div>

          {/* Languages List */}
          {loadingAll ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredLanguages.map((language) => (
                <Card
                  key={language.id}
                  className="cursor-pointer hover:shadow-md transition-shadow duration-200 hover:border-blue-500"
                  onClick={() => handleLanguageSelect(language)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="text-3xl">{getFlagEmoji(language.countryCode)}</div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {language.name}
                      </h3>
                      {language.nativeName && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {language.nativeName}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filteredLanguages.length === 0 && !loadingAll && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No languages found</p>
            </div>
          )}
        </section>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Language Selection</DialogTitle>
            <DialogDescription>
              You have selected {selectedLanguage?.name}. Would you like to hear a sample?
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            <div className="text-center">
              <div className="text-6xl mb-4">{getFlagEmoji(selectedLanguage?.countryCode || null)}</div>
              <h3 className="text-xl font-semibold">{selectedLanguage?.name}</h3>
              {selectedLanguage?.nativeName && (
                <p className="text-gray-500 mt-1">{selectedLanguage.nativeName}</p>
              )}
            </div>

            <Button
              variant="outline"
              onClick={playSample}
              disabled={isPlayingSample}
              className="w-full"
            >
              {isPlayingSample ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Playing...
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" />
                  Play Sample
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={confirmLanguageSelection} className="flex-1">
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
