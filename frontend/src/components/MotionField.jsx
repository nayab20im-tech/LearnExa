import { useRef } from 'react';
import '../styles/MotionField.css';

const dots = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  x: (index * 37 + 11) % 100,
  y: (index * 53 + 7) % 100,
  delay: -((index % 8) * 0.55),
  duration: 7 + (index % 6)
}));

const MotionField = ({ className = '', variant = 'light' }) => {
  const ref = useRef(null);

  const handlePointerMove = (event) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;
    ref.current.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`);
    ref.current.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`);
  };

  return (
    <div
      ref={ref}
      className={`motion-field motion-field-${variant} ${className}`.trim()}
      onPointerMove={handlePointerMove}
      aria-hidden="true"
    >
      <div className="motion-pointer-glow" />
      <div className="motion-grid" />
      <div className="motion-aurora motion-aurora-a" />
      <div className="motion-aurora motion-aurora-b" />
      <div className="motion-orbit motion-orbit-a" />
      <div className="motion-orbit motion-orbit-b" />
      <div className="motion-stars">
        {dots.map((dot) => (
          <i
            key={dot.id}
            style={{
              '--dot-x': `${dot.x}%`,
              '--dot-y': `${dot.y}%`,
              '--dot-delay': `${dot.delay}s`,
              '--dot-duration': `${dot.duration}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default MotionField;
