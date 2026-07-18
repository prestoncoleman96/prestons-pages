'use client';

import { useState, useRef, useEffect } from 'react';

const VIBE_PRESETS = [
  { label: '🍂 Autumn Rain', vibe: 'A dark atmospheric gothic mystery to read on a rainy afternoon, with beautiful prose, secrets, and a haunting location.', books: ['The Shadow of the Wind', 'Piranesi'] },
  { label: '🚀 Quiet Space', vibe: 'A cozy, slow-paced science fiction story focused on exploration, philosophical thoughts, and deep friendships rather than battles.', books: ['A Case of Conscience'] },
  { label: '🕯️ Dark Academic', vibe: 'An intellectual campus story about secret societies, rare books, and dark atmospheres.', books: ['The Secret History'] },
  { label: '🌲 Wilderness Memoirs', vibe: 'A thoughtful, peaceful nature adventure or memoir about living in isolation in the wilderness.', books: ['Walden'] }
];

const SURPRISE_VIBES = [
  { vibe: 'A fast-paced, high-stakes science fiction adventure with quick wit, political maneuvering, and rich character conflicts.', books: ['Red Rising'] },
  { vibe: 'A beautifully written magical realism story with rich descriptions, dealing with memory, solitude, and quiet wonder.', books: ['Piranesi', 'The Ocean at the End of the Lane'] },
  { vibe: 'An intellectual campus mystery about academic obsession, secrets, and a dark gothic atmosphere.', books: ['The Secret History'] },
  { vibe: 'A thoughtful historical non-fiction that feels like a thriller, containing surprising history facts and wit.', books: ['How to Hide an Empire'] },
  { vibe: 'A classic sci-fi that holds up, dealing with deep philosophical questions of morality, faith, and human connection.', books: ['A Case of Conscience'] }
];

const PLACEHOLDER_VIBES = [
  "e.g. A cozy sci-fi mystery to read on a rainy afternoon, with gentle philosophical elements and a focus on friendship rather than space battles.",
  "e.g. A dark atmospheric gothic mystery set in a remote, drafty mansion during a winter snowstorm, with secrets in the walls.",
  "e.g. A peaceful, nature-focused adventure that feels like escaping to a quiet wooden cabin in the deep pine woods.",
  "e.g. An intellectual campus mystery set in an old library dealing with ancient manuscripts, rare books, and dark academic secrets.",
  "e.g. A magical realism novel set in a small seaside village with folklore motifs, cozy local characters, and gorgeous poetic prose."
];

