import { gsap } from 'gsap';

export class HomeMotion {
  constructor() {
    this.visible = false;
    this.sky = document.createElement('div');
    this.sky.className = 'home-sky-stars';
    this.sky.setAttribute('aria-hidden', 'true');
    for (const [index, colors] of [['gold', ['#fff39a', '#ffc43e', '#b87717']], ['purple', ['#f3bdff', '#cf79f0', '#a84cce']]]) {
      const star = document.createElement('div');
      star.className = `home-sky-star star-${index}`;
      star.innerHTML = `<svg viewBox="0 0 80 80" focusable="false"><defs><linearGradient id="home-star-${index}" x2=".6" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><path d="M36 8 Q40 1 45 9 L53 24 L70 27 Q79 29 72 37 L60 49 L62 67 Q63 77 54 72 L39 64 L23 73 Q15 77 17 66 L19 49 L6 36 Q0 29 10 27 L27 24 Z" fill="url(#home-star-${index})" stroke="${colors[2]}" stroke-width="3" stroke-linejoin="round"/><path d="M34 15 L40 8 L49 27 L67 31" fill="none" stroke="#fff8d8" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`;
      this.sky.append(star);
    }
    document.body.prepend(this.sky);
    this.resizeStars = () => {
      const width = this.sky.clientWidth, height = this.sky.clientHeight;
      const scale = Math.max(width / 1672, height / 941);
      const left = (width - 1672 * scale) * (width <= 620 ? 0.49 : 0.5);
      const top = (height - 941 * scale) / 2;
      [[654, 68, 66], [1100, 124, 80]].forEach(([x, y, size], index) => {
        Object.assign(this.sky.children[index].style, {
          left: `${left + (x - size / 2) * scale}px`, top: `${top + (y - size / 2) * scale}px`,
          width: `${size * scale}px`, height: `${size * scale}px`,
        });
      });
    };
    this.resizeObserver = new ResizeObserver(this.resizeStars);
    this.resizeObserver.observe(this.sky);
    const companion = document.createElement('div');
    companion.className = 'home-companion';
    companion.setAttribute('aria-hidden', 'true');
    const dino = document.createElement('span');
    dino.className = 'jump-dino';
    companion.append(dino);
    document.getElementById('welcome').prepend(companion);
    this.syncPlayback = () => {
      const quiet = document.hidden || document.activeElement?.matches('input, textarea') || document.querySelector('dialog[open]');
      if (quiet && this.intro && this.intro.progress() < 1) this.intro.progress(1);
      this.idle?.paused(Boolean(quiet));
      this.stars?.paused(Boolean(document.hidden || document.querySelector('dialog[open]')));
    };
    document.addEventListener('visibilitychange', this.syncPlayback);
    document.addEventListener('focusin', this.syncPlayback);
    document.addEventListener('focusout', () => queueMicrotask(this.syncPlayback));
  }

  setVisible(visible) {
    if (visible === this.visible) {
      if (visible) this.syncPlayback();
      return;
    }
    this.visible = visible;
    this.media?.revert();
    this.intro = this.idle = this.stars = null;
    if (!visible) return;
    this.media = gsap.matchMedia();
    this.media.add({ motion: '(prefers-reduced-motion: no-preference)', compact: '(max-width: 620px)' }, context => {
      if (!context.conditions.motion) return;
      this.resizeStars();
      this.stars = gsap.fromTo('.home-sky-star svg', { rotation: index => index ? 16 : -16 }, {
        rotation: index => index ? -16 : 16, duration: 1.05, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });
      const words = document.querySelectorAll('.home-logo > span');
      const dino = document.querySelector('.home-companion .jump-dino');
      const jump = context.conditions.compact ? 28 : 48;
      this.intro = gsap.timeline({ defaults: { ease: 'power2.out' } })
        .from(words, { y: -70, rotation: index => index ? 9 : -9, scale: 0.45, opacity: 0, stagger: 0.15, duration: 0.72, ease: 'back.out(2.4)' }, 0)
        .from('#welcome .entry-panel', { y: 36, opacity: 0, duration: 0.5, clearProps: 'transform,opacity' }, 0.25)
        .from('.home-companion', { y: 65, scale: 0.55, rotation: -18, opacity: 0, duration: 0.55, ease: 'back.out(2.5)' }, 0.35)
        .to(dino, { y: -jump, rotation: -12, scaleX: 0.8, scaleY: 1.2, duration: 0.28, ease: 'power2.out' }, 0.74)
        .to(dino, { y: 0, rotation: 6, scaleX: 1.25, scaleY: 0.72, duration: 0.22, ease: 'power2.in' })
        .to(dino, { y: -8, rotation: -3, scaleX: 0.94, scaleY: 1.06, duration: 0.15 })
        .to(dino, { y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.2 });
      this.idle = gsap.timeline({ repeat: -1, delay: 2.8, repeatDelay: 2.2 })
        .to(dino, { scaleX: 1.2, scaleY: 0.75, rotation: 6, duration: 0.18, ease: 'power2.in' })
        .to(dino, { y: -jump, x: -8, rotation: -14, scaleX: 0.82, scaleY: 1.18, duration: 0.32, ease: 'power2.out' })
        .to(dino, { y: 0, x: 0, rotation: 5, scaleX: 1.25, scaleY: 0.72, duration: 0.26, ease: 'power2.in' })
        .to(dino, { y: -9, rotation: -3, scaleX: 0.92, scaleY: 1.08, duration: 0.16 })
        .to(dino, { y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.22 })
        .to(words, { y: -5, rotation: index => index ? 2 : -2, scale: 1.035, stagger: 0.1, duration: 0.2, repeat: 1, yoyo: true, ease: 'sine.inOut' }, 0.5)
        .to('.home-logo b', { rotation: 18, scale: 1.22, duration: 0.15, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0.8);
      this.syncPlayback();
      return () => { this.intro = this.idle = this.stars = null; };
    });
  }
}
