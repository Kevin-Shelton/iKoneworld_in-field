'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookOpen, Plus, Trash2, Edit, Loader2, ArrowLeft } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';

interface GlossaryTerm {
  id: string;
  source_term: string;
  source_language: string;
  target_term: string;
  target_language: string;
  context: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

const COMMON_LANGUAGES = [
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

export default function GlossaryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [sourceTerm, setSourceTerm] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetTerm, setTargetTerm] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [context, setContext] = useState('');

  const supabase = createClient();

  useEffect(() => {
    loadTerms();
  }, []);

  async function loadTerms() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('glossary_terms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTerms(data || []);
    } catch (err) {
      console.error('Error loading glossary terms:', err);
      setError('Failed to load glossary terms');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTerm() {
    if (!sourceTerm.trim() || !targetTerm.trim()) {
      setError('Source term and target term are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const newTerm = {
        source_term: sourceTerm.trim(),
        source_language: sourceLanguage,
        target_term: targetTerm.trim(),
        target_language: targetLanguage,
        context: context.trim() || null,
        created_by: user?.id || null,
        is_active: true,
      };

      const { data, error: insertError } = await supabase
        .from('glossary_terms')
        .insert(newTerm)
        .select()
        .single();

      if (insertError) throw insertError;

      setTerms([data, ...terms]);
      setShowAddDialog(false);
      resetForm();
    } catch (err: any) {
      console.error('Error adding glossary term:', err);
      if (err.code === '23505') {
        setError('This term already exists in the glossary');
      } else {
        setError('Failed to add glossary term');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTerm(termId: string) {
    if (!confirm('Are you sure you want to delete this glossary term?')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('glossary_terms')
        .update({ is_active: false })
        .eq('id', termId);

      if (deleteError) throw deleteError;

      setTerms(terms.filter((t) => t.id !== termId));
    } catch (err) {
      console.error('Error deleting glossary term:', err);
      setError('Failed to delete glossary term');
    }
  }

  function resetForm() {
    setSourceTerm('');
    setSourceLanguage('en');
    setTargetTerm('');
    setTargetLanguage('es');
    setContext('');
  }

  function getLanguageName(code: string): string {
    return COMMON_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase();
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/email')}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inbox
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <BookOpen className="h-8 w-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Translation Glossary</h1>
                <p className="text-slate-400">
                  Define custom translations for specialized terms
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Term
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="p-6 bg-red-500/10 border-red-500/20 mb-6">
            <p className="text-red-400">{error}</p>
            <Button onClick={loadTerms} variant="outline" className="mt-4">
              Retry
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && terms.length === 0 && (
          <Card className="p-12 text-center bg-slate-900/50 border-slate-800">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-white mb-2">No glossary terms yet</h3>
            <p className="text-slate-400 mb-6">
              Add custom translations for specialized terminology to ensure consistent
              translations across all emails.
            </p>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Term
            </Button>
          </Card>
        )}

        {/* Terms List */}
        {!loading && !error && terms.length > 0 && (
          <div className="space-y-3">
            {terms.map((term) => (
              <Card
                key={term.id}
                className="p-4 bg-slate-900/50 border-slate-800 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-6 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {getLanguageName(term.source_language)}
                          </span>
                          <span className="text-xs text-slate-500">Source</span>
                        </div>
                        <p className="text-white font-medium">{term.source_term}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            {getLanguageName(term.target_language)}
                          </span>
                          <span className="text-xs text-slate-500">Target</span>
                        </div>
                        <p className="text-white font-medium">{term.target_term}</p>
                      </div>
                    </div>
                    {term.context && (
                      <p className="text-sm text-slate-400 italic">
                        Context: {term.context}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteTerm(term.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Add Term Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Glossary Term</DialogTitle>
            <DialogDescription className="text-slate-400">
              Define a custom translation for a specialized term
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source-language">Source Language</Label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-term">Source Term</Label>
                <Input
                  id="source-term"
                  value={sourceTerm}
                  onChange={(e) => setSourceTerm(e.target.value)}
                  placeholder="e.g., API"
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target-language">Target Language</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-term">Target Term</Label>
                <Input
                  id="target-term"
                  value={targetTerm}
                  onChange={(e) => setTargetTerm(e.target.value)}
                  placeholder="e.g., API"
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Context (Optional)</Label>
              <Textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Provide context for when this translation should be used..."
                className="bg-slate-950 border-slate-800 resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTerm}
              disabled={saving || !sourceTerm.trim() || !targetTerm.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Term'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
