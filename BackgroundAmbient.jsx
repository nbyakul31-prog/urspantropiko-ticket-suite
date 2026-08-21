import React from 'react';

export default function BackgroundAmbient() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 0,
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0) 70%)',
        top: '-10%',
        left: '20%',
        filter: 'blur(60px)',
        animation: 'pulseGlow 10s infinite alternate ease-in-out'
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 70%)',
        bottom: '10%',
        right: '15%',
        filter: 'blur(70px)',
        animation: 'pulseGlow 14s infinite alternate-reverse ease-in-out'
      }} />
    </div>
  );
}
