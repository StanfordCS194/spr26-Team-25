'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';

// const BACKEND_URL = 'https://spr26-team-25-production.up.railway.app';
// const BACKEND_URL = 'http://localhost:8000'; // uncomment for local dev

import { BACKEND_URL } from '@/lib/config';

// tab definitions, key matches info_type sent to the backend
const TABS = [
  { key: 'translation',      label: 'Dictionary'   },
  { key: 'conjugation_table', label: 'Conjugation' },
  { key: 'examples',          label: 'Examples'    },
  { key: 'etymology',         label: 'Etymology'   },
];

// types for the structured conjugation JSON returned by Claude
interface VerbRow   { person: string; label: string; forms: string[]; }
interface VerbData  { type: 'verb';  lemma: string; meaning: string; participles: Record<string, string>; indicative: { tenses: string[]; rows: VerbRow[]; }; }
interface NounRow   { case: string; singular: string; plural: string; }
interface NounData  { type: 'noun';  lemma: string; meaning: string; gender: string; declension: { rows: NounRow[]; }; }
type ConjugationData = VerbData | NounData;

// types for the structured dictionary entry returned by the dictionary_entry prompt
interface DictionaryMeaning  { english: string; example_greek: string; example_english: string; source: string | null;}
interface DictionaryDef      { context: string; meanings: DictionaryMeaning[]; }
interface DictionarySection  { label: string; definitions: DictionaryDef[]; }
interface DictionaryEntry    { searched_word: string; searched_form_info: string; lemma: string; pronunciation: string; part_of_speech: string; gender: string | null; period: string; sections: DictionarySection[]; }

interface ExampleEntry { greek: string; english: string; source: string; }

