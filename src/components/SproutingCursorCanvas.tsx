import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

/**
 * SproutingCursorCanvas
 * ---------------------
 * Renders a full-screen canvas. Initially, it only supports triggered bursts.
 * After activation, it can also draw a sprouting branch/leaf trail that follows the
 * user's cursor.
 */

// Helper functions (can be outside the component)
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
    this.length = 15 + Math.random() * 45;
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
      ctx2d.lineWidth = 1.2 * (1 - u);
      ctx2d.strokeStyle = this.color;
      ctx2d.beginPath(); ctx2d.moveTo(p0.x, p0.y); ctx2d.lineTo(p1.x, p1.y); ctx2d.stroke();
    }
    const baseLeafScale = this.length / 60;
    this.leaves.forEach(({ u, side }) => {
      if (this.t > u) {
        const p = this.point(u); const t = this.tangent(u);
        const angleStem = Math.atan2(t.dy, t.dx);
        const grow = Math.min(1, (this.t - u) / (1 - u));
        const scale = grow * (0.5 + baseLeafScale);
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

export interface SproutingCanvasHandle {
  createBurst: (clientX: number, clientY: number) => void;
  activateCursorFollowing: () => void;
}

const SproutingCursorCanvas = forwardRef<SproutingCanvasHandle, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sproutsRef = useRef<Sprout[]>([]);
  const branchPointsRef = useRef<Point[]>([]);
  const mouseRef = useRef<{ x: number | null; y: number | null; prevX: number | null; prevY: number | null }>({ x: null, y: null, prevX: null, prevY: null });
  const isFollowingActiveRef = useRef<boolean>(false);

  const ZOOM_FACTOR = 0.8;
  const CURSOR_DOT_RADIUS = 2.2;
  const BRANCH_SPACING = 2; 
  const BRANCH_MAX_POINTS = 2000;
  const SPAWN_DISTANCE = 4;

  useImperativeHandle(ref, () => ({
    createBurst: (clientX: number, clientY: number) => {
      const x = clientX + window.scrollX;
      const y = clientY + window.scrollY;
      const burstCount = 18 + Math.floor(Math.random() * 9);
      for (let i = 0; i < burstCount; i++) {
        sproutsRef.current.push(new Sprout(x / ZOOM_FACTOR, y / ZOOM_FACTOR, '#8c5a2a'));
      }
    },
    activateCursorFollowing: () => {
      isFollowingActiveRef.current = true;
      // Initialize mouse position to prevent initial jump if cursor is already on page
      // This might be slightly off if called before first mousemove, but generally okay
      if (mouseRef.current.x === null && typeof window !== 'undefined') {
         // This is a bit of a guess for initial position if no mouse move has happened.
         // It might be better to let the first actual mousemove set this.
      }
    }
  }), [ZOOM_FACTOR]);

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

    const addBranchPointInternal = (x: number, y: number) => {
      if (!branchPointsRef.current.length) {
        branchPointsRef.current.push({ x, y });
        return;
      }
      const last = branchPointsRef.current[branchPointsRef.current.length - 1];
      if (Math.hypot(x - last.x, y - last.y) >= BRANCH_SPACING) {
        branchPointsRef.current.push({ x, y });
        if (branchPointsRef.current.length > BRANCH_MAX_POINTS) {
          branchPointsRef.current.shift();
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isFollowingActiveRef.current) {
        // Update mouse position even if not actively following, for the initial burst.
        // Or, rely on click event coords for burst and only update here if active.
        // For now, let's keep it simple: mouseRef updated when following.
        // mouseRef.current.x = e.clientX + window.scrollX;
        // mouseRef.current.y = e.clientY + window.scrollY;
        return;
      }

      const currentX = e.clientX + window.scrollX;
      const currentY = e.clientY + window.scrollY;

      addBranchPointInternal(currentX / ZOOM_FACTOR, currentY / ZOOM_FACTOR);
      
      const prevLogicX = mouseRef.current.x !== null ? mouseRef.current.x - window.scrollX : e.clientX;
      const prevLogicY = mouseRef.current.y !== null ? mouseRef.current.y - window.scrollY : e.clientY;

      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;
      mouseRef.current.x = currentX;
      mouseRef.current.y = currentY;

      if (mouseRef.current.prevX === null) return; // No previous point to compare for distance

      // Spawn decision based on actual screen pixel movement distance
      if (Math.hypot(e.clientX - prevLogicX, e.clientY - prevLogicY) > SPAWN_DISTANCE) {
        sproutsRef.current.push(new Sprout(currentX / ZOOM_FACTOR, currentY / ZOOM_FACTOR));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    let lastTime = performance.now();
    let animationFrameId: number;

    const drawBranchInternal = (ctx2d: CanvasRenderingContext2D) => {
      if (branchPointsRef.current.length < 2) return;
      ctx2d.strokeStyle = '#8c5a2a';
      ctx2d.lineWidth = 0.8; 
      ctx2d.lineCap = 'round';
      ctx2d.beginPath();
      ctx2d.moveTo(branchPointsRef.current[0].x, branchPointsRef.current[0].y);
      for (let i = 1; i < branchPointsRef.current.length; i++) {
        ctx2d.lineTo(branchPointsRef.current[i].x, branchPointsRef.current[i].y);
      }
      ctx2d.stroke();
    };

    const animate = () => {
      const now = performance.now(); const dt = now - lastTime; lastTime = now;
      const currentLogicalWidth = parseFloat(canvas.style.width || '0');
      const currentLogicalHeight = parseFloat(canvas.style.height || '0');
      
      ctx.clearRect(0, 0, currentLogicalWidth, currentLogicalHeight);
      ctx.save();
      ctx.scale(ZOOM_FACTOR, ZOOM_FACTOR);

      if (isFollowingActiveRef.current) {
        drawBranchInternal(ctx);
        if (mouseRef.current.x !== null && mouseRef.current.y !== null) {
          ctx.fillStyle = '#185a28';
          ctx.beginPath();
          ctx.arc(mouseRef.current.x / ZOOM_FACTOR, mouseRef.current.y / ZOOM_FACTOR, CURSOR_DOT_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      for (const s of sproutsRef.current) { s.update(dt); s.draw(ctx); }
      
      ctx.restore();
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [ZOOM_FACTOR]); // ZOOM_FACTOR is a stable dependency

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 0,
        filter: 'opacity(0.7)',
      }}
    />
  );
});

export default SproutingCursorCanvas; 