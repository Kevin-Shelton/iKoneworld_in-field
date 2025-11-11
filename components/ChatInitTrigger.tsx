"use client";

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function ChatInitTrigger() {
  const searchParams = useSearchParams();
  const triggerChat = searchParams.get('triggerChat') === 'true';

  useEffect(() => {
    if (triggerChat) {
      // Find the Chat button. Based on the dashboard structure, it is the third button
      // in the "Start New Conversation" section.
      // We will use a more robust selector if possible, but for now, we'll rely on the structure.
      // The StartDemoChat component renders a button with the text "Chat"
      const chatButton = document.querySelector('button:has(svg.lucide-message-square)');

      if (chatButton) {
        // Programmatically click the button to open the modal
        chatButton.click();
        
        // Clean up the URL to prevent the modal from opening on subsequent manual navigations
        // We use replaceState to avoid adding a new entry to the browser history
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [triggerChat]);

  // This component renders nothing, its purpose is purely side-effect based
  return null;
}
