import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard } from 'lucide-react';
import AuthButton from './AuthButton';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

const logoPath = 'https://i.ibb.co/C3ZhdXgS/cropped-Open-Muse-logo.png';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { isAdmin, isLoading, user } = useAuth();
  const [imageError, setImageError] = useState(false);
  const isMobile = useIsMobile();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    if (!isLoading) {
      setIsAuthenticated(!!user);
    }
  }, [user, isLoading]);
  
  const isActive = (path: string) => location.pathname === path;
  const isAuthPage = location.pathname === '/auth';
  
  const handleImageError = () => {
    console.error('Error loading logo image');
    setImageError(true);
  };
  
  return (
    <div className="w-full border-b border-olive/20">
      <nav className="w-full max-w-screen-2xl mx-auto px-3 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link to="/" className="mr-3 flex items-center hover:opacity-80 transition-opacity">
            <div
              className={cn(
                "flex-shrink-0",
                isMobile ? "min-w-[90px]" : "min-w-[110px]",
              )}
              style={{ maxHeight: '63px' }}
            >
              <img
                src={logoPath}
                alt="OpenMuse Logo"
                className="max-h-[66px] w-auto object-contain"
                onError={handleImageError}
              />
            </div>
          </Link>
          
          {!isAuthPage && isAdmin && (
            <div className="flex space-x-2 relative right-[10px] top-[2px]">
              <NavLink to="/admin" active={isActive('/admin')}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Admin
              </NavLink>
            </div>
          )}
          
          {/* Additional navigation links can be inserted here if needed */}
        </div>
        
        <AuthButton />
      </nav>
    </div>
  );
};

interface NavLinkProps {
  to: string;
  active: boolean;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, active, children }) => {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
        active 
          ? "bg-olive text-cream-light shadow-subtle" 
          : "bg-transparent hover:bg-cream text-foreground hover:text-olive"
      )}
    >
      {children}
    </Link>
  );
};

export { Navigation, NavLink };

export const Footer = () => {
  return (
    <div className="w-full border-t border-border">
      <footer className="w-full max-w-screen-2xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground flex flex-col items-center justify-center space-y-1">
        <div className="pt-1">
          Made with 🦾 by <a 
            href="https://banodoco.ai/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline hover:text-foreground transition-colors"
          >
            Banodoco
          </a>
        </div>
        <hr className="w-[12.5%] border-t-2 border-border/50" />
        <div className="flex items-center text-xs pb-1 social-links">
          <a 
            href="https://github.com/peteromallet/openmuse" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline hover:text-foreground transition-colors"
          >
            Code
          </a>
          <span className="mx-2">|</span>
          <a 
            href="#" 
            className="underline hover:text-foreground transition-colors"
          >
            Data
          </a>
        </div>
      </footer>
      {/* Plant animation overlay */}
      <PlantAnimation />
    </div>
  );
};

export default Navigation;

