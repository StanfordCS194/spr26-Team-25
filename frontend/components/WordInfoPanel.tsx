'use client';

import { useState } from 'react';

const INFO_TYPES = [
  { key: 'translation', label: '📖 Translation', desc: 'What does it mean?' },
  { key: 'morphology',  label: '🔄 Conjugation', desc: 'Forms & declension' },
  { key: 'examples',    label: '📚 Examples',    desc: 'Classical texts' },
  { key: 'etymology',   label: '🌿 Etymology',   desc: 'Roots & cognates' },
];

interface Props {
  word: string;
  onClose: () => void;
  backendUrl: string;
}

export default function WordInfoPanel({ word, onClose, backendUrl }: Props) {
  const [activeType, setActiveType] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const content = activeType ? (cache[activeType] ?? null) : null;

  const fetchInfo = async (infoType: string) => {
    setActiveType(infoType);
    if (cache[infoType]) return;

    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/word-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, info_type: infoType }),
      });
      const data = await res.json();
      setCache(prev => ({ ...prev, [infoType]: data.content ?? 'No information available.' }));
    } catch {
      setCache(prev => ({ ...prev, [infoType]: 'Could not load information. Please try again.' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />

      {/* panel */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(480px, 92vw)', maxHeight: '72vh',
        background: 'rgba(15, 10, 5, 0.97)',
        border: '1px solid #8B6914', borderRadius: '12px',
        padding: '20px', zIndex: 100,
        display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.85)',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 700, color: '#F5E6C8', fontFamily: "'GFS Didot', 'Palatino Linotype', Georgia, serif" }}>
            {word}
          </h2>
          <button onClick={onClose} title="Close"
            style={{ background: 'none', border: 'none', color: '#A89060', fontSize: '1.4rem', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
            aria-label="Close word panel">
            ✕
          </button>
        </div>

        {/* option buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {INFO_TYPES.map(type => {
            const isActive = activeType === type.key;
            return (
              <button key={type.key} onClick={() => fetchInfo(type.key)} style={{
                flex: '1 1 calc(50% - 4px)', minWidth: '120px',
                padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                background: isActive ? 'rgba(139,105,20,0.4)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isActive ? '#8B6914' : 'rgba(139,105,20,0.3)'}`,
                borderRadius: '8px', color: isActive ? '#FFD700' : '#C8A84B',
                fontFamily: 'sans-serif', transition: 'all 0.15s',
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{type.label}</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '2px' }}>{type.desc}</div>
              </button>
            );
          })}
        </div>

        {/* content area */}
        <div style={{
          flex: 1, overflowY: 'auto',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(139,105,20,0.2)',
          borderRadius: '8px', padding: '14px',
          minHeight: '80px', maxHeight: '280px',
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '24px' }}>
              {/* CSS spinner — no ⟳ character */}
              <div style={{
                width: '24px', height: '24px',
                border: '2px solid rgba(139,105,20,0.3)',
                borderTopColor: '#C8A84B',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : content ? (
            <p style={{ margin: 0, color: '#E8D5A0', fontSize: '0.95rem', lineHeight: 1.75, fontFamily: 'sans-serif', whiteSpace: 'pre-wrap' }}>
              {content}
            </p>
          ) : (
            <p style={{ margin: 0, color: '#5A3D10', fontSize: '0.85rem', fontFamily: 'sans-serif', textAlign: 'center', fontStyle: 'italic', paddingTop: '16px' }}>
              Select an option above to learn about this word
            </p>
          )}
        </div>
      </div>
    </>
  );
}
