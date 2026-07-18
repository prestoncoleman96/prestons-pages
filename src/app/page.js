'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [name, setName] = useState('');
  const [vibe, setVibe] = useState('');
  const [favoriteBooks, setFavoriteBooks] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [error, setError] = useState(null);
  const recommendationCache = useRef({});

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRecommendation(null);

    // Filter out empty book entries
    const filteredBooks = favoriteBooks.filter(book => book.trim() !== '');

    // Check client-side recommendation cache
    const cacheKey = JSON.stringify({ name, vibe, favoriteBooks: filteredBooks });
    if (recommendationCache.current[cacheKey]) {
      console.log('Serving recommendation from client cache.');
      setRecommendation(recommendationCache.current[cacheKey]);
      setLoading(false);
      // Smooth scroll to the result on mobile
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
          vibe,
          favoriteBooks: filteredBooks,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recommendation.');
      }

      // Store in client-side cache
      recommendationCache.current[cacheKey] = data;

      setRecommendation(data);
      
      // Smooth scroll to the result on mobile
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

  const resetSearch = () => {
    setRecommendation(null);
    setVibe('');
    setFavoriteBooks(['']);
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
                placeholder="e.g. A cozy sci-fi mystery to read on a rainy afternoon, with gentle philosophical elements and an focus on friendship rather than galactic war."
                required
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
              />
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

            <button type="submit" className="submit-btn" disabled={loading}>
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
          </form>
          </section>


        </div>

        {/* Right Column: Recommendations Screen */}
        <section id="recommendation-result" className="card recommendation-section-wrapper">
          {loading && (
            <div className="loading-container">
              <div className="book-spinner"></div>
              <p className="loading-text">Dusting off the card catalog...</p>
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
                  <div className="cozy-cover-fallback" style={{ display: 'none', width: '100%', height: '100%', background: 'linear-gradient(135deg, #2d241d, #1c150c)', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '1.25rem', textAlign: 'center', borderLeft: '3px solid var(--accent-gold)' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{recommendation.title}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{recommendation.author}</span>
                  </div>
                </div>
              )}
              <div className="reco-details" style={{ flex: 1, minWidth: '280px' }}>
                <div className="recommendation-header">
                  <span className="reco-label">Your Tailored Match</span>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
                  <button
                    type="button"
                    className="add-book-btn"
                    style={{ width: 'fit-content', margin: 0, padding: '0.6rem 1.2rem', borderStyle: 'solid' }}
                    onClick={resetSearch}
                  >
                    Seek another recommendation
                  </button>
                  <div>
                    <span className="search-mode-tag" style={{ marginTop: 0 }}>Library search engine: {recommendation.searchMode}</span>
                  </div>
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
