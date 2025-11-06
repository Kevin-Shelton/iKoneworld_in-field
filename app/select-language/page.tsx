"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Loader2, Volume2, Star } from "lucide-react";
import { toast } from "sonner";
import type { Language } from "../../drizzle/schema";
import { useAuth } from "@/contexts/AuthContext";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

// Group languages by base language code
interface LanguageGroup {
  baseCode: string;
  baseName: string;
  languages: Language[];
}

export default function LanguageSelection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [selectionStep, setSelectionStep] = useState<"user" | "guest">("user");
  const [userLanguage, setUserLanguage] = useState<Language | null>(null);
  
  const [favoriteLanguages, setFavoriteLanguages] = useState<Language[]>([]);
  const [allLanguages, setAllLanguages] = useState<Language[]>([]);
  const [favoriteCodes, setFavoriteCodes] = useState<Set<string>>(new Set());
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);
  const [translatedButtons, setTranslatedButtons] = useState<{cancel: string; start: string}>({cancel: "Cancel", start: "Start Conversation"});
  const [audioProgress, setAudioProgress] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.25);
  const { user } = useAuth();

  // Function to stop audio playback
  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setAudioElement(null);
      setIsAudioPlaying(false);
      setIsPlayingSample(false);
      setAudioProgress(0);
    }
  };

  // Auto-play translation notice and translate buttons when dialog opens
  useEffect(() => {
    if (isConfirmModalOpen && selectedLanguage && selectionStep === "guest") {
      playTranslationNotice(selectedLanguage);
      translateButtons(selectedLanguage);
    } else if (!isConfirmModalOpen) {
      // Stop audio and reset button text when dialog closes
      stopAudio();
      setTranslatedButtons({cancel: "Cancel", start: "Start Conversation"});
    }
  }, [isConfirmModalOpen, selectedLanguage, selectionStep]);

  // Translate button text to target language
  const translateButtons = async (language: Language) => {
    try {
      const cancelResponse = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: [{ text: "Cancel" }],
          from: "en-US",
          to: [language.code],
        }),
      });

      const startResponse = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: [{ text: "Start Conversation" }],
          from: "en-US",
          to: [language.code],
        }),
      });

      if (cancelResponse.ok && startResponse.ok) {
        const cancelData = await cancelResponse.json();
        const startData = await startResponse.json();
        
        console.log('[Button Translation] Cancel response JSON:', JSON.stringify(cancelData, null, 2));
        console.log('[Button Translation] Start response JSON:', JSON.stringify(startData, null, 2));
        console.log('[Button Translation] Language code:', language.code);
        console.log('[Button Translation] Cancel translations[0]:', cancelData?.translations?.[0]);
        console.log('[Button Translation] All keys in translations[0]:', Object.keys(cancelData?.translations?.[0] || {}));
        console.log('[Button Translation] Cancel text:', cancelData?.translations?.[0]?.[language.code]);
        console.log('[Button Translation] Start text:', startData?.translations?.[0]?.[language.code]);
        
        setTranslatedButtons({
          cancel: cancelData?.translations?.[0]?.[0]?.text || "Cancel",
          start: startData?.translations?.[0]?.[0]?.text || "Start Conversation"
        });
      }
    } catch (error) {
      console.error("Error translating buttons:", error);
      // Keep English as fallback
    }
  };

  // Fetch user's favorite languages
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/languages/user-favorites?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          // Ensure data is an array
          const languages = Array.isArray(data) ? data : [];
          setFavoriteLanguages(languages);
          setFavoriteCodes(new Set(languages.map((lang: Language) => lang.code)));
          setLoadingFavorites(false);
        })
        .catch((error) => {
          console.error("Error fetching favorite languages:", error);
          setFavoriteLanguages([]);
          setFavoriteCodes(new Set());
          setLoadingFavorites(false);
        });
    } else {
      setLoadingFavorites(false);
    }
  }, [user]);

  // Fetch all languages
  useEffect(() => {
    fetch("/api/languages")
      .then((res) => res.json())
      .then((data) => {
        const languages = data.languages || [];
        console.log('[Language Selection] Loaded languages:', languages.length);
        if (languages.length > 0) {
          console.log('[Language Selection] Sample language:', languages[0]);
          console.log('[Language Selection] Sample countryCode:', languages[0].countryCode, 'Type:', typeof languages[0].countryCode);
        }
        setAllLanguages(languages);
        setLoadingAll(false);
      })
      .catch((error) => {
        console.error("Error fetching languages:", error);
        toast.error("Failed to load languages");
        setLoadingAll(false);
      });
  }, []);

  // Check for default language in user profile
  useEffect(() => {
    const loadDefaultLanguage = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/profile?userId=${user.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.profile?.default_language) {
              const defaultLang = allLanguages.find(
                (lang) => lang.code === data.profile.default_language
              );
              if (defaultLang) {
                setUserLanguage(defaultLang);
                localStorage.setItem("userLanguage", defaultLang.code);
                setSelectionStep("guest");
                toast.success(`Using your default language: ${defaultLang.name}`);
              }
            }
          }
        } catch (error) {
          console.error('Error loading default language:', error);
        }
      }
    };

    const storedUserLang = localStorage.getItem("userLanguage");
    if (storedUserLang && !userLanguage && allLanguages.length > 0) {
      // Load the language object from the stored code
      const lang = allLanguages.find(l => l.code === storedUserLang);
      if (lang) {
        setUserLanguage(lang);
        setSelectionStep("guest");
      }
    } else if (allLanguages.length > 0 && !storedUserLang && !userLanguage) {
      loadDefaultLanguage();
    }
  }, [user, allLanguages, userLanguage]);

  // Toggle favorite status
  const toggleFavorite = async (e: React.MouseEvent, language: Language) => {
    e.stopPropagation();
    
    if (!user?.id) {
      toast.error("Please log in to save favorites");
      return;
    }

    const isFavorite = favoriteCodes.has(language.code);
    
    try {
      if (isFavorite) {
        await fetch("/api/languages/user-favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, languageCode: language.code }),
        });
        
        setFavoriteCodes(prev => {
          const newSet = new Set(prev);
          newSet.delete(language.code);
          return newSet;
        });
        setFavoriteLanguages(prev => prev.filter(lang => lang.code !== language.code));
        toast.success("Removed from favorites");
      } else {
        await fetch("/api/languages/user-favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, languageCode: language.code }),
        });
        
        setFavoriteCodes(prev => new Set([...prev, language.code]));
        setFavoriteLanguages(prev => [...prev, language]);
        toast.success("Added to favorites");
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorites");
    }
  };

  // Group languages by base code
  const groupedLanguages = useMemo(() => {
    const groups: { [key: string]: LanguageGroup } = {};
    
    allLanguages.forEach(lang => {
      if (!groups[lang.baseCode]) {
        groups[lang.baseCode] = {
          baseCode: lang.baseCode,
          baseName: lang.name.split('(')[0].trim(), // e.g., "English" from "English (United States)"
          languages: []
        };
      }
      groups[lang.baseCode].languages.push(lang);
    });
    
    // Sort groups alphabetically and languages within each group
    return Object.values(groups)
      .sort((a, b) => a.baseName.localeCompare(b.baseName))
      .map(group => ({
        ...group,
        languages: group.languages.sort((a, b) => a.name.localeCompare(b.name))
      }));
  }, [allLanguages]);

  // Filter grouped languages based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedLanguages;

    const query = searchQuery.toLowerCase();
    return groupedLanguages
      .map(group => ({
        ...group,
        languages: group.languages.filter(
          lang =>
            lang.name.toLowerCase().includes(query) ||
            lang.nativeName?.toLowerCase().includes(query) ||
            lang.code.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.languages.length > 0);
  }, [groupedLanguages, searchQuery]);

  // Handle language selection
  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
    setIsConfirmModalOpen(true);
  };

  // Play translation notice automatically
  const playTranslationNotice = async (language: Language) => {
    setIsPlayingSample(true);
    try {
      const noticeText = `Language Translation Notice. This application lets you speak in your preferred language. What you say will be translated into English, and what the representative says will be translated into ${language.name} in real time. Please note: Your conversation may be recorded for quality and training purposes. By continuing, you agree to this recording. Tap Start Conversation to begin.`;
      
      // First translate the notice to the target language
      const translateResponse = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: [{ text: noticeText }],
          from: "en-US",
          to: [language.code],
        }),
      });

      if (!translateResponse.ok) {
        throw new Error("Failed to translate notice");
      }

      const data = await translateResponse.json();
      console.log('[Translation Notice] API response:', JSON.stringify(data, null, 2));
      const textToSpeak = data?.translations?.[0]?.[0]?.text || noticeText;
      console.log('[Translation Notice] Text to speak:', textToSpeak);
      console.log('[Translation Notice] Language code for TTS:', language.code);
      
      const voicesResponse = await fetch(`/api/languages/voices?language=${language.code}`);

      if (!voicesResponse.ok) {
        throw new Error("Failed to fetch voices");
      }

      const voices = await voicesResponse.json();
      console.log('[Translation Notice] Available voices:', voices);
      
      if (!voices || voices.length === 0) {
        toast.error("No voices available for this language");
        setIsPlayingSample(false);
        return;
      }

      const voice = voices[0].voice;
      console.log('[Translation Notice] Selected voice:', voice);

      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, text: textToSpeak }),
      });

      if (!response.ok) {
        throw new Error("Failed to synthesize speech");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Set playback speed from state
      audio.playbackRate = playbackSpeed;
      
      // Store audio element for stopping later
      setAudioElement(audio);
      setIsAudioPlaying(true);
      setAudioProgress(0);
      
      // Update progress as audio plays
      audio.ontimeupdate = () => {
        if (audio.duration) {
          const progress = (audio.currentTime / audio.duration) * 100;
          setAudioProgress(progress);
        }
      };
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPlayingSample(false);
        setIsAudioPlaying(false);
        setAudioProgress(100);
        setAudioElement(null);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPlayingSample(false);
        setIsAudioPlaying(false);
        setAudioProgress(0);
        setAudioElement(null);
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

    if (selectionStep === "user") {
      localStorage.setItem("userLanguage", selectedLanguage.code);
      setUserLanguage(selectedLanguage);
      setSelectionStep("guest");
      toast.success(`Your language set to ${selectedLanguage.name}`);
      setIsConfirmModalOpen(false);
      setSelectedLanguage(null);
    } else {
      localStorage.setItem("guestLanguage", selectedLanguage.code);
      toast.success(`Guest language set to ${selectedLanguage.name}`);
      setIsConfirmModalOpen(false);
      router.push("/translate");
    }
  };

  // Get flag SVG component from country code
  const FlagIcon = ({ countryCode, size = "w-8 h-6" }: { countryCode: string | null; size?: string }) => {
    if (!countryCode || countryCode.trim().length !== 2) {
      return <span className="text-2xl">🌐</span>;
    }
    
    const cleanCode = countryCode.trim().toLowerCase();
    
    return (
      <img
        src={`https://flagcdn.com/${cleanCode}.svg`}
        alt={`${countryCode} flag`}
        className={`${size} object-cover rounded shadow-sm`}
        onError={(e) => {
          // Fallback to globe emoji if flag fails to load
          e.currentTarget.style.display = 'none';
          e.currentTarget.insertAdjacentHTML('afterend', '🌐');
        }}
      />
    );
  };

  const getHeaderText = () => {
    if (selectionStep === "user") {
      return {
        title: "Select Your Language",
        description: "Choose your preferred language for speaking"
      };
    } else {
      return {
        title: "Select Guest Language",
        description: "Now select the language you want to translate to.",
        userLanguageText: `You speak ${userLanguage?.name}.`
      };
    }
  };

  const headerText = getHeaderText();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Navigation */}
      <Navigation />
      
      {/* Sticky Header */}
      <div className="sticky top-16 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto max-w-6xl px-4 py-6">
          <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {headerText.title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
            {headerText.description}
          </p>
          {selectionStep === "guest" && userLanguage && (
            <>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-3">
                {'userLanguageText' in headerText ? headerText.userLanguageText : ''}
              </p>
              <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900 px-4 py-2 rounded-lg">
                <FlagIcon countryCode={userLanguage.countryCode} size="w-8 h-6" />
                <span className="font-medium text-gray-900 dark:text-white">
                  Your language: {userLanguage.name}
                </span>
              </div>
            </>
          )}
          
          {/* Search Bar */}
          <div className="relative mt-6 max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-6 text-lg bg-white dark:bg-gray-800"
            />
          </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-6xl py-12 px-4">
        {/* Favorite Languages */}
        {favoriteLanguages.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
              Your Favorites
            </h2>
            {loadingFavorites ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {favoriteLanguages.map((language) => (
                  <Card
                    key={language.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:border-blue-500 relative"
                    onClick={() => handleLanguageSelect(language)}
                  >
                    <button
                      onClick={(e) => toggleFavorite(e, language)}
                      className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 z-10"
                    >
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    </button>
                    <CardContent className="p-6 text-center">
                      <div className="flex justify-center mb-3">
                        <FlagIcon countryCode={language.countryCode} size="w-16 h-12" />
                      </div>
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
        )}

        {/* All Languages with Search and Grouping */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            All Languages
          </h2>
          


          {/* Languages List - Grouped */}
          {loadingAll ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-8">
              {filteredGroups.map((group) => (
                <div key={group.baseCode}>
                  {/* Group Header - only show if multiple variants */}
                  {group.languages.length > 1 && (
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-gray-300 dark:border-gray-700 pb-2">
                      {group.baseName} ({group.languages.length} variants)
                    </h3>
                  )}
                  
                  {/* Languages in this group */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.languages.map((language) => (
                      <Card
                        key={language.id}
                        className="cursor-pointer hover:shadow-md transition-shadow duration-200 hover:border-blue-500 relative"
                        onClick={() => handleLanguageSelect(language)}
                      >
                        <button
                          onClick={(e) => toggleFavorite(e, language)}
                          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 z-10"
                        >
                          <Star 
                            className={`h-4 w-4 ${
                              favoriteCodes.has(language.code)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-400"
                            }`}
                          />
                        </button>
                        <CardContent className="p-4 flex items-center gap-3">
                          <FlagIcon countryCode={language.countryCode} size="w-10 h-7" />
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
                </div>
              ))}
            </div>
          )}

          {filteredGroups.length === 0 && !loadingAll && (
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
              You have selected {selectedLanguage?.name} as your {selectionStep === "user" ? "speaking" : "translation"} language.
              {selectionStep === "guest" && isPlayingSample && " Please listen to the translation notice..."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <FlagIcon countryCode={selectedLanguage?.countryCode || null} size="w-20 h-15" />
              </div>
              <h3 className="text-xl font-semibold">{selectedLanguage?.name}</h3>
              {selectedLanguage?.nativeName && (
                <p className="text-gray-500 mt-1">{selectedLanguage.nativeName}</p>
              )}
              {selectionStep === "guest" && (
                <div className="mt-4 space-y-3">
                  {/* Playback Speed Selector */}
                  <div className="flex items-center justify-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Playback Speed:</label>
                    <select 
                      value={playbackSpeed}
                      onChange={(e) => {
                        const newSpeed = parseFloat(e.target.value);
                        setPlaybackSpeed(newSpeed);
                        if (audioElement) {
                          audioElement.playbackRate = newSpeed;
                        }
                      }}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                      disabled={isAudioPlaying}
                    >
                      <option value="0.75">0.75x</option>
                      <option value="1.0">1.0x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="1.75">1.75x</option>
                      <option value="2.0">2.0x</option>
                    </select>
                  </div>
                  
                  {isPlayingSample && (
                    <>
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Playing translation notice...</span>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${audioProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-center text-gray-500">
                    {Math.round(audioProgress)}% complete
                  </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  // Stop audio if playing
                  stopAudio();
                  setIsConfirmModalOpen(false);
                  // Reset to language selection if on guest step
                  if (selectionStep === "guest") {
                    setSelectionStep("user");
                    setSelectedLanguage(null);
                  }
                }} 
                className="flex-1"
              >
                {selectionStep === "guest" ? translatedButtons.cancel : "Cancel"}
              </Button>
              <Button 
                onClick={confirmLanguageSelection} 
                className="flex-1"
                disabled={selectionStep === "guest" && isAudioPlaying}
              >
                {selectionStep === "user" ? "Next: Guest Language" : translatedButtons.start}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}
