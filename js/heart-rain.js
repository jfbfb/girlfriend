/**
 * 粉色爱心雨 — 两页共用背景装饰
 */
(function () {
  const container = document.querySelector('.heart-rain');
  if (!container) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const COUNT = 46;
  for (let i = 0; i < COUNT; i++) {
    const item = document.createElement('span');
    item.className = 'heart-rain-item';
    item.style.left = `${Math.random() * 100}%`;
    item.style.animationDuration = `${6.2 + Math.random() * 8.8}s`;
    item.style.animationDelay = `${-Math.random() * 18}s`;
    item.style.setProperty('--hr-size', `${11 + Math.random() * 18}px`);
    item.style.setProperty('--hr-opacity', `${0.42 + Math.random() * 0.42}`);
    item.style.setProperty('--hr-drift', `${-48 + Math.random() * 96}px`);
    container.appendChild(item);
  }
})();
