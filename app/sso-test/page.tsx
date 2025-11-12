export default async function SSOTestPage() {
  console.log('SSO TEST PAGE ACCESSED');
  
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>SSO Test Page</h1>
      <p>If you can see this, the route is working!</p>
      <p>Check server logs for "SSO TEST PAGE ACCESSED"</p>
    </div>
  );
}