const PlantAnimation: React.FC = () => {
  // This component injects the provided plant-growing animation into the page.
  // The bulk of the logic is executed within the useEffect so it only runs on the client.
  useEffect(() => {
    // --- Canvas & DOM elements -------------------------------------------------
    const canvas = document.getElementById('plantCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const initialBud = document.getElementById('initialBud') as HTMLElement | null;
    const wateringContainer = document.querySelector('.watering-container') as HTMLElement | null;

    if (!initialBud || !wateringContainer) return;

    const dpr = window.devicePixelRatio || 1;

    // Ensure initial bud is visible
    initialBud.style.opacity = '1';

    // -------------------------------------------------------------------------
    //  Helper utilities
    // -------------------------------------------------------------------------
    function addSlowerTransition() {
      wateringContainer.style.transition =
        'transform 2.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 1s ease';
    }

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    resizeCanvas();

    let baseSize = {
      width: canvas.getBoundingClientRect().width,
      height: canvas.getBoundingClientRect().height,
    };

    window.addEventListener('resize', () => {
      resizeCanvas();
      if (!animationStarted) {
        baseSize = {
          width: canvas.getBoundingClientRect().width,
          height: canvas.getBoundingClientRect().height,
        };
      }
    });

    // -------------------------------------------------------------------------
    //  Branch & Seed classes (mostly verbatim from provided code)
    // -------------------------------------------------------------------------
    interface IBranch {
      startX: number;
      startY: number;
      length: number;
      angle: number;
      branchWidth: number;
      grown: number;
      speed: number;
      flowered: boolean;
      floweringProgress: number;
      flowerPosition: number;
      update: () => void;
      draw: () => void;
    }

    const branches: any[] = [];
    const seeds: any[] = [];
    let animationStarted = false;
    let treeCount = 0;
    const MAX_TREES = 100;

    class Branch implements IBranch {
      public child1?: Branch;
      public child2?: Branch;
      private flowerColors = [
        '#e04f5f',
        '#ffc800',
        '#24b1b0',
        '#ba68c8',
        '#4caf50',
        '#ff9800',
        '#009688',
      ];
      private flowerColor: string;

      constructor(
        public startX: number,
        public startY: number,
        public length: number,
        public angle: number,
        public branchWidth: number,
        flowerColorIndex: number,
      ) {
        this.grown = 0;
        this.speed = Math.random() * 0.5 + 0.5;
        this.flowered = false;
        this.floweringProgress = 0;
        this.flowerPosition = Math.random() * 0.5 + 0.25;
        this.flowerColor =
          this.flowerColors[flowerColorIndex % this.flowerColors.length];
      }

      grown: number;
      speed: number;
      flowered: boolean;
      floweringProgress: number;
      flowerPosition: number;

      update() {
        if (this.grown < this.length) {
          this.grown += this.speed;

          if (this.grown > this.length * 0.3 && !this.child1) {
            const branchingAngle =
              (Math.random() * 40 + 10) * (this.angle < 180 ? 1 : -1);
            const branchLength = this.length * (Math.random() * 0.6 + 0.3);
            const startX =
              this.startX + Math.sin((this.angle * Math.PI) / 180) * -this.grown;
            const startY =
              this.startY + Math.cos((this.angle * Math.PI) / 180) * -this.grown;
            this.child1 = new Branch(
              startX,
              startY,
              branchLength,
              this.angle + branchingAngle,
              this.branchWidth * 0.7,
              Math.floor(Math.random() * 7),
            );
            branches.push(this.child1);
          }

          if (this.grown > this.length * 0.6 && !this.child2) {
            const branchingAngle =
              (Math.random() * 40 + 10) * (this.angle < 180 ? -1 : 1);
            const branchLength = this.length * (Math.random() * 0.6 + 0.3);
            const startX =
              this.startX + Math.sin((this.angle * Math.PI) / 180) * -this.grown;
            const startY =
              this.startY + Math.cos((this.angle * Math.PI) / 180) * -this.grown;
            this.child2 = new Branch(
              startX,
              startY,
              branchLength,
              this.angle - branchingAngle,
              this.branchWidth * 0.7,
              Math.floor(Math.random() * 7),
            );
            branches.push(this.child2);
          }
        } else if (!this.flowered) {
          this.flowered = true;
          this.startFlowering();
        }
        this.draw();
      }

      startFlowering() {
        if (this.floweringProgress < 1) {
          this.floweringProgress += 0.01;
          setTimeout(() => this.startFlowering(), 100);
        } else {
          setTimeout(() => {
            const seedX =
              this.startX +
              Math.sin((this.angle * Math.PI) / 180) *
                -this.length * this.flowerPosition;
            const seedY =
              this.startY +
              Math.cos((this.angle * Math.PI) / 180) *
                -this.length * this.flowerPosition;
            seeds.push(new Seed(seedX, seedY));
          }, 1000 + Math.random() * 5000);
        }
      }

      draw() {
        ctx.lineWidth = this.branchWidth;
        ctx.strokeStyle = '#8fb996';
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(
          this.startX + Math.sin((this.angle * Math.PI) / 180) * -this.grown,
          this.startY + Math.cos((this.angle * Math.PI) / 180) * -this.grown,
        );
        ctx.stroke();

        if (this.floweringProgress > 0) {
          const flowerX =
            this.startX +
            Math.sin((this.angle * Math.PI) / 180) *
              -this.length * this.flowerPosition;
          const flowerY =
            this.startY +
            Math.cos((this.angle * Math.PI) / 180) *
              -this.length * this.flowerPosition;

          ctx.fillStyle = this.flowerColor;
          ctx.beginPath();
          let flowerSize;
          if (this.floweringProgress < 0.33) {
            flowerSize = 1.5 + 1.5 * (this.floweringProgress / 0.33);
          } else if (this.floweringProgress < 0.66) {
            flowerSize =
              3 + 1.5 * ((this.floweringProgress - 0.33) / 0.33);
          } else {
            flowerSize =
              4.5 + 1.5 * ((this.floweringProgress - 0.66) / 0.34);
          }
          ctx.arc(flowerX, flowerY, flowerSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    class Seed {
      planted: boolean = false;
      hasCheckedGrowth: boolean = false;
      vx: number;
      speed: number;
      constructor(public x: number, public y: number) {
        this.vx = Math.random() * 2 - 1;
        this.speed = Math.random() * 1 + 0.5;
      }

      update() {
        if (this.y < canvas.getBoundingClientRect().height) {
          this.x += this.vx;
          this.y += this.speed;
        } else if (!this.planted && !this.hasCheckedGrowth) {
          this.hasCheckedGrowth = true;
          if (Math.random() < 0.02 && treeCount < MAX_TREES) {
            const branchStartX = this.x;
            const branchStartY = canvas.getBoundingClientRect().height;
            const branchLength = canvas.getBoundingClientRect().height / 6;
            branches.push(new Branch(branchStartX, branchStartY, branchLength, 0, 8, 5));
            treeCount++;
          }
          this.planted = true;
        }
        this.draw();
      }

      draw() {
        ctx.fillStyle = '#c9a07a';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // -------------------------------------------------------------------------
    //  Animation logic
    // -------------------------------------------------------------------------
    let frameId: number;
    const animate = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#fbf8ef';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      branches.forEach((b) => b.update());
      seeds.forEach((s) => s.update());
      frameId = requestAnimationFrame(animate);
    };

    // -------------------------------------------------------------------------
    //  Growth starter
    // -------------------------------------------------------------------------
    const startGrowth = (startX: number, startY: number) => {
      const offsetY = 5;
      const finalStartX = startX;
      const finalStartY = startY + offsetY;
      const cssCanvasHeight = canvas.height / dpr;
      const upBranchLength = cssCanvasHeight / 7.5;
      branches.push(new Branch(finalStartX, finalStartY, upBranchLength, 0, 10, 7));
      treeCount++;
      let rootBranchLength = cssCanvasHeight - finalStartY;
      if (rootBranchLength < 50) rootBranchLength = 50;
      const rootBranch = new Branch(finalStartX, finalStartY, rootBranchLength, 180, 10, 0);
      rootBranch.floweringProgress = -1;
      rootBranch.flowered = true;
      branches.push(rootBranch);
      animate();
    };

    // -------------------------------------------------------------------------
    //  Watering interaction
    // -------------------------------------------------------------------------
    const handleWatering = (event: Event) => {
      event.preventDefault();
      if (animationStarted) return;
      animationStarted = true;
      wateringContainer.classList.add('no-hover');
      addSlowerTransition();
      wateringContainer.classList.add('pouring');

      const budRect = initialBud.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const startX = budRect.left - canvasRect.left + budRect.width / 2;
      const startY = budRect.top - canvasRect.top + budRect.height / 2;

      const drops = document.querySelectorAll('.drop') as NodeListOf<HTMLElement>;
      drops.forEach((d) => (d.style.animationDuration = '0.7s'));

      setTimeout(() => {
        wateringContainer.classList.remove('pouring');
        const freshBudRect = initialBud.getBoundingClientRect();
        const freshStartX =
          freshBudRect.left - canvasRect.left + freshBudRect.width / 2;
        const freshStartY =
          freshBudRect.top - canvasRect.top + freshBudRect.height / 2;
        startGrowth(freshStartX, freshStartY);

        setTimeout(() => {
          wateringContainer.classList.add('fade-out');
          initialBud.style.transition = 'opacity 1.5s ease-in-out';
          initialBud.style.opacity = '0';

          setTimeout(() => {
            wateringContainer.style.display = 'none';
            initialBud.style.display = 'none';
            setTimeout(() => {
              const socialLinks = document.querySelector('.social-links') as HTMLElement | null;
              if (socialLinks) {
                socialLinks.style.transition = 'margin-bottom 1.5s ease-in-out';
                setTimeout(() => {
                  socialLinks.style.marginBottom = '0.45rem';
                }, 50);
              }
            }, 1000);
          }, 1000);
        }, 1000);
      }, 1500);
    };

    wateringContainer.addEventListener('click', handleWatering, { once: true });
    wateringContainer.addEventListener('touchend', handleWatering, { once: true });

    // -------------------------------------------------------------------------
    //  Cleanup
    // -------------------------------------------------------------------------
    return () => {
      wateringContainer.removeEventListener('click', handleWatering);
      wateringContainer.removeEventListener('touchend', handleWatering);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <>
      {/* Inline styles injected for the animation */}
      <style>{`
        #plantCanvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 0;
            pointer-events: none;
            background: transparent;
            transform: translate3d(0, 0, 0);
        }
        .watering-container {
            position: absolute;
            top: calc(100% + 0rem);
            left: calc(50% - 1.0rem);
            transform: translateX(calc(-50% + 10px));
            cursor: pointer;
            z-index: 1000;
            transform-origin: 80% 100%;
            transition: transform 2.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 1s ease;
            width: 50px;
            height: 50px;
        }
        .watering-container:hover { animation: shake 0.8s ease-in-out infinite; }
        .watering-container.no-hover:hover { animation: none; }
        @keyframes shake {
            0%, 100% { transform: translateX(calc(-50% + 10px)) rotate(0deg); }
            25%      { transform: translateX(calc(-50% + 10px)) rotate(-5deg); }
            75%      { transform: translateX(calc(-50% + 10px)) rotate(5deg); }
        }
        .watering-can { position: relative; width: 100%; height: 100%; }
        .can-body {
            position: absolute;
            width: 34px;
            height: 28px;
            background: #fbf8ef;
            border: 3px solid #888;
            border-radius: 3px;
            top: 10px;
            left: 8px;
            transform-origin: bottom right;
        }
        .spout {
            position: absolute;
            width: 18px;
            height: 6px;
            background: #fbf8ef;
            border: 3px solid #888;
            border-left: none;
            border-radius: 0 3px 3px 0;
            top: 16px;
            left: 42px;
        }
        .handle {
            position: absolute;
            width: 16px;
            height: 20px;
            border: 3px solid #888;
            border-left: none;
            border-radius: 0 15px 15px 0;
            top: 8px;
            left: -13px;
        }
        .water-drops {
            position: absolute;
            left: 20px;
            top: 8px;
            width: 10px;
            height: 10px;
            opacity: 0;
            transform: rotate(-30deg) translate(-5px, -5px);
            transition: opacity 0.3s ease;
        }
        .drop {
            position: absolute;
            width: 3px;
            height: 8px;
            background: #6ac6ff;
            border-radius: 1.5px;
            opacity: 0;
            animation: drop 0.5s infinite linear;
        }
        .drop:nth-child(1) { animation-delay: 0s;   }
        .drop:nth-child(2) { animation-delay: 0.2s; }
        .drop:nth-child(3) { animation-delay: 0.4s; }
        @keyframes drop {
            0%   { left: 0;  top: 0;  opacity: 1; transform: scale(1)   rotate(-45deg); }
            100% { left: 20px; top: 8px; opacity: 0; transform: scale(0.8) rotate(-45deg); }
        }
        #initialBud {
            position: absolute;
            top: calc(100% + 2rem);
            left: calc(50% + 1.95rem);
            transform: translateX(calc(-50% - 2.5px));
            width: 12px;
            height: 12px;
            background-color: #8fb996;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(143, 185, 150, 0.5);
            z-index: 999;
        }
        #initialBud::after {
            content: '';
            position: absolute;
            top: -8px;
            left: 5px;
            width: 2px;
            height: 8px;
            background-color: #8fb996;
            transform: rotate(-15deg);
        }
        .watering-container.pouring {
            transform: translateX(-60%) rotate(30deg);
            animation: none;
        }
        .watering-container.pouring .water-drops {
            opacity: 1;
            transform: rotate(-30deg) translate(-2px, -2px);
        }
        .watering-container.fade-out { opacity: 0; }
      `}</style>

      {/* Canvas & interactive elements */}
      <canvas id="plantCanvas" />
      <div className="watering-container">
        <div className="watering-can">
          <div className="can-body" />
          <div className="spout" />
          <div className="handle" />
          <div className="water-drops">
            <div className="drop" />
            <div className="drop" />
            <div className="drop" />
          </div>
        </div>
      </div>
      <div id="initialBud" />
    </>
  );
};
