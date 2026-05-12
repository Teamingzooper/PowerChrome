(function () {
  window.__powerMode = window.__powerMode || {};

  const ANIMATE_MAX_CHARS = 50;
  const SLOW_MS = 120;
  const FAST_MS = 15;
  let animating = false;

  function getSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
  }

  function isEditable(el) {
    const main = window.__powerMode.main;
    return main && main._isEditable ? main._isEditable(el) : false;
  }

  function isInputLike(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea';
  }

  function insertCharInput(el, ch) {
    const start = el.selectionStart != null ? el.selectionStart : el.value.length;
    const end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + ch + after;
    const next = start + ch.length;
    try {
      el.setSelectionRange(next, next);
    } catch (e) { /* number/date inputs may throw */ }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertCharContentEditable(ch) {
    try {
      if (document.execCommand) {
        document.execCommand('insertText', false, ch);
        return true;
      }
    } catch (e) { /* fall through */ }
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(ch);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch (e) {
      return false;
    }
  }

  function delayAt(i, total) {
    if (total <= 1) return SLOW_MS;
    const t = i / (total - 1);
    return SLOW_MS + (FAST_MS - SLOW_MS) * t;
  }

  function fireSideEffects(ch, el, comboValue) {
    try {
      const main = window.__powerMode.main;
      const pos = (main && main._caretPos) ? main._caretPos(el) : null;
      if (!pos) return;
      const settings = getSettings();
      if (window.__powerMode.particles) {
        window.__powerMode.particles.spawn(pos.x, pos.y, { combo: comboValue, userTriggered: true });
      }
      if (window.__powerMode.vfx) {
        if (main && main._resolveHudPos) {
          const hudPos = main._resolveHudPos(pos);
          window.__powerMode.vfx.updateHUD(comboValue, hudPos.x, hudPos.y);
        }
        const intensity = 2 + Math.min(comboValue / 8, 10);
        if (intensity > 0) window.__powerMode.vfx.shake(intensity);
      }
      if (settings.soundEnabled && window.__powerMode.sfx) {
        window.__powerMode.sfx.play(ch, comboValue);
      }
      if (window.__powerMode.typingFx) {
        window.__powerMode.typingFx.floatChar(ch, pos.x, pos.y);
      }
    } catch (e) { /* swallow per-char errors */ }
  }

  function animate(el, text) {
    if (animating) return;
    animating = true;

    const animateCount = Math.min(text.length, ANIMATE_MAX_CHARS);
    const tail = text.slice(animateCount);

    const main = window.__powerMode.main;
    const combo = window.__powerMode.combo;
    const stats = window.__powerMode.stats;

    // Register paste as a single combo increment (not spam, not no-increment)
    let comboValue = 1;
    if (combo && main && main._caretPos) {
      try {
        const p = main._caretPos(el);
        comboValue = combo.register(p.x, p.y, {});
      } catch (e) { /* ignore */ }
    }
    if (stats) {
      stats.recordPaste(text.length);
      stats.recordCombo(comboValue);
    }

    let i = 0;
    function tick() {
      if (i >= animateCount) {
        // Insert remaining (if any) instantly
        if (tail.length) {
          if (isInputLike(el)) insertCharInput(el, tail);
          else insertCharContentEditable(tail);
        }
        animating = false;
        return;
      }
      const ch = text[i];
      if (isInputLike(el)) insertCharInput(el, ch);
      else insertCharContentEditable(ch);
      fireSideEffects(ch, el, comboValue);
      i++;
      const d = delayAt(i - 1, animateCount);
      setTimeout(tick, d);
    }
    tick();
  }

  function onPaste(e) {
    const settings = getSettings();
    if (!settings.enabled || !settings.pasteAnimate) return;
    if (animating) return;
    const target = e.target;
    if (!isEditable(target)) return;

    let text = '';
    try {
      text = (e.clipboardData || window.clipboardData).getData('text');
    } catch (err) {
      return;
    }
    if (!text) return;

    // Strip non-printable except newlines/tabs
    text = text.replace(/\r\n/g, '\n');
    if (text.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    animate(target, text);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('paste', onPaste, true);
  }

  window.__powerMode.paste = {
    _delayAt: delayAt,
    _animate: animate,
    _isAnimating: function () { return animating; },
    _config: { ANIMATE_MAX_CHARS: ANIMATE_MAX_CHARS, SLOW_MS: SLOW_MS, FAST_MS: FAST_MS }
  };
})();
