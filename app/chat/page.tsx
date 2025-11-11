import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ChatLandingClient from '@/components/ChatLandingClient';

export default async function ChatLandingPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if (!user) {
    redirect('/login');
  }

  return <ChatLandingClient userId={user.id} />;
}