export default function WordDetailPage({ params }: { params: Promise<{ word: string }> }) {
  // Next.js 15 passes params as a Promise, use() reads it before the component renders
  const { word: encodedWord } = use(params);
  const word = decodeURIComponent(encodedWord);
  const router = useRouter();

  const [activeTab, setActiveTab]           = useState('translation');
  const [cache, setCache]                   = useState<Record<string, string>>({});
  const [conjugation, setConjugation]       = useState<ConjugationData | null>(null);
  const [conjError, setConjError]           = useState(false);
  // structured dictionary entry, loaded on mount and rendered in the Dictionary tab
  const [dictEntry, setDictEntry]   = useState<DictionaryEntry | null>(null);
  const [dictError, setDictError]   = useState(false);

  const [examples, setExamples]         = useState<ExampleEntry[] | null>(null);
  const [examplesError, setExamplesError] = useState(false);

  const [loading, setLoading]               = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');

  // fetches plain text content for Dictionary, Examples, and Etymology tabs
  const fetchText = useCallback(async (infoType: string) => {
    if (cache[infoType]) return; // skip if already cached
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/word-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, info_type: infoType }),
      });
      const data = await res.json();
      setCache(prev => ({ ...prev, [infoType]: data.content ?? 'No information available.' }));
    } catch {
      setCache(prev => ({ ...prev, [infoType]: 'Could not load. Please try again.' }));
    } finally {
      setLoading(false);
    }
  }, [word, cache]);

  // fetches structured JSON for the Dictionary tab
  const fetchDictEntry = useCallback(async () => {
    if (dictEntry || dictError) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/word-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, info_type: 'dictionary_entry' }),
      });
      const data = await res.json();
      const match = data.content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      setDictEntry(JSON.parse(match[0]));
    } catch {
      setDictError(true);
    } finally {
      setLoading(false);
    }
  }, [word, dictEntry, dictError]);

  // fetches structured JSON for the Examples tab
  const fetchExamples = useCallback(async () => {
    if (examples || examplesError) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/word-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, info_type: 'examples' }),
      });
      const data = await res.json();
      const match = data.content.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON in response');
      setExamples(JSON.parse(match[0]));
    } catch {
      setExamplesError(true);
    } finally {
      setLoading(false);
    }
  }, [word, examples, examplesError]);

  // fetches structured JSON for the Conjugation tab
  const fetchConjugation = useCallback(async () => {
    if (conjugation || conjError) return; // skip if already loaded or failed
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/word-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, info_type: 'conjugation_table' }),
      });
      const data = await res.json();
      // extract the JSON object even if Claude wraps it in markdown code blocks
      const match = data.content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON found in response');
      setConjugation(JSON.parse(match[0]));
    } catch {
      setConjError(true);
    } finally {
      setLoading(false);
    }
  }, [word, conjugation, conjError]);

  // load the Dictionary tab automatically when the page first opens
  useEffect(() => {
    fetchDictEntry();
  }, [word]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'translation')            fetchDictEntry();
    else if (key === 'conjugation_table') fetchConjugation();
    else if (key === 'examples')          fetchExamples();
    else fetchText(key);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim())
      router.push(`/dictionary/${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <main
      className="min-h-screen relative"
      style={{
        backgroundImage: "url('/backgrounds/biblioteca_alejandria.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">

        {/* top bar: back button and search input so user can look up another word */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/dictionary')}
            className="text-white/60 hover:text-white text-sm whitespace-nowrap"
          >
            ← Back
          </button>
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search another word..."
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/30 text-sm outline-none focus:border-amber-400/60 transition-colors"
            />
            <button
              type="submit"
              className="bg-amber-500/80 hover:bg-amber-500 text-white rounded-lg px-4 py-2 text-sm transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* word title */}
        <div className="mb-6">
          <h1
            className="text-white text-5xl font-semibold"
            style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}
          >
            {word}
          </h1>
          <p className="text-white/40 text-sm mt-1 font-sans">Ancient Greek</p>
        </div>

        {/* tab bar: underline style */}
        <div className="flex border-b border-white/20 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px font-sans ${
                activeTab === tab.key
                  ? 'text-amber-400 border-amber-400'
                  : 'text-white/50 border-transparent hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* content card */}
        <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-6 min-h-[320px]">
          {loading ? (
            <p className="text-white/30 text-center pt-20 font-sans">Loading...</p>
          ) : activeTab === 'translation' ? (
              <DictionaryEntryView data={dictEntry} error={dictError} />
          ) : activeTab === 'conjugation_table' ? (
              <ConjugationView data={conjugation} error={conjError} />
          ) : activeTab === 'examples' ? (
              <ExamplesView data={examples} error={examplesError} />
          ) : (
              <TextContent content={cache[activeTab]} />
          )}
        </div>
      </div>
    </main>
  );
}

// renders the structured dictionary entry 
function DictionaryEntryView({ data, error }: { data: DictionaryEntry | null; error: boolean }) {
  if (error) return <p className="text-white/40 text-center pt-20 font-sans">Could not load entry.</p>;
  if (!data)  return <p className="text-white/20 text-center pt-20 font-sans">Loading...</p>;

  return (
    <div className="flex flex-col gap-6 font-sans">

      {/* word header: searched form on top, lemma below */}
      <div className="pb-4 border-b border-white/10">
        {/* the exact word the user searched */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="text-white text-3xl font-semibold"
            style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}
          >
            {data.searched_word || data.lemma}
          </span>
        </div>

        {/* grammatical context of the searched form */}
        {data.searched_form_info && data.searched_word !== data.lemma && (
          <p className="text-white/40 text-sm mt-1 font-sans">
            {data.searched_form_info} of{' '}
            <span
              className="text-amber-300"
              style={{ fontFamily: "'GFS Didot', serif" }}
            >
              {data.lemma}
            </span>
            {data.pronunciation && (
              <span className="text-white/30 ml-1">({data.pronunciation})</span>
            )}
          </p>
        )}

        {/* if searched word is already the lemma, just show pronunciation */}
        {data.searched_word === data.lemma && data.pronunciation && (
          <p className="text-white/40 text-sm mt-1">({data.pronunciation})</p>
        )}

        <p className="text-amber-400/60 text-xs uppercase tracking-widest mt-1">{data.period}</p>
      </div>

      {/* sections: each section is a grammatical role like TRANSITIVE VERB or MASCULINE NOUN */}
      {data.sections.map((section, si) => (
        <div key={si} className="flex flex-col gap-4">

          {/* section label in small caps, muted */}
          <p className="text-white/35 text-xs uppercase tracking-widest">{section.label}</p>

          {/* numbered definitions */}
          {section.definitions.map((def, di) => (
            <div key={di} className="flex flex-col gap-3 pl-1">
              <p className="text-white/40 text-sm italic">({def.context})</p>

              {/* lettered meanings within each definition */}
              {def.meanings.map((m, mi) => (
                <div key={mi} className="pl-4 flex flex-col gap-1.5">
                  {/* letter label and English meaning in amber */}
                  <p>
                    <span className="text-white/40 text-sm mr-2">
                      {String.fromCharCode(97 + mi)}.
                    </span>
                    <span className="text-amber-300 text-sm font-medium">{m.english}</span>
                  </p>

                  {/* example sentence: Greek on top, English below in muted style */}
                  {m.example_greek && (
                    <div className="pl-3 border-l border-white/10 mt-1">
                      <p
                        className="text-white/75 text-sm"
                        style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}
                      >
                        {m.example_greek}
                      </p>
                      <p className="text-white/40 text-sm mt-0.5">{m.example_english}</p>
                      {/* source citation in smaller muted text */}
                      {m.source && (
                        <p className="text-white/25 text-xs mt-0.5 italic">{m.source}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// plain text renderer used by Dictionary, Examples, and Etymology tabs
function TextContent({ content }: { content?: string }) {
  if (!content) return <p className="text-white/20 text-center pt-20 font-sans">Loading...</p>;
  return (
    <p className="text-white/80 text-base leading-relaxed whitespace-pre-wrap font-sans">
      {content}
    </p>
  );
}

// renders examples as a two-column layout: Greek on the left, English on the right
function ExamplesView({ data, error }: { data: ExampleEntry[] | null; error: boolean }) {
  if (error) return <p className="text-white/40 text-center pt-20 font-sans">Could not load examples.</p>;
  if (!data)  return <p className="text-white/20 text-center pt-20 font-sans">Loading...</p>;

  return (
    <div className="flex flex-col font-sans">
      {data.map((ex, i) => (
        <div key={i} className={`py-4 ${i > 0 ? 'border-t border-white/10' : ''}`}>
          <div className="grid grid-cols-2 gap-6">
            <p
              className="text-white/85 text-sm leading-relaxed"
              style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}
            >
              {ex.greek}
            </p>
            <p className="text-white/60 text-sm leading-relaxed">{ex.english}</p>
          </div>
          <p className="text-white/25 text-xs italic mt-2">{ex.source}</p>
        </div>
      ))}
    </div>
  );
}

// top-level conjugation renderer: picks VerbTable or NounTable based on the type field
function ConjugationView({ data, error }: { data: ConjugationData | null; error: boolean }) {
  if (error)  return <p className="text-white/40 text-center pt-20 font-sans">Could not load conjugation.</p>;
  if (!data)  return <p className="text-white/20 text-center pt-20 font-sans">Loading...</p>;
  if (data.type === 'verb') return <VerbTable data={data} />;
  if (data.type === 'noun') return <NounTable data={data} />;
  return null;
}

// verb conjugation table: rows are persons, columns are tenses
function VerbTable({ data }: { data: VerbData }) {
  return (
    <div className="flex flex-col gap-6">

      {/* lemma, meaning, and participles shown above the table */}
      <div className="font-sans text-sm">
        <span className="text-white/40">Dictionary form: </span>
        <span className="text-amber-300" style={{ fontFamily: "'GFS Didot', serif" }}>{data.lemma}</span>
        <span className="text-white/50">, {data.meaning}</span>
      </div>
      {data.participles && Object.keys(data.participles).length > 0 && (
        <div className="flex flex-wrap gap-4 font-sans text-sm">
          <span className="text-white/40">Participles:</span>
          {Object.entries(data.participles).map(([tense, form]) => (
            <span key={tense}>
              <span className="text-white/40">{tense}: </span>
              <span className="text-white/80" style={{ fontFamily: "'GFS Didot', serif" }}>{form}</span>
            </span>
          ))}
        </div>
      )}

      {/* indicative table */}
      <div>
        <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3 font-sans">Indicative</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {/* empty cell for the person label column */}
                <th className="text-left pb-3 pr-6 font-sans font-normal text-white/30 text-xs w-16"></th>
                {data.indicative.tenses.map(tense => (
                  <th key={tense} className="text-left pb-3 pr-6 font-sans font-medium text-white/50 text-xs">
                    {tense}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.indicative.rows.map((row, i) => (
                <tr key={row.person} className={i > 0 ? 'border-t border-white/5' : ''}>
                  {/* person pronoun */}
                  <td
                    className="py-3 pr-6 text-white/30 text-xs font-sans"
                    style={{ fontFamily: "'GFS Didot', serif" }}
                  >
                    {row.label}
                  </td>
                  {/* conjugated forms for each tense */}
                  {row.forms.map((form, j) => (
                    <td
                      key={j}
                      className="py-3 pr-6 text-white/85"
                      style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}
                    >
                      {form}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// noun or adjective declension table: rows are cases, columns are singular and plural
function NounTable({ data }: { data: NounData }) {
  return (
    <div className="flex flex-col gap-6">

      {/* lemma, gender, and meaning shown above the table */}
      <div className="font-sans text-sm">
        <span className="text-white/40">Dictionary form: </span>
        <span className="text-amber-300" style={{ fontFamily: "'GFS Didot', serif" }}>{data.lemma}</span>
        <span className="text-white/50">, {data.gender}, {data.meaning}</span>
      </div>

      {/* declension table */}
      <div>
        <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3 font-sans">Declension</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left pb-3 pr-6 font-sans font-normal text-white/30 text-xs w-28"></th>
                <th className="text-left pb-3 pr-6 font-sans font-medium text-white/50 text-xs">Singular</th>
                <th className="text-left pb-3 font-sans font-medium text-white/50 text-xs">Plural</th>
              </tr>
            </thead>
            <tbody>
              {data.declension.rows.map((row, i) => (
                <tr key={row.case} className={i > 0 ? 'border-t border-white/5' : ''}>
                  {/* case name */}
                  <td className="py-3 pr-6 text-white/30 text-xs font-sans">{row.case}</td>
                  {/* singular and plural forms */}
                  <td className="py-3 pr-6 text-white/85" style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}>{row.singular}</td>
                  <td className="py-3 text-white/85"      style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}>{row.plural}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}