export const dynamic = 'force-dynamic';

interface SSOLoginPageProps {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}

export default async function SSOLoginPage({ searchParams }: SSOLoginPageProps) {
  const params = await searchParams;
  
  console.log('=== SSO LOGIN PAGE ACCESSED ===');
  console.log('Token:', params.token);
  console.log('Redirect:', params.redirect);
  
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>SSO Login Page</h1>
      <p>If you can see this, the route is working!</p>
      <p>Token: {params.token || 'Not provided'}</p>
      <p>Redirect: {params.redirect || 'Not provided'}</p>
      <p>Check server logs for "SSO LOGIN PAGE ACCESSED"</p>
    </div>
  );
}
