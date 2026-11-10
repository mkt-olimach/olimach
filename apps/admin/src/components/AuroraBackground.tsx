import { useEffect, useRef } from "react";

interface Ribbon {
  /** posicao vertical media (0 a 1 da altura) */
  y: number;
  /** espessura (fracao da altura) */
  thickness: number;
  /** amplitude principal e secundaria (fracao da altura) */
  amp: number;
  amp2: number;
  /** frequencias espaciais (ondas por largura) */
  freq: number;
  freq2: number;
  /** velocidades (rad/s) e fase inicial */
  speed: number;
  speed2: number;
  phase: number;
  /** cor RGB e opacidade de pico */
  rgb: [number, number, number];
  alpha: number;
}

/* Tons laranja da marca (#F28A1E, #D9730D) e um toque do amarelo de seguranca (#F5C400). */
const RIBBONS: Ribbon[] = [
  { y: 0.52, thickness: 0.2, amp: 0.1, amp2: 0.04, freq: 1.1, freq2: 2.3, speed: 0.22, speed2: 0.14, phase: 0, rgb: [242, 138, 30], alpha: 0.42 },
  { y: 0.62, thickness: 0.15, amp: 0.08, amp2: 0.05, freq: 1.6, freq2: 3.1, speed: -0.18, speed2: 0.2, phase: 2.1, rgb: [217, 115, 13], alpha: 0.3 },
  { y: 0.42, thickness: 0.12, amp: 0.07, amp2: 0.03, freq: 0.8, freq2: 2.7, speed: 0.15, speed2: -0.1, phase: 4.2, rgb: [245, 196, 0], alpha: 0.24 },
];

/**
 * Efeito de aurora em canvas 2D: faixas de gradiente que ondulam devagar.
 * O desfoque vem do CSS. Pausa com a aba oculta e fica estatico com "reduzir movimento".
 */
export function AuroraBackground({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Renderiza em meia resolucao: o desfoque esconde a diferenca e poupa CPU.
    const SCALE = 0.5;
    let width = 1;
    let height = 1;
    let raf = 0;
    let running = true;
    const startedAt = performance.now();

    function resize() {
      if (!canvas) return;
      width = Math.max(1, Math.round(canvas.clientWidth * SCALE));
      height = Math.max(1, Math.round(canvas.clientHeight * SCALE));
      canvas.width = width;
      canvas.height = height;
    }

    function draw(now: number) {
      if (!ctx) return;
      const t = reduced ? 0 : (now - startedAt) / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      for (const r of RIBBONS) {
        const [cr, cg, cb] = r.rgb;
        const step = Math.max(6, Math.round(width / 120));
        const edge = (x: number) => {
          const u = x / width;
          return (
            (r.y + r.amp * Math.sin(u * Math.PI * 2 * r.freq + t * r.speed + r.phase) + r.amp2 * Math.sin(u * Math.PI * 2 * r.freq2 + t * r.speed2)) *
            height
          );
        };
        const half = (r.thickness * height) / 2;
        ctx.beginPath();
        for (let x = 0; x <= width + step; x += step) ctx.lineTo(x, edge(x) - half);
        for (let x = width + step; x >= 0; x -= step) ctx.lineTo(x, edge(x) + half);
        ctx.closePath();
        // gradiente vertical por faixa: transparente nas bordas, cor no meio
        const mid = r.y * height;
        const g = ctx.createLinearGradient(0, mid - (r.amp + r.amp2 + r.thickness) * height, 0, mid + (r.amp + r.amp2 + r.thickness) * height);
        g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        g.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, ${r.alpha})`);
        g.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        ctx.fillStyle = g;
        ctx.fill();
      }
    }

    function frame(now: number) {
      raf = 0;
      if (!running) return;
      draw(now);
      if (!reduced) raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      running = !document.hidden;
      if (running && !raf && !reduced) raf = requestAnimationFrame(frame);
    }

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
