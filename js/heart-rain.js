/**
 * 粉色爱心雨 — 两页共用背景装饰
 */
(function () {
  const container = document.querySelector('.heart-rain');
  if (!container) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const COUNT = 32;
  for (let i = 0; i < COUNT; i++) {
    const item = document.createElement('span');
    item.className = 'heart-rain-item';
    item.style.left = `${Math.random() * 100}%`;
    item.style.animationDuration = `${9 + Math.random() * 16}s`;
    item.style.animationDelay = `${-Math.random() * 22}s`;
    item.style.setProperty('--hr-size', `${9 + Math.random() * 14}px`);
    item.style.setProperty('--hr-opacity', `${0.22 + Math.random() * 0.38}`);
    item.style.setProperty('--hr-drift', `${-25 + Math.random() * 50}px`);
    container.appendChild(item);
  }
})();
