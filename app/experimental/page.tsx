'use client';

import { useRouter } from 'next/navigation';

export default function ExperimentalPage() {
  const router = useRouter();

  const games = [
    {
      title: 'Chess',
      description: 'Play a classic game of chess',
      emoji: '♟️',
      path: '/experimental/chess'
    },
    {
      title: 'Ping Pong',
      description: 'Play ping pong against AI',
      emoji: '🏓',
      path: '/experimental/game'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%)',
      padding: '40px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#fff',
            cursor: 'pointer',
            marginBottom: '24px',
            fontSize: '14px'
          }}
        >
          ← Back to Loco
        </button>

        <h1 style={{
          color: '#fff',
          fontSize: '32px',
          marginBottom: '8px'
        }}>
          🧪 Experimental Games
        </h1>
        
        <p style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '16px',
          marginBottom: '40px'
        }}>
          Try out these experimental mini-games
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {games.map((game) => (
            <div
              key={game.path}
              onClick={() => router.push(game.path)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                {game.emoji}
              </div>
              <h2 style={{
                color: '#fff',
                fontSize: '20px',
                marginBottom: '8px'
              }}>
                {game.title}
              </h2>
              <p style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: '14px',
                margin: 0
              }}>
                {game.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
