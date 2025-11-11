import { getServerUser } from "@/lib/supabase/server-utils";
import ChatLandingClient from "@/components/ChatLandingClient";

// This page is now a Server Component, fetching data server-side to avoid the useAuth context error.

export default async function ChatLandingPage() {
  // Fetch user session server-side
  const user = await getServerUser();

  // Pass the user object to the client component
  return <ChatLandingClient user={user} />;
}
