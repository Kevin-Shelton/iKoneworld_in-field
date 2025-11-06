'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DefaultLanguagePromptProps {
  userId: string;
}

export function DefaultLanguagePrompt({ userId }: DefaultLanguagePromptProps) {
  const router = useRouter();
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the prompt in this session
    const isDismissed = sessionStorage.getItem('defaultLanguagePromptDismissed');
    if (isDismissed) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    // Fetch user profile to check if default language is set
    const checkDefaultLanguage = async () => {
      try {
        const response = await fetch(`/api/profile?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          const hasDefaultLanguage = data.profile?.default_language;
          
          // Show prompt if default language is not set
          setShowPrompt(!hasDefaultLanguage);
        }
      } catch (error) {
        console.error('Error checking default language:', error);
      } finally {
        setLoading(false);
      }
    };

    checkDefaultLanguage();
  }, [userId]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    // Remember dismissal for this session only
    sessionStorage.setItem('defaultLanguagePromptDismissed', 'true');
  };

  const handleGoToProfile = () => {
    router.push('/profile');
  };

  // Don't render anything if loading, dismissed, or shouldn't show
  if (loading || dismissed || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in slide-in-from-top duration-300">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-2xl p-6 relative">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            <AlertCircle className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">
              Set Your Default Language
            </h3>
            <p className="text-white/90 mb-4">
              In order to utilize these services it is recommended that you set your default language
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleGoToProfile}
                className="bg-white text-blue-600 hover:bg-blue-50 font-medium"
              >
                Go to Profile
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                className="text-white hover:bg-white/10"
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
