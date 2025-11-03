'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { user: authUser } = await signIn(email, password);
      
      // Check if user must reset password
      if (authUser?.user_metadata?.must_reset_password === true) {
        toast.info('Please reset your password to continue');
        router.push('/reset-password');
      } else {
        toast.success('Welcome back!');
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error('Invalid email or password');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      {/* Logo Section */}
      <div className="absolute top-8 left-8 animate-float">
        <Image
          src="/logo-ikoneworld.png"
          alt="iK OneWorld"
          width={180}
          height={60}
          className="h-12 w-auto"
          priority
        />
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md glass animate-float" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center gradient-text">Employee Login</CardTitle>
          <CardDescription className="text-center text-gray-600">
            Sign in to access your translation dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="glass-strong"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="glass-strong"
              />
            </div>
            <Button type="submit" className="w-full glow-hover" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="#" className="text-blue-600 hover:underline font-medium">
              Contact your administrator
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-gray-600 animate-float" style={{ animationDelay: '0.4s' }}>
        <span className="text-sm">Brought to you by:</span>
        <Image
          src="/logo-invictus.png"
          alt="Invictus"
          width={120}
          height={40}
          className="h-8 w-auto"
        />
      </div>
    </div>
  );
}
