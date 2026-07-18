import { Inter, Lora } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata = {
  title: "Preston's Pages | Cozy Book Vibe Recommendations",
  description: 'Share your personal vibe and books you love to receive a tailored book recommendation from my personal reading library.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`}>
      <body>
        {/* Fireplace-like ambient glows */}
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        
        {/* Ambient floating hearth embers */}
        <div className="hearth-particles">
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
        </div>

        {children}
        <Analytics />
      </body>
    </html>
  );
}
