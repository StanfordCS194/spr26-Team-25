'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AvatarCircle from '../../components/AvatarCircle';
import { AVATARS, CIVILIZATION_LABELS, getAvatar, DEFAULT_AVATAR_ID, type TutorAvatar } from '../../lib/avatars';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface UserProfile {
  experience: string;
  goal: string;
  time: string;
}

interface VocabWord {
  id: number;
  greek: string;
  transliteration: string;
  meaning: string;
  session_id: string;
  language?: string;
  created_at?: string;
}

const HIDDEN_LANGS = new Set(['old-norse', 'old_norse', 'norse', 'oldnorse']);

const EXPERIENCE_OPTIONS = [
  'No, complete beginner',
  'A little (alphabet, basic words)',
  'Some formal study',
  'Advanced student',
];
const GOAL_OPTIONS = [
  'Read philosophy (Plato, Aristotle)',
  'Read the New Testament',
  'General curiosity & history',
  'Academic coursework',
];
const TIME_OPTIONS = [
  '15–30 minutes',
  '30–60 minutes',
  '1–2 hours',
  '2+ hours',
];

export default function SettingsPage() {
  const router = useRouter();

  // account
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  // learning profile
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingField, setEditingField] = useState<keyof UserProfile | null>(null);

  // avatar
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(DEFAULT_AVATAR_ID);

  // vocabulary history
  const [vocab, setVocab] = useState<VocabWord[]>([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [showAllVocab, setShowAllVocab] = useState(false);
  const [vocabSearch, setVocabSearch] = useState('');

  // feedback toasts
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // ── on mount: load everything from Supabase ──────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }

      setUserId(user.id);
      setEmail(user.email ?? '');

      const name = user.user_metadata?.display_name ?? '';
      setDisplayName(name);
      setNameInput(name);

      // avatar: prefer Supabase metadata, fall back to localStorage
      const metaAvatarId = user.user_metadata?.avatar_id as string | undefined;
      const storedAvatarId = localStorage.getItem('chronos_avatar');
      const resolvedId = metaAvatarId ?? storedAvatarId ?? DEFAULT_AVATAR_ID;
      setSelectedAvatarId(resolvedId);
      localStorage.setItem('chronos_avatar', resolvedId);

      // profile: prefer Supabase metadata, fall back to localStorage
      const metaProfile = user.user_metadata?.profile as UserProfile | undefined;
      if (metaProfile) {
        setProfile(metaProfile);
        localStorage.setItem('chronos_profile', JSON.stringify(metaProfile));
      } else {
        const saved = localStorage.getItem('chronos_profile');
        if (saved) setProfile(JSON.parse(saved));
      }

      // load vocabulary history
      setVocabLoading(true);
      fetch(`${BACKEND}/api/vocabulary/by-user/${user.id}`)
        .then(r => r.json())
        .then(data => setVocab(data.vocabulary ?? []))
        .catch(() => {})
        .finally(() => setVocabLoading(false));
    });
  }, []);

  // ── display name ──────────────────────────────────────────────────────────
  async function saveName() {
    const name = nameInput.trim();
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    if (error) { showToast('Could not save name'); return; }
    setDisplayName(name);
    setEditingName(false);
    showToast('Name saved');
  }

  // ── avatar ────────────────────────────────────────────────────────────────
  async function selectAvatar(id: string) {
    setSelectedAvatarId(id);
    localStorage.setItem('chronos_avatar', id);
    const { error } = await supabase.auth.updateUser({ data: { avatar_id: id } });
    if (error) { showToast('Could not save avatar'); return; }
    showToast(`Avatar set to ${getAvatar(id).name}`);
  }

  // ── password ──────────────────────────────────────────────────────────────
  async function savePassword() {
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPasswordError(error.message); return; }

    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordForm(false);
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2500);
    showToast('Password updated');
  }

  // ── learning profile ──────────────────────────────────────────────────────
  async function updateProfileField(field: keyof UserProfile, value: string) {
    const updated = { ...profile!, [field]: value };
    setProfile(updated);
    setEditingField(null);

    // persist to localStorage immediately
    localStorage.setItem('chronos_profile', JSON.stringify(updated));

    // persist to Supabase user metadata
    const { error } = await supabase.auth.updateUser({
      data: { profile: updated },
    });
    if (error) { showToast('Could not sync to cloud'); return; }
    showToast('Profile saved');
  }

  // ── sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem('chronos_profile');
    router.push('/');
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function levelLabel() {
    if (!profile) return '—';
    if (profile.experience === 'No, complete beginner') return 'Beginner';
    if (profile.experience === 'A little (alphabet, basic words)') return 'Beginner';
    if (profile.experience === 'Some formal study') return 'Intermediate';
    return 'Advanced';
  }

  function initials() {
    const name = displayName || email;
    return name ? name.slice(0, 2).toUpperCase() : '?';
  }

  // always exclude old-norse words from settings history
  const visibleVocab = vocab.filter(w => !HIDDEN_LANGS.has((w.language ?? 'greek').toLowerCase()));

  const filteredVocab = vocabSearch.trim()
    ? visibleVocab.filter(w =>
        w.greek.toLowerCase().includes(vocabSearch.toLowerCase()) ||
        w.transliteration.toLowerCase().includes(vocabSearch.toLowerCase()) ||
        w.meaning.toLowerCase().includes(vocabSearch.toLowerCase())
      )
    : visibleVocab;

  const displayedVocab = vocabSearch.trim()
    ? filteredVocab
    : showAllVocab ? filteredVocab : filteredVocab.slice(-30).reverse();

  function exportCsv() {
    if (vocab.length === 0) return;
    const rows = [
      ['Greek', 'Transliteration', 'Meaning'],
      ...vocab.map(w => [w.greek, w.transliteration, w.meaning]),
    ];
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chronos_vocabulary.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen relative flex flex-col"
      style={{
        backgroundImage: "url('/backgrounds/lindo_mar.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/65" />

      {/* nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5">
        <button
          onClick={() => router.push('/tutor')}
          className="text-white/50 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>
        <p className="text-white/40 text-xs tracking-widest uppercase">Settings</p>
        <div className="w-14" />
      </nav>

      {/* toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-600/90 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* content */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-3 sm:px-4 pb-16 pt-2">
        <div className="w-full max-w-md space-y-4">

          {/* ── Account ─────────────────────────────────────────────────── */}
          <Section label="Account">
            {/* avatar + name */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-amber-700/60 border border-amber-400/30 flex items-center justify-center text-amber-200 font-semibold text-base flex-shrink-0">
                {initials()}
              </div>
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveName()}
                      placeholder="Display name"
                      autoFocus
                    />
                    <button onClick={saveName} className="text-amber-300 text-xs hover:text-amber-200 transition-colors">Save</button>
                    <button onClick={() => { setEditingName(false); setNameInput(displayName); }} className="text-white/30 text-xs hover:text-white/60 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium truncate">
                      {displayName || <span className="text-white/30 italic">No display name</span>}
                    </p>
                    <button onClick={() => setEditingName(true)} className="text-white/30 hover:text-amber-300 text-xs transition-colors">Edit</button>
                  </div>
                )}
                <p className="text-white/40 text-xs mt-0.5 truncate">{email}</p>
              </div>
            </div>

            {/* level badge */}
            <div className="flex items-center justify-between mb-5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
              <span className="text-white/40 text-xs">Greek level</span>
              <span className="text-amber-300 text-xs font-medium">{levelLabel()}</span>
            </div>

            {/* change password */}
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="w-full text-left px-4 py-3 rounded-xl border border-white/10 hover:bg-white/10 text-white/50 hover:text-white/80 text-sm transition-all mb-2"
            >
              {showPasswordForm ? '↑ Cancel password change' : '🔑 Change password'}
            </button>

            {showPasswordForm && (
              <div className="space-y-2 mb-3">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePassword()}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                {passwordError && <p className="text-red-400 text-xs px-1">{passwordError}</p>}
                {passwordSaved && <p className="text-amber-300 text-xs px-1">Password updated ✓</p>}
                <button
                  onClick={savePassword}
                  className="w-full bg-amber-700 hover:bg-amber-600 text-white text-sm py-2.5 rounded-xl transition-all"
                >
                  Update password
                </button>
              </div>
            )}

            {/* sign out */}
            <button
              onClick={signOut}
              className="w-full bg-white/10 hover:bg-red-500/20 border border-white/20 hover:border-red-400/40 text-white/50 hover:text-red-300 text-sm py-2.5 rounded-xl transition-all"
            >
              Sign Out
            </button>
          </Section>

          {/* ── Tutor Avatar ─────────────────────────────────────────────── */}
          <Section label="Tutor Avatar">
            <p className="text-white/30 text-xs mb-4 leading-relaxed">
              Choose a historical figure as your guide — they'll appear as your tutor across all sessions.
            </p>
            {(['ancient-greek', 'greek-christian', 'nahuatl'] as TutorAvatar['civilization'][]).map(civ => (
              <div key={civ} className="mb-5 last:mb-0">
                <p className="text-white/30 text-xs font-medium tracking-widest uppercase mb-2">
                  {CIVILIZATION_LABELS[civ]}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {AVATARS.filter(a => a.civilization === civ).map(avatar => {
                    const selected = avatar.id === selectedAvatarId;
                    return (
                      <button
                        key={avatar.id}
                        onClick={() => selectAvatar(avatar.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          selected
                            ? 'bg-white/15 border-white/40'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/25'
                        }`}
                      >
                        <AvatarCircle avatar={avatar} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-xs font-medium truncate">{avatar.name}</p>
                          <p className="text-white/40 text-xs truncate">{avatar.era}</p>
                        </div>
                        {selected && (
                          <span className="text-amber-400 text-xs flex-shrink-0">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* current selection summary */}
            <div className="mt-4 flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl">
              <AvatarCircle avatar={getAvatar(selectedAvatarId)} size="md" />
              <div>
                <p className="text-white/70 text-sm font-medium">{getAvatar(selectedAvatarId).name}</p>
                <p className="text-white/35 text-xs">{getAvatar(selectedAvatarId).role} · {getAvatar(selectedAvatarId).era}</p>
              </div>
            </div>
          </Section>

          {/* ── Learning Profile ─────────────────────────────────────────── */}
          <Section label="Learning Profile">
            {!profile ? (
              <div className="text-center py-4">
                <p className="text-white/40 text-sm mb-3">No profile yet.</p>
                <button
                  onClick={() => router.push('/onboarding')}
                  className="bg-amber-700 hover:bg-amber-600 text-white text-sm px-5 py-2 rounded-xl transition-all"
                >
                  Set Up Profile
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <ProfileField
                  label="Experience"
                  value={profile.experience}
                  isEditing={editingField === 'experience'}
                  options={EXPERIENCE_OPTIONS}
                  onEdit={() => setEditingField(editingField === 'experience' ? null : 'experience')}
                  onSelect={v => updateProfileField('experience', v)}
                />
                <ProfileField
                  label="Learning Goal"
                  value={profile.goal}
                  isEditing={editingField === 'goal'}
                  options={GOAL_OPTIONS}
                  onEdit={() => setEditingField(editingField === 'goal' ? null : 'goal')}
                  onSelect={v => updateProfileField('goal', v)}
                />
                <ProfileField
                  label="Weekly Time"
                  value={profile.time}
                  isEditing={editingField === 'time'}
                  options={TIME_OPTIONS}
                  onEdit={() => setEditingField(editingField === 'time' ? null : 'time')}
                  onSelect={v => updateProfileField('time', v)}
                />
              </div>
            )}
          </Section>

          {/* ── Vocabulary History ───────────────────────────────────────── */}
          <Section label={`Vocabulary History${visibleVocab.length > 0 ? ` · ${visibleVocab.length} words` : ''}`}>
            {vocabLoading ? (
              <p className="text-white/30 text-sm text-center py-4">Loading...</p>
            ) : vocab.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">
                No vocabulary yet — start a chat or voice session to build your list.
              </p>
            ) : (
              <>
                {/* search + export row */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Search words..."
                    value={vocabSearch}
                    onChange={e => setVocabSearch(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <button
                    onClick={exportCsv}
                    title="Export as CSV"
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-white/50 hover:text-white text-xs transition-all whitespace-nowrap"
                  >
                    ↓ CSV
                  </button>
                </div>

                {displayedVocab.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-3">No matches for "{vocabSearch}"</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {displayedVocab.map((word) => (
                      <div key={word.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                        <p className="text-amber-300 text-base w-24 flex-shrink-0">{word.greek}</p>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/40 text-xs">{word.transliteration}</p>
                          <p className="text-white/70 text-sm">{word.meaning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!vocabSearch && visibleVocab.length > 30 && (
                  <button
                    onClick={() => setShowAllVocab(!showAllVocab)}
                    className="mt-3 w-full text-white/30 hover:text-white/60 text-xs transition-colors"
                  >
                    {showAllVocab ? 'Show fewer' : `Show all ${visibleVocab.length} words`}
                  </button>
                )}
              </>
            )}
          </Section>

          {/* ── Quick Links ──────────────────────────────────────────────── */}
          <Section label="Quick Links">
            <div className="space-y-2">
              <button
                onClick={() => router.push('/tutor')}
                className="w-full text-left px-4 py-3 rounded-xl border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all"
              >
                🎙️ Voice Tutor
              </button>
              <button
                onClick={() => router.push('/chat')}
                className="w-full text-left px-4 py-3 rounded-xl border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all"
              >
                💬 Text Chat
              </button>
              <button
                onClick={() => router.push('/vocabulary')}
                className="w-full text-left px-4 py-3 rounded-xl border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all"
              >
                📚 Vocabulary & Flashcards
              </button>
            </div>
          </Section>

        </div>
      </div>
    </main>
  );
}

// ── sub-components ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-6">
      <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-4">{label}</p>
      {children}
    </div>
  );
}

function ProfileField({
  label,
  value,
  isEditing,
  options,
  onEdit,
  onSelect,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  options: string[];
  onEdit: () => void;
  onSelect: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-white/40 text-xs">{label}</p>
        <button onClick={onEdit} className="text-white/30 hover:text-amber-300 text-xs transition-colors">
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>
      {isEditing ? (
        <div className="space-y-1.5">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => onSelect(opt)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                opt === value
                  ? 'border-amber-400/60 bg-amber-700/20 text-amber-200'
                  : 'border-white/15 hover:border-white/30 text-white/60 hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-white/80 text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          {value}
        </p>
      )}
    </div>
  );
}
