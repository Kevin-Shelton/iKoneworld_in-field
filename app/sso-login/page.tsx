import { redirect } from 'next/headers';

interface SSOLoginPageProps {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}

// Force dynamic rendering because we use cookies
export const dynamic = 'force-dynamic';

export default async function SSOLoginPage({ searchParams }: SSOLoginPageProps) {
  try {
    // Await searchParams in Next.js 15+
    const params = await searchParams;
    
    console.log('=== SSO LOGIN PAGE ACCESSED ===');
    console.log('Search params:', params);
    
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>SSO Login Debug</h1>
        <p>Token: {params.token ? 'Present' : 'Missing'}</p>
        <p>Redirect: {params.redirect || 'Not specified'}</p>
        <pre>{JSON.stringify(params, null, 2)}</pre>
      </div>
    );
  } catch (error) {
    console.error('[SSO] Error:', error);
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui', color: 'red' }}>
        <h1>SSO Error</h1>
        <pre>{String(error)}</pre>
      </div>
    );
  }
}
