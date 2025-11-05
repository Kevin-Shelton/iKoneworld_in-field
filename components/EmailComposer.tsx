'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { X, Languages, Loader2, Send, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Recipient {
  email: string;
  name?: string;
  language: string;
  isKnown: boolean;
}

interface EmailComposerProps {
  mode: 'compose' | 'reply' | 'reply-all' | 'forward';
  threadId?: string;
  initialRecipients?: Recipient[];
  initialSubject?: string;
  onSend?: () => void;
  onCancel?: () => void;
  userEmail?: string;
  userLanguage?: string;
}

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'ru', name: 'Russian' },
];

export function EmailComposer({
  mode,
  threadId,
  initialRecipients = [],
  initialSubject = '',
  onSend,
  onCancel,
  userEmail,
  userLanguage = 'en',
}: EmailComposerProps) {
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState<string | null>(null);

  // Fetch contact info when email is entered
  async function lookupContact(email: string): Promise<Recipient> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('name, language')
        .eq('email', email)
        .single();

      if (error || !data) {
        // Unknown contact - default to English
        return {
          email,
          language: 'en',
          isKnown: false,
        };
      }

      return {
        email,
        name: data.name,
        language: data.language,
        isKnown: true,
      };
    } catch (err) {
      return {
        email,
        language: 'en',
        isKnown: false,
      };
    }
  }

  async function handleAddRecipient() {
    const email = newRecipientEmail.trim().toLowerCase();
    
    if (!email) return;
    
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check if already added
    if (recipients.some(r => r.email === email)) {
      toast.error('Recipient already added');
      return;
    }

    // Lookup contact
    const recipient = await lookupContact(email);
    setRecipients([...recipients, recipient]);
    setNewRecipientEmail('');

    if (!recipient.isKnown) {
      toast.info(`${email} is a new contact. You can set their language.`);
    }
  }

  function handleRemoveRecipient(email: string) {
    setRecipients(recipients.filter(r => r.email !== email));
  }

  function handleChangeLanguage(email: string, language: string) {
    setRecipients(recipients.map(r => 
      r.email === email ? { ...r, language } : r
    ));
    setShowLanguageSelector(null);
  }

  async function handleSend() {
    if (recipients.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    if (!content.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      setSending(true);

      const response = await fetch('/api/email/send-multi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId: mode === 'compose' ? undefined : threadId,
          subject,
          content,
          recipients: recipients.map(r => ({
            email: r.email,
            name: r.name,
            language: r.language,
          })),
          senderEmail: userEmail,
          senderLanguage: userLanguage,
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      toast.success(`Email sent to ${recipients.length} recipient(s)`);
      
      if (onSend) {
        onSend();
      }
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  }

  const getModeTitle = () => {
    switch (mode) {
      case 'compose': return 'New Email';
      case 'reply': return 'Reply';
      case 'reply-all': return 'Reply All';
      case 'forward': return 'Forward';
    }
  };

  return (
    <Card className="p-6 bg-slate-900/50 border-slate-800">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">{getModeTitle()}</h3>
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Recipients */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            To:
          </label>
          
          {/* Recipient chips */}
          <div className="flex flex-wrap gap-2 mb-2">
            {recipients.map((recipient) => (
              <div
                key={recipient.email}
                className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 group"
              >
                <span className="text-sm text-white">
                  {recipient.name || recipient.email}
                </span>
                
                {/* Language badge */}
                <button
                  onClick={() => setShowLanguageSelector(
                    showLanguageSelector === recipient.email ? null : recipient.email
                  )}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    recipient.isKnown
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  } hover:bg-opacity-30`}
                  title={recipient.isKnown ? 'Known contact' : 'New contact - click to set language'}
                >
                  <Languages className="w-3 h-3" />
                  {recipient.language.toUpperCase()}
                </button>

                {/* Language selector dropdown */}
                {showLanguageSelector === recipient.email && (
                  <div className="absolute mt-32 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-2 z-10">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleChangeLanguage(recipient.email, lang.code)}
                        className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                          recipient.language === lang.code
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {lang.name} ({lang.code.toUpperCase()})
                      </button>
                    ))}
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={() => handleRemoveRecipient(recipient.email)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Add recipient input */}
          <div className="flex gap-2">
            <Input
              type="email"
              value={newRecipientEmail}
              onChange={(e) => setNewRecipientEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
              placeholder="Enter email address..."
              className="bg-slate-950 border-slate-800 text-white"
            />
            <Button
              onClick={handleAddRecipient}
              variant="outline"
              size="sm"
              className="border-slate-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Subject */}
        {(mode === 'compose' || mode === 'forward') && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Subject:
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="bg-slate-950 border-slate-800 text-white"
            />
          </div>
        )}

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Message:
          </label>
          <div className="mb-2 text-sm text-slate-400 flex items-center gap-2">
            <Languages className="w-4 h-4" />
            <span>
              Compose in {userLanguage.toUpperCase()} • Will auto-translate to each recipient's language
            </span>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your message..."
            className="bg-slate-950 border-slate-800 text-white resize-none"
            rows={8}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
          <div className="text-sm text-slate-400">
            {recipients.length > 0 && (
              <span>
                Sending to {recipients.length} recipient(s) in{' '}
                {[...new Set(recipients.map(r => r.language.toUpperCase()))].join(', ')}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSend}
              disabled={sending || recipients.length === 0 || !content.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
