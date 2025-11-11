"use client";

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function ChatInitTrigger() {
  const searchParams = useSearchParams();
  const triggerChat = searchParams.get('triggerChat') === 'true';
  const triggerDocument = searchParams.get('triggerDocument') === 'true';

  useEffect(() => {
    let buttonToClick: HTMLElement | null = null;

    if (triggerChat) {
      // Selector for the Chat button (LucideMessageSquare)
      buttonToClick = document.querySelector('button:has(svg.lucide-message-square)') as HTMLElement | null;
    } else if (triggerDocument) {
      // Selector for the Documents button (using data-testid)
      buttonToClick = document.querySelector('[data-testid="documents-button"]') as HTMLElement | null;
    }

    if (buttonToClick) {
      // Programmatically click the button to open the modal/redirect
      buttonToClick.click();
      
      // Clean up the URL to prevent the modal from opening on subsequent manual navigations
      // We use replaceState to avoid adding a new entry to the browser history
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [triggerChat, triggerDocument]);

  // This component renders nothing, its purpose is purely side-effect based
  return null;
}
