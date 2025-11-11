import { redirect } from 'next/navigation';

export default function DocumentInitPage() {
  // Redirect to the dashboard with a query parameter to trigger the Documents button
  redirect('/dashboard?triggerDocument=true');
}
