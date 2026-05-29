/**
 * 手机端虚拟键盘 — 映射主视觉页全部玩法按键
 */
(function (global) {
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const DIGITS = '0123456789'.split('');
  const ARROWS = [
    { code: 'ArrowUp', label: '↑', cls: 'vk-arrow-up' },
    { code: 'ArrowLeft', label: '←', cls: 'vk-arrow-left' },
    { code: 'ArrowDown', label: '↓', cls: 'vk-arrow-down' },
    { code: 'ArrowRight', label: '→', cls: 'vk-arrow-right' },
  ];

  let root = null;
  let shiftOn = false;
  let expanded = true;
  let activePanel = 'letters';
  const heldCodes = new Set();

  function input() {
    return global.GalleryInput;
  }

  function shouldShow() {
    return global.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  }

  function syncShiftUI() {
    if (!root) return;
    const btn = root.querySelector('[data-vk-shift]');
    const on = input() ? input().isShiftActive() : shiftOn;
    shiftOn = on;
    if (btn) {
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function press(code, key) {
    if (heldCodes.has(code)) return;
    heldCodes.add(code);
    input()?.keyDown(code, key);
    root?.querySelector(`[data-code="${code}"]`)?.classList.add('is-held');
  }

  function release(code, key) {
    if (!heldCodes.has(code)) return;
    heldCodes.delete(code);
    input()?.keyUp(code, key);
    root?.querySelector(`[data-code="${code}"]`)?.classList.remove('is-held');
  }

  function releaseAllHeld() {
    Array.from(heldCodes).forEach((code) => {
      const el = root?.querySelector(`[data-code="${code}"]`);
      const key = el?.dataset.key || code;
      release(code, key);
    });
  }

  function bindHoldKey(el) {
    const code = el.dataset.code;
    const key = el.dataset.key || code;

    const onDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.RomanceAudio) window.RomanceAudio.unlock();
      el.setPointerCapture(e.pointerId);
      press(code, key);
    };

    const onUp = (e) => {
      e.preventDefault();
      e.stopPropagation();
      release(code, key);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function setPanel(name) {
    activePanel = name;
    if (!root) return;
    root.querySelectorAll('[data-vk-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.vkPanel !== name;
    });
    root.querySelectorAll('[data-vk-tab]').forEach((tab) => {
      const on = tab.dataset.vkTab === name;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function setExpanded(on) {
    expanded = on;
    if (!root) return;
    root.classList.toggle('is-collapsed', !on);
    const toggle = root.querySelector('[data-vk-toggle]');
    if (toggle) {
      toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
      toggle.textContent = on ? '收起 ⌄' : '展开键盘 ⌃';
    }
    global.document.body.classList.toggle('vk-open', on && shouldShow());
    updateBodyInset();
  }

  function updateBodyInset() {
    if (!root || !shouldShow()) {
      global.document.body.style.removeProperty('--vk-height');
      return;
    }
    const h = expanded ? root.offsetHeight : root.querySelector('.vk-handle')?.offsetHeight || 44;
    global.document.body.style.setProperty('--vk-height', `${h}px`);
  }

  function buildKeyboard() {
    const wrap = global.document.createElement('div');
    wrap.className = 'virtual-keyboard';
    wrap.id = 'virtualKeyboard';
    wrap.setAttribute('role', 'toolbar');
    wrap.setAttribute('aria-label', '玩法虚拟键盘');

    wrap.innerHTML = `
      <div class="vk-handle">
        <span class="vk-handle-title">温柔操控</span>
        <button type="button" class="vk-toggle" data-vk-toggle aria-expanded="true">收起 ⌄</button>
      </div>
      <div class="vk-body">
        <div class="vk-quick-row">
          <button type="button" class="vk-key vk-key-heart" data-code="Space" data-key=" " aria-label="爱心">♥</button>
          <button type="button" class="vk-key vk-key-burst" data-vk-burst aria-label="形状炸裂">✦</button>
          <button type="button" class="vk-key vk-key-shift" data-vk-shift aria-pressed="false" aria-label="高规整 Shift">⇧</button>
        </div>
        <div class="vk-tabs" role="tablist">
          <button type="button" class="vk-tab is-active" data-vk-tab="letters" role="tab" aria-selected="true">A-Z</button>
          <button type="button" class="vk-tab" data-vk-tab="digits" role="tab" aria-selected="false">0-9</button>
          <button type="button" class="vk-tab" data-vk-tab="wind" role="tab" aria-selected="false">风向</button>
        </div>
        <div class="vk-panels">
          <div class="vk-panel" data-vk-panel="letters" role="tabpanel">
            <div class="vk-alpha-grid" data-vk-alpha></div>
          </div>
          <div class="vk-panel" data-vk-panel="digits" role="tabpanel" hidden>
            <div class="vk-digit-grid" data-vk-digit></div>
          </div>
          <div class="vk-panel" data-vk-panel="wind" role="tabpanel" hidden>
            <div class="vk-arrow-pad" data-vk-arrows></div>
          </div>
        </div>
        <p class="vk-hint">按住字母/数字/爱心/方向键生效，松手恢复 · ⇧ 点按切换工整模式</p>
      </div>
    `;

    const alphaGrid = wrap.querySelector('[data-vk-alpha]');
    LETTERS.forEach((ch) => {
      const btn = global.document.createElement('button');
      btn.type = 'button';
      btn.className = 'vk-key vk-key-alpha';
      btn.dataset.code = `Key${ch}`;
      btn.dataset.key = ch;
      btn.textContent = ch;
      btn.setAttribute('aria-label', `字母 ${ch}`);
      bindHoldKey(btn);
      alphaGrid.appendChild(btn);
    });

    const digitGrid = wrap.querySelector('[data-vk-digit]');
    DIGITS.forEach((ch) => {
      const btn = global.document.createElement('button');
      btn.type = 'button';
      btn.className = 'vk-key vk-key-digit';
      btn.dataset.code = `Digit${ch}`;
      btn.dataset.key = ch;
      btn.textContent = ch;
      btn.setAttribute('aria-label', `数字 ${ch}`);
      bindHoldKey(btn);
      digitGrid.appendChild(btn);
    });

    const arrowPad = wrap.querySelector('[data-vk-arrows]');
    ARROWS.forEach(({ code, label, cls }) => {
      const btn = global.document.createElement('button');
      btn.type = 'button';
      btn.className = `vk-key vk-key-arrow ${cls}`;
      btn.dataset.code = code;
      btn.dataset.key = label;
      btn.textContent = label;
      btn.setAttribute('aria-label', `方向 ${label}`);
      bindHoldKey(btn);
      arrowPad.appendChild(btn);
    });

    bindHoldKey(wrap.querySelector('[data-code="Space"]'));

    wrap.querySelector('[data-vk-shift]').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.RomanceAudio) {
        window.RomanceAudio.unlock();
        window.RomanceAudio.playUiClick();
      }
      if (shiftOn) {
        input()?.keyUp('ShiftLeft', 'Shift');
        shiftOn = false;
      } else {
        input()?.keyDown('ShiftLeft', 'Shift');
        shiftOn = true;
      }
      syncShiftUI();
    });

    wrap.querySelector('[data-vk-burst]').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.RomanceAudio) {
        window.RomanceAudio.unlock();
        window.RomanceAudio.playUiClick();
      }
      input()?.burstFormation();
    });

    wrap.querySelector('[data-vk-toggle]').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setExpanded(!expanded);
      if (window.RomanceAudio) window.RomanceAudio.playUiClick();
    });

    wrap.querySelectorAll('[data-vk-tab]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setPanel(tab.dataset.vkTab);
        if (window.RomanceAudio) window.RomanceAudio.playUiClick();
      });
    });

    wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
    wrap.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

    global.document.body.appendChild(wrap);
    return wrap;
  }

  function refreshVisibility() {
    if (!root) return;
    const show = shouldShow();
    root.hidden = !show;
    global.document.body.classList.toggle('has-virtual-keyboard', show);
    if (!show) {
      releaseAllHeld();
      global.document.body.classList.remove('vk-open');
      global.document.body.style.removeProperty('--vk-height');
      return;
    }
    setExpanded(expanded);
    syncShiftUI();
  }

  const VirtualKeyboard = {
    init() {
      if (!input()) return;
      root = buildKeyboard();
      setPanel(activePanel);
      refreshVisibility();

      global.addEventListener('resize', () => {
        refreshVisibility();
        updateBodyInset();
      });

      global.addEventListener('blur', () => {
        releaseAllHeld();
        syncShiftUI();
      });

      global.requestAnimationFrame(() => updateBodyInset());
    },
  };

  global.VirtualKeyboard = VirtualKeyboard;
})(window);
