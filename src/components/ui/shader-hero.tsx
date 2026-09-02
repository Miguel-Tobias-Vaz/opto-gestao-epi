import { motion } from 'framer-motion';
import { MeshGradient } from '@paper-design/shaders-react';

export function ShaderHero() {
  return (
    <div className="shader-hero" aria-hidden="true">
      <div className="absolute inset-0 bg-[#04070b]" />

      <MeshGradient
        className="shader-canvas absolute inset-0 h-full w-full opacity-60"
        colors={['#02070d', '#0b1220', '#162333', '#e8b84a', '#ffffff']}
        speed={0.24}
      />

      <motion.div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(232,184,74,0.22), transparent 22%), radial-gradient(circle at 80% 30%, rgba(99,102,241,0.12), transparent 25%), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.08), transparent 35%)',
        }}
        animate={{ opacity: [0.32, 0.56, 0.32], scale: [1, 1.06, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
          maskImage: 'linear-gradient(to bottom, rgba(255,255,255,0.9), transparent 85%)',
        }}
        animate={{ backgroundPosition: ['0% 0%', '120% 120%'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        className="absolute inset-x-0 bottom-[-18%] h-[40%] opacity-30"
        style={{
          background: 'radial-gradient(circle at center, rgba(232,184,74,0.2), transparent 55%)',
          filter: 'blur(60px)',
        }}
        animate={{ y: [0, 18, 0], opacity: [0.22, 0.45, 0.22] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
