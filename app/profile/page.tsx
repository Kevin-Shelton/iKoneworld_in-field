'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

type Language = {
  code: string;
  name: string;
  nativeName: string;
};

type UserProfile = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: string;
  default_language: string | null;
  createdAt: string;
  lastSignedIn: string;
};

function ProfilePageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const [showLanguageList, setShowLanguageList] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchLanguages();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/profile?userId=${user?.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data.profile);
      setName(data.profile.name || '');
      setDefaultLanguage(data.profile.default_language || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchLanguages = async () => {
    try {
      const response = await fetch('/api/languages');
      
      if (!response.ok) {
        throw new Error('Failed to fetch languages');
      }

      const data = await response.json();
      const langs = data.languages || [];
      setLanguages(Array.isArray(langs) ? langs : []);
    } catch (error) {
      console.error('Error fetching languages:', error);
      setLanguages([]);
    }
  };

  const filteredLanguages = useMemo(() => {
    if (!languageSearch.trim()) return languages;
    
    const search = languageSearch.toLowerCase();
    return languages.filter(
      (lang) =>
        (lang.name && lang.name.toLowerCase().includes(search)) ||
        (lang.nativeName && lang.nativeName.toLowerCase().includes(search)) ||
        (lang.code && lang.code.toLowerCase().includes(search))
    );
  }, [languages, languageSearch]);

  const selectedLanguageName = useMemo(() => {
    if (!defaultLanguage) return '';
    const lang = languages.find((l) => l.code === defaultLanguage);
    return lang ? `${lang.name} (${lang.nativeName})` : defaultLanguage;
  }, [defaultLanguage, languages]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          name: name || null,
          defaultLanguage: defaultLanguage || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      setProfile(data.profile);
      
      // Update localStorage to keep it in sync with profile
      if (defaultLanguage) {
        localStorage.setItem('userLanguage', defaultLanguage);
      } else {
        localStorage.removeItem('userLanguage');
      }
      
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <Navigation />
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
            <p className="text-sm text-gray-600">Manage your account and preferences</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                View your account details and role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-200">Email</Label>
                  <p className="mt-1 text-sm text-gray-100">{profile?.email || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-200">Role</Label>
                  <p className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      profile?.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {profile?.role === 'admin' ? 'Administrator' : 'Employee'}
                    </span>
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-200">Member Since</Label>
                  <p className="mt-1 text-sm text-gray-100">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-200">Last Login</Label>
                  <p className="mt-1 text-sm text-gray-100">
                    {profile?.lastSignedIn ? new Date(profile.lastSignedIn).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organizational Structure */}
          <Card>
            <CardHeader>
              <CardTitle>Organizational Assignment</CardTitle>
              <CardDescription>
                Your organizational structure and assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Organizational assignments will be managed by your administrator. 
                  This includes your enterprise, region, state, city, district, store, and department assignments.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Update your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-300">
                    This name will be displayed in the application
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultLanguage">Default Language</Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="languageSearch"
                        type="text"
                        placeholder="Search languages..."
                        value={languageSearch}
                        onChange={(e) => {
                          setLanguageSearch(e.target.value);
                          setShowLanguageList(true);
                        }}
                        onFocus={() => setShowLanguageList(true)}
                        className="pl-10"
                        disabled={saving}
                      />
                    </div>
                    
                    {defaultLanguage && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                        <span className="text-sm text-blue-900">
                          Selected: {selectedLanguageName}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultLanguage('')}
                          disabled={saving}
                        >
                          Clear
                        </Button>
                      </div>
                    )}

                    {showLanguageList && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredLanguages.length > 0 ? (
                          filteredLanguages.map((lang) => (
                            <button
                              key={lang.code}
                              type="button"
                              className={cn(
                                "w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between",
                                defaultLanguage === lang.code && "bg-blue-50"
                              )}
                              onClick={() => {
                                setDefaultLanguage(lang.code);
                                setLanguageSearch('');
                                setShowLanguageList(false);
                              }}
                              disabled={saving}
                            >
                              <span className="text-sm">
                                {lang.name} ({lang.nativeName})
                              </span>
                              {defaultLanguage === lang.code && (
                                <Check className="h-4 w-4 text-blue-600" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-400">
                            No languages found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-300">
                    Your preferred language for conversations. This will be pre-selected when starting new conversations.
                  </p>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}
