import { useMemo } from 'react';

interface ParticleData {
  id: number;
  top: string;
  left: string;
  size: number;
  opacity: number;
  duration: string;
  delay: string;
}

export default function BackgroundParticles() {
  const particles = useMemo<ParticleData[]>(() => {
    const list: ParticleData[] = [];
    const count = 38;
    for (let i = 0; i < count; i++) {
      const top = `${((i * 17 + 23) % 94) + 3}%`;
      const left = `${((i * 31 + 11) % 96) + 2}%`;
      const size = i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1.5;
      const opacity = ((i % 5) + 2) / 10;
      const duration = `${3 + (i % 5) * 1.5}s`;
      const delay = `${(i % 7) * 0.7}s`;

      list.push({
        id: i,
        top,
        left,
        size,
        opacity,
        duration,
        delay,
      });
    }
    return list;
  }, []);

  return (
    <div className="particles-container" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            top: p.top,
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
