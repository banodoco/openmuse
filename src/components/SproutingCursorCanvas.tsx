import { useEffect, useRef } from 'react';

/**
 * SproutingCursorCanvas
 * ---------------------
 * Renders a full-screen canvas that draws a sprouting branch/leaf trail that follows the
 * user's cursor (and bursts on click). The canvas is positioned absolutely to scroll
 * with the page content and resizes dynamically with content changes.
 * The effect is scaled down and a CSS filter is applied for appearance.
 */
const SproutingCursorCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ZOOM_FACTOR = 0.8;
  const CURSOR_DOT_RADIUS = 2.2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const newWidth = document.documentElement.scrollWidth;
      const newHeight = document.documentElement.scrollHeight;
      canvas.width = newWidth * dpr;
      canvas.height = newHeight * dpr;
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    observer.observe(document.documentElement);

    const pointOnCubic = (
      p0: number, p1: number, p2: number, p3: number, t: number
    ) => {
      const i = 1 - t;
      return i * i * i * p0 + 3 * i * i * t * p1 + 3 * i * t * t * p2 + t * t * t * p3;
    };

    const tangentOnCubic = (
      p0: number, p1: number, p2: number, p3: number, t: number
    ) => {
      const i = 1 - t;
      return 3 * i * i * (p1 - p0) + 6 * i * t * (p2 - p1) + 3 * t * t * (p3 - p2);
    };

    class Sprout {
      x0: number; y0: number; color: string;
      length: number;
      cx1: number; cy1: number; cx2: number; cy2: number; x3: number; y3: number;
      elapsed = 0; duration: number; t = 0;
      leaves: { u: number; side: 1 | -1 }[];

      constructor(x0: number, y0: number, color = '#2d7d3d') {
        this.x0 = x0; this.y0 = y0; this.color = color;
        this.length = 15 + Math.random() * 45; // Base length, will be visually scaled by context
        const angle = Math.random() * Math.PI * 2;
        const curl1 = Math.random() * 0.8 - 0.4;
        const curl2 = Math.random() * 0.8 - 0.4;
        this.cx1 = x0 + Math.cos(angle) * this.length * 0.4;
        this.cy1 = y0 + Math.sin(angle) * this.length * 0.4;
        this.cx2 = x0 + Math.cos(angle + curl1) * this.length * 0.9;
        this.cy2 = y0 + Math.sin(angle + curl1) * this.length * 0.9;
        this.x3 = x0 + Math.cos(angle + curl1 + curl2) * this.length * 1.3;
        this.y3 = y0 + Math.sin(angle + curl1 + curl2) * this.length * 1.3;
        this.duration = 600 + Math.random() * 600;
        const maxLeaves = Math.max(1, Math.floor(this.length / 25));
        const leafTotal = Math.floor(Math.random() * (maxLeaves + 1)) + 1;
        this.leaves = Array.from({ length: leafTotal }, () => ({
          u: 0.3 + Math.random() * 0.55,
          side: (Math.random() < 0.5 ? 1 : -1) as 1 | -1,
        })).sort((a, b) => a.u - b.u);
      }

      point(u: number) {
        return {
          x: pointOnCubic(this.x0, this.cx1, this.cx2, this.x3, u),
          y: pointOnCubic(this.y0, this.cy1, this.cy2, this.y3, u),
        };
      }

      tangent(u: number) {
        return {
          dx: tangentOnCubic(this.x0, this.cx1, this.cx2, this.x3, u),
          dy: tangentOnCubic(this.y0, this.cy1, this.cy2, this.y3, u),
        };
      }

      update(dt: number) { this.elapsed += dt; this.t = Math.min(this.elapsed / this.duration, 1); }

      draw(ctx2d: CanvasRenderingContext2D) {
        const step = 0.02;
        for (let u = 0; u < this.t; u += step) {
          const p0 = this.point(u); const p1 = this.point(Math.min(u + step, this.t));
          ctx2d.lineWidth = 1.2 * (1 - u); // Base width, visually scaled by context
          ctx2d.strokeStyle = this.color;
          ctx2d.beginPath(); ctx2d.moveTo(p0.x, p0.y); ctx2d.lineTo(p1.x, p1.y); ctx2d.stroke();
        }
        const baseLeafScale = this.length / 60;
        this.leaves.forEach(({ u, side }) => {
          if (this.t > u) {
            const p = this.point(u); const t = this.tangent(u);
            const angleStem = Math.atan2(t.dy, t.dx);
            const grow = Math.min(1, (this.t - u) / (1 - u));
            const scale = grow * (0.5 + baseLeafScale); // Base scale, visually scaled by context
            ctx2d.save(); ctx2d.translate(p.x, p.y);
            ctx2d.rotate(angleStem + side * Math.PI / 2); ctx2d.scale(scale, scale);
            ctx2d.fillStyle = '#3cab4c'; ctx2d.beginPath();
            ctx2d.moveTo(0, 0); ctx2d.quadraticCurveTo(6, -4, 12, 0);
            ctx2d.quadraticCurveTo(6, 4, 0, 0); ctx2d.fill(); ctx2d.restore();
          }
        });
      }
    }

    type Point = { x: number; y: number };
    const branchPoints: Point[] = [];
    const BRANCH_SPACING = 2; // Base spacing, mouse coords are scaled for effective spacing
    const BRANCH_MAX_POINTS = 2000;

    const addBranchPoint = (x: number, y: number) => {
      if (!branchPoints.length) { branchPoints.push({ x, y }); return; }
      const last = branchPoints[branchPoints.length - 1];
      if (Math.hypot(x - last.x, y - last.y) >= BRANCH_SPACING) {
        branchPoints.push({ x, y });
        if (branchPoints.length > BRANCH_MAX_POINTS) branchPoints.shift();
      }
    };

    const drawBranch = (ctx2d: CanvasRenderingContext2D) => {
      if (branchPoints.length < 2) return;
      ctx2d.strokeStyle = '#8c5a2a'; 
      ctx2d.lineWidth = 0.8; // Base width, visually scaled by context
      ctx2d.lineCap = 'round';
      ctx2d.beginPath(); ctx2d.moveTo(branchPoints[0].x, branchPoints[0].y);
      for (let i = 1; i < branchPoints.length; i++) { ctx2d.lineTo(branchPoints[i].x, branchPoints[i].y); }
      ctx2d.stroke();
    };

    const sprouts: Sprout[] = [];
    const mouse = { x: null as number | null, y: null as number | null, prevX: null as number | null, prevY: null as number | null };
    const SPAWN_DISTANCE = 4; // Base distance, mouse coords are scaled for effective distance

    const handleMove = (e: MouseEvent) => {
      const x = e.clientX + window.scrollX;
      const y = e.clientY + window.scrollY;
      // Points are stored in document space. They will be scaled by context transform during draw.
      addBranchPoint(x / ZOOM_FACTOR, y / ZOOM_FACTOR); 
      mouse.prevX = mouse.x; mouse.prevY = mouse.y;
      mouse.x = x; mouse.y = y; // Store actual mouse position for cursor dot
      if (mouse.prevX === null) return;
      // Spawn decision based on actual mouse movement distance
      if (Math.hypot(e.clientX - (mouse.prevX - window.scrollX), e.clientY - (mouse.prevY - window.scrollY)) > SPAWN_DISTANCE) {
         // Sprouts created with document space coords. They will be scaled by context transform.
        sprouts.push(new Sprout(x / ZOOM_FACTOR, y / ZOOM_FACTOR));
      }
    };

    const handleClick = (e: MouseEvent) => {
      const x = e.clientX + window.scrollX;
      const y = e.clientY + window.scrollY;
      const burstCount = 18 + Math.floor(Math.random() * 9);
      for (let i = 0; i < burstCount; i++) {
        // Sprouts created with document space coords. They will be scaled by context transform.
        sprouts.push(new Sprout(x / ZOOM_FACTOR, y / ZOOM_FACTOR, '#8c5a2a'));
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('click', handleClick);

    let lastTime = performance.now();
    let animationFrameId: number;

    const animate = () => {
      const now = performance.now(); const dt = now - lastTime; lastTime = now;
      const currentLogicalWidth = parseFloat(canvas.style.width || '0');
      const currentLogicalHeight = parseFloat(canvas.style.height || '0');
      
      ctx.clearRect(0, 0, currentLogicalWidth, currentLogicalHeight);
      
      ctx.save();
      ctx.scale(ZOOM_FACTOR, ZOOM_FACTOR); // Apply zoom for all drawings

      drawBranch(ctx);
      for (const s of sprouts) { s.update(dt); s.draw(ctx); }
      
      // Draw cursor dot - its coordinates must be scaled correctly to appear under the actual mouse
      if (mouse.x !== null && mouse.y !== null) {
        ctx.fillStyle = '#185a28'; 
        ctx.beginPath();
        // mouse.x and mouse.y are true document positions.
        // To draw at this true position when context is scaled, divide by ZOOM_FACTOR.
        // The radius will be scaled by ZOOM_FACTOR automatically due to context scale.
        ctx.arc(mouse.x / ZOOM_FACTOR, mouse.y / ZOOM_FACTOR, CURSOR_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore(); // Restore context (removes scaling)
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 0,
        filter: 'opacity(0.7)', // Added CSS filter
      }}
    />
  );
};

export default SproutingCursorCanvas; 