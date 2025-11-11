import { redirect } from 'next/navigation';

export default function ChatInitPage() {
  // Redirect to the dashboard with a query parameter to trigger the chat modal
  redirect('/dashboard?triggerChat=true');
}
