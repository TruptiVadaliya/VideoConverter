import React, { useState, useRef } from 'react';

const trendingSongs = [
  {
    title: 'Sample Song 1',
    artist: 'Artist 1',
    image: '/jhol.jpg',
    audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    title: 'Sample Song 2',
    artist: 'Artist 2',
    image: '/sahiba.jpg',
    audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
];

export default function TrendingSongs({ onSelect = () => {} }) {
  const [selected, setSelected] = useState(null);
  const audioRef = useRef(null);

  const handlePlay = (song, idx) => {
    setSelected(idx);
    onSelect(song);

    if (audioRef.current) {
      audioRef.current.src = song.audio;
      audioRef.current.play().catch((err) => {
        console.warn('Playback failed:', err);
      });
    }
  };

  return (
    <div style={{ background: '#181818', color: 'white', padding: '32px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 32px' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, margin: 0 }}>
          Trending Songs
        </h2>
        <span style={{ color: '#b3b3b3', fontWeight: 500, cursor: 'pointer' }}>Show all</span>
      </div>

      <div style={{ display: 'flex', gap: 32, overflowX: 'auto', margin: '32px 0 0 32px', paddingBottom: 16 }}>
        {trendingSongs.map((song, idx) => (
          <div
            key={song.title}
            onClick={() => handlePlay(song, idx)}
            style={{
              minWidth: 220,
              background: selected === idx ? '#282828' : '#222',
              borderRadius: 16,
              boxShadow: selected === idx ? '0 0 0 2px #1db954' : 'none',
              cursor: 'pointer',
              padding: 16,
              transition: 'box-shadow 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <img
              src={song.image}
              alt={song.title}
              style={{
                width: 180,
                height: 180,
                objectFit: 'cover',
                borderRadius: 12,
                marginBottom: 16,
                background: '#444',
              }}
              onError={e => (e.target.src = '/file.svg')}
            />

            {selected === idx && (
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: '#1db954',
                  color: 'black',
                  padding: '2px 8px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Playing
              </span>
            )}

            <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 4 }}>{song.title}</div>
            <div style={{ color: '#b3b3b3', fontSize: 16 }}>{song.artist}</div>
          </div>
        ))}
      </div>

      {/* Hidden Audio Player */}
      <audio ref={audioRef} controls style={{ display: 'none' }} />
    </div>
  );
}