const getSpineColor = (title) => {
  const colors = [
    'linear-gradient(135deg, #4c1111, #240505)', // Crimson Burgundy
    'linear-gradient(135deg, #113f2c, #071f14)', // Forest Green
    'linear-gradient(135deg, #162942, #0a1421)', // Midnight Blue
    'linear-gradient(135deg, #382c16, #1c150a)', // Dark Gold Brown
    'linear-gradient(135deg, #3d2347, #1f0e24)'  // Deep Royal Purple
  ];
  if (!title) return colors[0];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Home() {
  const [name, setName] = useState('');
  const [vibe, setVibe] = useState('');
  const [favoriteBooks, setFavoriteBooks] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [error, setError] = useState(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const recommendationCache = useRef({});

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(prev => (prev + 1) % PLACEHOLDER_VIBES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleFeedback = async (wasHelpful, alreadyRead) => {
    if (!recommendation?.logId) return;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId: recommendation.logId,
          wasHelpful,
          alreadyRead,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackSubmitted(true);
        setFeedbackMsg(data.message || 'Thank you for your cozy feedback!');
      } else {
        alert(data.error || 'Failed to submit feedback.');
      }
    } catch (err) {
      console.error('Feedback error:', err);
      alert('Failed to submit feedback.');
    }
  };

  const handleShare = () => {
    if (!recommendation) return;
    const shareText = `Preston's Pages recommended "${recommendation.title}" by ${recommendation.author} for my vibe! 📖\n\n"${recommendation.recommendedReason}"\n\nSeek your own recommendation here: ${window.location.origin}`;
    navigator.clipboard.writeText(shareText);
    alert('Cozy recommendation copied to clipboard!');
  };

  const handleApplyPreset = (preset) => {
    setVibe(preset.vibe);
    if (preset.books && preset.books.length > 0) {
      setFavoriteBooks(preset.books);
    }
  };

  const handleAddBook = () => {
    if (favoriteBooks.length < 3) {
      setFavoriteBooks([...favoriteBooks, '']);
    }
  };

  const handleRemoveBook = (index) => {
    const updated = favoriteBooks.filter((_, i) => i !== index);
    setFavoriteBooks(updated.length > 0 ? updated : ['']);
  };

  const handleBookChange = (index, value) => {
    const updated = [...favoriteBooks];
    updated[index] = value;
    setFavoriteBooks(updated);
  };

  const fetchRecommendation = async (vibeText, booksList) => {
    setLoading(true);
    setError(null);
    setRecommendation(null);
    setFeedbackSubmitted(false);
    setFeedbackMsg('');

    const filteredBooks = booksList.filter(book => book.trim() !== '');
    const cacheKey = JSON.stringify({ name, vibe: vibeText, favoriteBooks: filteredBooks });

    if (recommendationCache.current[cacheKey]) {
      console.log('Serving recommendation from client cache.');
      setRecommendation(recommendationCache.current[cacheKey]);
      setLoading(false);
      setTimeout(() => {
        const resultSection = document.getElementById('recommendation-result');
        if (resultSection) {
          resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
      return;
    }

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          vibe: vibeText,
          favoriteBooks: filteredBooks,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recommendation.');
      }

      recommendationCache.current[cacheKey] = data;
      setRecommendation(data);
      
      setTimeout(() => {
        const resultSection = document.getElementById('recommendation-result');
        if (resultSection) {
          resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetchRecommendation(vibe, favoriteBooks);
  };

  const handleSurpriseMe = async () => {
    const randomVibe = SURPRISE_VIBES[Math.floor(Math.random() * SURPRISE_VIBES.length)];
    setName('');
    setVibe(randomVibe.vibe);
    setFavoriteBooks(randomVibe.books);
    await fetchRecommendation(randomVibe.vibe, randomVibe.books);
  };

  const resetSearch = () => {
    setRecommendation(null);
    setVibe('');
    setFavoriteBooks(['']);
    setFeedbackSubmitted(false);
    setFeedbackMsg('');
  };

  const renderStars = (ratingStr) => {
    const val = parseFloat(String(ratingStr).split('/')[0]) || 0;
    const filledCount = Math.min(5, Math.max(0, Math.round(val)));
    const emptyCount = 5 - filledCount;
    return (
      <span className="star-rating" style={{ color: 'var(--accent-gold)', letterSpacing: '2px', fontSize: '1.1rem' }}>
        {'★'.repeat(filledCount)}
        <span style={{ color: 'var(--text-muted)' }}>{'☆'.repeat(emptyCount)}</span>
      </span>
    );
  };

  return (
    <main className="page-container">
      <header>
        <h1>Preston&apos;s <span>Pages</span></h1>
        <p className="header-subtitle">
          A cozy digital archive. Share your vibe and what you enjoy to receive a custom recommendation matched against my personal library of read books.
        </p>
      </header>

      <div className="app-grid">
        {/* Left Column: Form Intake & Ambiance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section className="card">
          <h2 className="card-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            Tell me about yourself
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name-input">Your Name (Optional)</label>
              <input
                id="name-input"
                type="text"
                className="input-field"
                placeholder="e.g. Eleanor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="vibe-input">What&apos;s your current vibe? (Required)</label>
              <textarea
                id="vibe-input"
                className="input-field"
                placeholder={PLACEHOLDER_VIBES[placeholderIdx]}
                required
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
              />
              <div className="vibe-presets-container">
                {VIBE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="vibe-preset-tag"
                    onClick={() => handleApplyPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>1-3 Books You Love</label>
              <div className="fav-books-list">
                {favoriteBooks.map((book, index) => (
                  <div key={index} className="fav-book-row">
                    <input
                      type="text"
                      className="input-field fav-book-input"
                      placeholder={`e.g. Book title (and optionally Author)`}
                      value={book}
                      onChange={(e) => handleBookChange(index, e.target.value)}
                    />
                    {favoriteBooks.length > 1 && (
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => handleRemoveBook(index)}
                        title="Remove book input"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {favoriteBooks.length < 3 && (
                <button
                  type="button"
                  className="add-book-btn"
                  onClick={handleAddBook}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  Add another book
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button type="submit" className="submit-btn" disabled={loading} style={{ flex: 2, minWidth: '180px' }}>
                {loading ? (
                  <>
                    <span className="book-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', marginBottom: 0, marginRight: '8px' }}></span>
                    Consulting the Archives...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
                    Seek a Recommendation
                  </>
                )}
              </button>
              <button 
                type="button" 
                className="share-btn" 
                disabled={loading} 
                onClick={handleSurpriseMe}
                style={{ flex: 1, minWidth: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', borderStyle: 'solid', borderColor: 'rgba(223, 171, 82, 0.3)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/></svg>
                Surprise Me
              </button>
            </div>
          </form>
          </section>


        </div>

        {/* Right Column: Recommendations Screen */}
        <section id="recommendation-result" className="card recommendation-section-wrapper">
          {loading && (
            <div className="loading-container">
              <div className="book-loader">
                <div className="book-loader-spine"></div>
                <div className="page"></div>
                <div className="page"></div>
                <div className="page"></div>
              </div>
              <p className="loading-text" style={{ marginTop: '1rem' }}>Dusting off the card catalog...</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Matching your vibe with my reading list of 1,000+ books.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="loading-container" style={{ color: '#ef4444' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h3 style={{ fontFamily: 'var(--font-serif)', margin: '1rem 0 0.5rem' }}>Seeker&apos;s Error</h3>
              <p className="reco-notes" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {!loading && !error && recommendation && (
            <div className="recommendation-card-content" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {recommendation.isbn && (
                <div className="reco-cover-wrapper" style={{ flexShrink: 0, width: '155px', height: '232px', position: 'relative', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', border: '1px solid var(--glass-border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={`https://covers.openlibrary.org/b/isbn/${recommendation.isbn.trim()}-L.jpg`} 
                    alt={recommendation.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="cozy-cover-fallback" 
                    style={{ 
                      display: 'none', 
                      width: '100%', 
                      height: '100%', 
                      background: recommendation ? getSpineColor(recommendation.title) : 'var(--bg-secondary)', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      padding: '1.25rem', 
                      textAlign: 'center', 
                      borderLeft: '5px double var(--accent-gold)', 
                      borderRight: '1px solid rgba(255,255,255,0.12)',
                      boxShadow: 'inset 4px 0 10px rgba(0,0,0,0.5), inset -2px 0 5px rgba(255,255,255,0.15)'
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '0.85rem', fontWeight: 'bold', color: '#f5ebe0', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{recommendation.title}</span>
                    <span style={{ fontSize: '0.65rem', color: '#bbaea0', marginTop: '0.5rem', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', letterSpacing: '0.5px' }}>{recommendation.author}</span>
                  </div>
                </div>
              )}
              <div className="reco-details" style={{ flex: 1, minWidth: '280px' }}>
                <div className="recommendation-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span className="reco-label" style={{ marginBottom: 0 }}>Your Tailored Match</span>
                    {recommendation.matchPercentage && (
                      <span className="match-badge">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m7 19 5 3 5-3"/></svg>
                        {recommendation.matchPercentage}% Vibe Match
                      </span>
                    )}
                  </div>
                  <h3 className="reco-title" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{recommendation.title}</h3>
                  <span className="reco-author">by {recommendation.author}</span>
                </div>

                <div className="reco-meta">
                  <div className="meta-item">
                    Genre: <strong>{recommendation.genre}</strong>
                  </div>
                  <div className="meta-item">
                    My Rating: <strong>{renderStars(recommendation.myRating)}</strong>
                  </div>
                </div>

                <div className="reco-section">
                  <h4 className="reco-section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                    Why you&apos;ll love this
                  </h4>
                  <p className="reco-reason">
                    &ldquo;{recommendation.recommendedReason}&rdquo;
                  </p>
                </div>

                {recommendation.myReview && (
                  <div className="reco-section">
                    <h4 className="reco-section-title">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      My Journal Review
                    </h4>
                    <p className="reco-notes">
                      {recommendation.myReview}
                    </p>
                  </div>
                )}

                {/* Telemetry Reader Feedback Loop */}
                {recommendation.logId && (
                  <div className="reco-section" style={{ borderTop: '1px solid rgba(223,171,82,0.1)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                    {feedbackSubmitted ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        {feedbackMsg}
                      </p>
                    ) : (
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>Was this recommendation helpful?</span>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="share-btn"
                            onClick={() => handleFeedback(true, false)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'rgba(223,171,82,0.2)' }}
                          >
                            👍 Yes
                          </button>
                          <button
                            type="button"
                            className="share-btn"
                            onClick={() => handleFeedback(false, false)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'rgba(223,171,82,0.2)' }}
                          >
                            👎 No
                          </button>
                          <button
                            type="button"
                            className="share-btn"
                            onClick={() => handleFeedback(true, true)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'rgba(223,171,82,0.2)' }}
                          >
                            📖 I&apos;ve already read it!
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="add-book-btn"
                    style={{ margin: 0, padding: '0.6rem 1.2rem', borderStyle: 'solid' }}
                    onClick={resetSearch}
                  >
                    Seek another recommendation
                  </button>
                  <button
                    type="button"
                    className="share-btn"
                    onClick={handleShare}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    Share Recommendation
                  </button>
                </div>
                <div>
                  <span className="search-mode-tag" style={{ marginTop: '1rem' }}>Library search engine: {recommendation.searchMode}</span>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && !recommendation && (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3 12 3-12"/><path d="M19 12V2h-6v10H9V6H3v16h18V12h-2Z"/><path d="M12 2v10"/><path d="M12 22v-5"/></svg>
              <p>The fireplace is lit, and the coffee is warm. Share your reading vibe on the left, and I will search the shelves for you.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
