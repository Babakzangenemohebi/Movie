'use client';

import React, { useEffect, useRef } from 'react';

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = 480);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = 480;
    };
    window.addEventListener('resize', handleResize);

    const orbs = [
      { x: width * 0.2, y: height * 0.3, r: 220, vx: 0.4, vy: 0.2, color: 'rgba(229, 169, 60, 0.16)' },
      { x: width * 0.75, y: height * 0.6, r: 260, vx: -0.35, vy: -0.25, color: 'rgba(190, 18, 60, 0.18)' },
      { x: width * 0.5, y: height * 0.4, r: 190, vx: 0.25, vy: -0.3, color: 'rgba(229, 169, 60, 0.10)' },
    ];

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      for (const orb of orbs) {
        orb.x += orb.vx;
        orb.y += orb.vy;

        if (orb.x < 0 || orb.x > width) orb.vx *= -1;
        if (orb.y < 0 || orb.y > height) orb.vy *= -1;

        const grad = ctx.createRadialGradient(orb.x, orb.y, 10, orb.x, orb.y, orb.r);
        grad.addColorStop(0, orb.color);
        grad.addColorStop(1, 'rgba(9, 9, 11, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
    />
  );
}
