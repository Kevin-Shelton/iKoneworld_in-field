'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type EnterpriseSettings = {
  id: number;
  enterprise_id: string;
  enable_audio_recording: boolean;
  enable_message_audio: boolean;
  enable_transcripts: boolean;
  save_transcripts_to_db: boolean;
  audio_access_roles: string[];
  transcript_access_roles: string[];
  audio_retention_days: number | null;
  transcript_retention_days: number | null;
};

const AVAILABLE_ROLES = [
  { value: 'enterprise_admin', label: 'Enterprise Admin', description: 'Full system access and settings management' },
  { value: 'regional_director', label: 'Regional Director', description: 'Regional oversight and reporting' },
  { value: 'area_manager', label: 'Area Manager', description: 'State/area management' },
  { value: 'district_manager', label: 'District Manager', description: 'District operations' },
  { value: 'store_manager', label: 'Store Manager', description: 'Store-level management' },
  { value: 'field_sales', label: 'Field Sales', description: 'Sales representatives' },
  { value: 'retail_staff', label: 'Retail Staff', description: 'Store employees' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

function AdminSettingsContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<EnterpriseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [enterpriseId, setEnterpriseId] = useState<string>('00000000-0000-0000-0000-000000000000');

  // Form state
  const [enableAudioRecording, setEnableAudioRecording] = useState(true);
  const [enableMessageAudio, setEnableMessageAudio] = useState(false);
  const [enableTranscripts, setEnableTranscripts] = useState(true);
  const [saveTranscriptsToDb, setSaveTranscriptsToDb] = useState(true);
  const [audioAccessRoles, setAudioAccessRoles] = useState<string[]>([
    'enterprise_admin',
    'regional_director',
    'area_manager',
    'district_manager',
    'store_manager',
    'field_sales',
    'retail_staff'
  ]);
  const [transcriptAccessRoles, setTranscriptAccessRoles] = useState<string[]>([
    'enterprise_admin',
    'regional_director',
    'area_manager',
    'district_manager',
    'store_manager',
    'field_sales',
    'retail_staff',
    'viewer'
  ]);
  const [audioRetentionDays, setAudioRetentionDays] = useState<number | null>(null);
  const [transcriptRetentionDays, setTranscriptRetentionDays] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      syncUserAndFetchSettings();
    }
  }, [user]);

  const syncUserAndFetchSettings = async () => {
    try {
      // Sync user to get database ID
      const syncResponse = await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          email: user?.email,
        }),
      });

      if (syncResponse.ok) {
        const syncData = await syncResponse.json();
        const userId = syncData.user.id;
        const userEnterpriseId = syncData.user.enterprise_id || '00000000-0000-00';
        
        setDbUserId(userId);
        setEnterpriseId(userEnterpriseId);
        
        // Fetch enterprise settings
        await fetchSettings(userEnterpriseId);
      }
    } catch (err) {
      console.error('Error syncing user:', err);
      toast.error('Failed to load user information');
    }
  };

  const fetchSettings = async (entId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/settings?enterpriseId=${entId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data.settings);
      
      // Populate form
      setEnableAudioRecording(data.settings.enable_audio_recording);
      setEnableMessageAudio(data.settings.enable_message_audio);
      setEnableTranscripts(data.settings.enable_transcripts);
      setSaveTranscriptsToDb(data.settings.save_transcripts_to_db);
      setAudioAccessRoles(data.settings.audio_access_roles);
      setTranscriptAccessRoles(data.settings.transcript_access_roles);
      setAudioRetentionDays(data.settings.audio_retention_days);
      setTranscriptRetentionDays(data.settings.transcript_retention_days);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load enterprise settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enterpriseId,
          userId: dbUserId,
          enable_audio_recording: enableAudioRecording,
          enable_message_audio: enableMessageAudio,
          enable_transcripts: enableTranscripts,
          save_transcripts_to_db: saveTranscriptsToDb,
          audio_access_roles: audioAccessRoles,
          transcript_access_roles: transcriptAccessRoles,
          audio_retention_days: audioRetentionDays,
          transcript_retention_days: transcriptRetentionDays,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }

      const data = await response.json();
      setSettings(data.settings);
      toast.success('Enterprise settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string, type: 'audio' | 'transcript') => {
    if (type === 'audio') {
      setAudioAccessRoles(prev => 
        prev.includes(role) 
          ? prev.filter(r => r !== role)
          : [...prev, role]
      );
    } else {
      setTranscriptAccessRoles(prev => 
        prev.includes(role) 
          ? prev.filter(r => r !== role)
          : [...prev, role]
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Enterprise Settings</h1>
          <p className="text-gray-600 mt-2">Manage audio recording and transcript controls for your organization</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Recording Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Recording Settings</CardTitle>
              <CardDescription>Control audio recording features and storage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-white">Enable Audio Recording</label>
                  <p className="text-sm text-gray-300">Master switch for all audio recording features</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableAudioRecording}
                  onChange={(e) => setEnableAudioRecording(e.target.checked)}
                  className="h-5 w-5 text-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-white">Enable Per-Message Audio</label>
                  <p className="text-sm text-gray-300">Record individual messages (future feature)</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableMessageAudio}
                  onChange={(e) => setEnableMessageAudio(e.target.checked)}
                  disabled={!enableAudioRecording}
                  className="h-5 w-5 text-blue-600 rounded disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-medium text-white mb-2">Audio Retention Period</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    value={audioRetentionDays || ''}
                    onChange={(e) => setAudioRetentionDays(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Days (leave empty for forever)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                  <span className="text-sm text-gray-300">days</span>
                </div>
                <p className="text-xs text-gray-300 mt-1">Audio files will be automatically deleted after this period. Leave empty to keep forever.</p>
              </div>
            </CardContent>
          </Card>

          {/* Transcript Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Transcript Settings</CardTitle>
              <CardDescription>Control transcript features and storage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-white">Enable Transcripts</label>
                  <p className="text-sm text-gray-300">Master switch for transcript features</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableTranscripts}
                  onChange={(e) => setEnableTranscripts(e.target.checked)}
                  className="h-5 w-5 text-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-white">Save Transcripts to Database</label>
                  <p className="text-sm text-gray-300">Store conversation text in database</p>
                </div>
                <input
                  type="checkbox"
                  checked={saveTranscriptsToDb}
                  onChange={(e) => setSaveTranscriptsToDb(e.target.checked)}
                  disabled={!enableTranscripts}
                  className="h-5 w-5 text-blue-600 rounded disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-medium text-white mb-2">Transcript Retention Period</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    value={transcriptRetentionDays || ''}
                    onChange={(e) => setTranscriptRetentionDays(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Days (leave empty for forever)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                  <span className="text-sm text-gray-300">days</span>
                </div>
                <p className="text-xs text-gray-300 mt-1">Transcripts will be automatically deleted after this period. Leave empty to keep forever.</p>
              </div>
            </CardContent>
          </Card>

          {/* Access Control */}
          <Card>
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
              <CardDescription>Define which roles can access audio and transcripts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block font-medium text-white mb-3">Audio Access Roles</label>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role.value} className="flex items-start space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={audioAccessRoles.includes(role.value)}
                        onChange={() => toggleRole(role.value, 'audio')}
                        className="h-4 w-4 text-blue-600 rounded mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium block">{role.label}</span>
                        <span className="text-xs text-gray-300">{role.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-white mb-3">Transcript Access Roles</label>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role.value} className="flex items-start space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={transcriptAccessRoles.includes(role.value)}
                        onChange={() => toggleRole(role.value, 'transcript')}
                        className="h-4 w-4 text-blue-600 rounded mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium block">{role.label}</span>
                        <span className="text-xs text-gray-300">{role.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Impact */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Impact</CardTitle>
              <CardDescription>Estimated impact of current settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Audio Recording:</span>
                  <span className={enableAudioRecording ? 'text-yellow-600 font-medium' : 'text-green-600 font-medium'}>
                    {enableAudioRecording ? 'Storage costs apply' : 'No storage costs'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transcript Storage:</span>
                  <span className={saveTranscriptsToDb ? 'text-yellow-600 font-medium' : 'text-green-600 font-medium'}>
                    {saveTranscriptsToDb ? 'Database costs apply' : 'No database costs'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Retention Policy:</span>
                  <span className={audioRetentionDays ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                    {audioRetentionDays ? `Auto-cleanup after ${audioRetentionDays} days` : 'Keep forever (higher costs)'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      <Footer />
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <ProtectedRoute>
      <AdminSettingsContent />
    </ProtectedRoute>
  );
}
