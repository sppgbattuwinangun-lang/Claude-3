/* =========================================================
   Effects — micro-interactions: ripple, counter, reveal, tilt
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const E = (NS.effects = {});

  // ---------- Ripple click effect ----------
  // Auto-attach to all buttons + elements with [data-ripple]
  E.installRipple = function () {
    document.addEventListener('pointerdown', function (ev) {
      const el = ev.target.closest('button, .nav-item, .kpi, .item-card, [data-ripple]');
      if (!el) return;
      // Skip pure ghost icons that already have their own treatment? No, allow all.
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      // Make sure host is positioned + clipped
      const cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      el.style.overflow = el.style.overflow || 'hidden';

      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText =
        'left:' + (ev.clientX - rect.left) + 'px;' +
        'top:' + (ev.clientY - rect.top) + 'px;' +
        'width:' + size + 'px;' +
        'height:' + size + 'px;';

      // Tone the ripple based on element kind
      if (el.classList.contains('btn-primary') || el.classList.contains('btn-success') || el.classList.contains('btn-danger') || el.classList.contains('btn-warn')) {
        ripple.style.background = 'rgba(255,255,255,.45)';
      } else {
        ripple.style.background = 'rgba(168, 139, 250, .35)';
      }
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }, { passive: true });
  };

  // ---------- Animated counter ----------
  // Animates a numeric value into el.textContent.
  // opts: { duration, decimals, suffix, prefix, easing }
  E.countTo = function (el, target, opts) {
    if (!el) return;
    opts = opts || {};
    const duration = opts.duration ?? 900;
    const decimals = opts.decimals ?? 0;
    const suffix   = opts.suffix   ?? '';
    const prefix   = opts.prefix   ?? '';
    const formatter = opts.formatter || ((v) => {
      try { return Number(v).toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
      catch (e) { return String(v); }
    });

    // Cancel previous animation on this element
    if (el.__countAnim) cancelAnimationFrame(el.__countAnim);

    const fromAttr = parseFloat(el.dataset.value);
    const from = isNaN(fromAttr) ? 0 : fromAttr;
    const to = Number(target) || 0;
    if (from === to) { el.textContent = prefix + formatter(to) + suffix; el.dataset.value = String(to); return; }
    const startT = performance.now();

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function step(now) {
      const t = Math.min(1, (now - startT) / duration);
      const v = from + (to - from) * easeOutCubic(t);
      el.textContent = prefix + formatter(v) + suffix;
      if (t < 1) {
        el.__countAnim = requestAnimationFrame(step);
      } else {
        el.__countAnim = null;
        el.dataset.value = String(to);
        el.textContent = prefix + formatter(to) + suffix;
      }
    }
    el.__countAnim = requestAnimationFrame(step);
  };

  // ---------- Reveal on scroll ----------
  // Add class .revealed when element enters viewport.
  // PHILOSOPHY: elements are visible by default. We only ANIMATE
  // them in by quickly fading; failure to observe = still visible.
  E.installReveal = function () {
    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      // Browser tidak support — biarkan terlihat (default).
      return;
    }

    // Tambah CSS sekali saja
    if (!document.getElementById('reveal-style')) {
      const s = document.createElement('style');
      s.id = 'reveal-style';
      s.textContent = `
        [data-reveal][data-anim="0"] { opacity: 0; transform: translateY(14px); }
        [data-reveal][data-anim="1"] {
          opacity: 1; transform: translateY(0);
          transition: opacity .55s cubic-bezier(.4,0,.2,1), transform .55s cubic-bezier(.4,0,.2,1);
        }
      `;
      document.head.appendChild(s);
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.setAttribute('data-anim', '1');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -20px 0px', threshold: 0.01 });

    targets.forEach(el => {
      el.setAttribute('data-anim', '0');
      io.observe(el);
    });

    // FAILSAFE: setelah 700ms, paksa semua jadi visible.
    setTimeout(() => {
      targets.forEach(el => el.setAttribute('data-anim', '1'));
    }, 700);
  };

  // ---------- Card tilt ----------
  // Subtle 3D tilt on hover for elements with [data-tilt].
  E.installTilt = function () {
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      el.style.transformStyle = 'preserve-3d';
      el.addEventListener('pointermove', (ev) => {
        const r = el.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width;
        const y = (ev.clientY - r.top) / r.height;
        const rx = (0.5 - y) * 6; // tilt up to 6deg
        const ry = (x - 0.5) * 6;
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
      });
    });
  };

  // ---------- Pop animation when text changes ----------
  E.pop = function (el) {
    if (!el) return;
    el.classList.remove('num-pop');
    // force reflow
    void el.offsetWidth;
    el.classList.add('num-pop');
  };

  // ---------- Particle wave on click (extra realistic feedback) ----------
  // Emits a soft expanding ring at click location for any [data-wave] element.
  E.installWave = function () {
    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-wave]');
      if (!el) return;
      const ring = document.createElement('span');
      ring.style.cssText = `
        position: fixed; left: ${ev.clientX}px; top: ${ev.clientY}px;
        width: 8px; height: 8px; border-radius: 50%;
        pointer-events: none; z-index: 9999;
        border: 2px solid rgba(168, 139, 250, .9);
        transform: translate(-50%, -50%) scale(1);
        animation: wave-ring .7s cubic-bezier(.4,0,.2,1) forwards;
      `;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 720);
    });
    if (!document.getElementById('wave-style')) {
      const s = document.createElement('style');
      s.id = 'wave-style';
      s.textContent = `
        @keyframes wave-ring {
          0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(20); opacity: 0; border-width: 1px; }
        }
      `;
      document.head.appendChild(s);
    }
  };

  // ---------- Helper to update KPI value with anim ----------
  E.setKpi = function (id, value, opts) {
    const el = document.getElementById(id);
    if (!el) return;
    E.countTo(el, value, opts);
  };

  // ---------- Auto install on DOM ready ----------
  function init() {
    E.installRipple();
    E.installWave();
    E.installReveal();
    E.installTilt();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
