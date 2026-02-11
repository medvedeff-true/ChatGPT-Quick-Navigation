(() => {
  "use strict";

  const HOST_ID = "cgpt-nav-host";
  const SHADOW_MOUNT_ID = "cgpt-nav-shadow-mount";
  const PASSIVE = { passive: true };

  const state = {
    userMessages: [],
    currentIndex: -1,
    hovered: false,
    scheduledRebuild: false,
    scheduledActive: false,
    observer: null,

    rootEl: null,
    panelEl: null,
    listEl: null,

    tipEl: null,
    hoverTipTimer: null,
    hoveredItemEl: null,

    // реальный скролл-контейнер
    scrollEl: null,

    // чтобы не бороться с пользователем, когда он скроллит список
    lastListUserScroll: 0,
    programmaticListScroll: false,
  };

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;

    host = document.createElement("div");
    host.id = HOST_ID;

    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483647";

    document.documentElement.appendChild(host);
    return host;
  }

  function isDarkTheme() {
    const el = document.documentElement;
    const body = document.body;
    return Boolean(
      el?.getAttribute("data-ds-dark-theme") ||
      body?.getAttribute("data-ds-dark-theme") ||
      el?.classList?.contains("dark") ||
      body?.classList?.contains("dark") ||
      el?.getAttribute("data-theme") === "dark" ||
      body?.getAttribute("data-theme") === "dark",
    );
  }

  function updateThemeFlag(shadow) {
    const root = shadow?.host;
    if (!root) return;
    root.setAttribute("data-cgpt-theme", isDarkTheme() ? "dark" : "light");
  }

  // освобождаем область скроллбара справа
  function updateRightOffset() {
    const root = state.rootEl;
    if (!root) return;

    const sbw = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth,
    );
    const minOverlayGutter = 14;

    const baseRight = 16;
    const extra = Math.max(sbw, minOverlayGutter);

    root.style.right = `${baseRight + extra}px`;
  }

  function updateListMaxHeight() {
    const list = state.listEl;
    if (!list) return;

    const maxH = Math.min(250, Math.max(120, window.innerHeight - 80));
    list.style.maxHeight = `${Math.round(maxH)}px`;
  }

  function updatePanelMasks() {
    const panel = state.panelEl;
    const list = state.listEl;
    if (!panel || !list) return;

    const canScroll = list.scrollHeight > list.clientHeight + 1;

    if (!state.hovered || !canScroll) {
      panel.classList.add("cgpt-mask-off");
      panel.classList.remove("cgpt-mask-top-off", "cgpt-mask-bottom-off");
      return;
    }

    panel.classList.remove("cgpt-mask-off");

    const atTop = list.scrollTop <= 1;
    const atBottom =
      list.scrollTop + list.clientHeight >= list.scrollHeight - 1;

    panel.classList.toggle("cgpt-mask-top-off", atTop);
    panel.classList.toggle("cgpt-mask-bottom-off", atBottom);
  }

  function clearHoverTip() {
    if (state.hoverTipTimer) {
      clearTimeout(state.hoverTipTimer);
      state.hoverTipTimer = null;
    }
    state.hoveredItemEl = null;

    if (state.tipEl) {
      state.tipEl.classList.remove("is-on");
      state.tipEl.textContent = "";
    }
  }

  // показать полный заголовок при удержании мыши
  function scheduleHoverTip(itemEl, fullText) {
    clearHoverTip();
    state.hoveredItemEl = itemEl;

    state.hoverTipTimer = setTimeout(() => {
      if (!state.tipEl) return;
      if (!itemEl.isConnected) return;
      if (!state.hovered) return;

      const panelRect = state.panelEl
        ? state.panelEl.getBoundingClientRect()
        : null;
      const itemRect = itemEl.getBoundingClientRect();

      const pad = 8;
      const gap = 12;

      const anchorLeft = panelRect ? panelRect.left : itemRect.left;
      const available = Math.max(180, anchorLeft - gap - pad);

      state.tipEl.style.maxWidth = `${Math.min(520, Math.floor(available))}px`;
      state.tipEl.textContent = fullText || "";
      state.tipEl.classList.add("is-on");

      requestAnimationFrame(() => {
        const tipRect = state.tipEl.getBoundingClientRect();

        let left = anchorLeft - gap - tipRect.width;
        let top = itemRect.top + itemRect.height / 2 - tipRect.height / 2;

        if (left < pad) left = pad;

        if (top < pad) top = pad;
        const maxTop = window.innerHeight - tipRect.height - pad;
        if (top > maxTop) top = maxTop;

        state.tipEl.style.left = `${Math.round(left)}px`;
        state.tipEl.style.top = `${Math.round(top)}px`;
      });
    }, 1900);
  }

  // фикс для больших/старых чатов и вложенных скроллов
  function isScrollableY(el) {
    if (!el) return false;
    const cs = window.getComputedStyle(el);
    const oy = cs.overflowY;
    return oy === "auto" || oy === "scroll" || oy === "overlay";
  }

  function resolveScrollEl(seedEl) {
    // Начинаем с parentElement, чтобы не схватить внутренний скролл в самом сообщении
    let el = seedEl?.parentElement || null;
    const candidates = [];

    const minH = Math.min(520, Math.floor(window.innerHeight * 0.4));
    const minW = Math.min(520, Math.floor(window.innerWidth * 0.35));

    while (el && el !== document.documentElement) {
      if (isScrollableY(el) && el.scrollHeight > el.clientHeight + 40) {
        const bigEnough =
          el.clientHeight >= minH &&
          el.clientWidth >= minW &&
          el.clientHeight > 200;
        if (bigEnough) candidates.push(el);
      }
      el = el.parentElement;
    }

    // выбираем самый большой по высоте - это почти всегда основной скролл чата
    if (candidates.length) {
      candidates.sort((a, b) => b.clientHeight - a.clientHeight);
      return candidates[0];
    }

    return window;
  }

  function bindScrollEl(next) {
    const prev = state.scrollEl;
    if (prev === next) return;

    if (prev) {
      const t = prev === window ? window : prev;
      t.removeEventListener("scroll", scheduleActiveFromScroll, PASSIVE);
    }

    state.scrollEl = next;

    const t = next === window ? window : next;
    t.addEventListener("scroll", scheduleActiveFromScroll, PASSIVE);
  }

  function ensureScrollBinding() {
    if (!state.userMessages.length) return;

    const i = Math.min(
      state.userMessages.length - 1,
      Math.max(0, state.currentIndex >= 0 ? state.currentIndex : 0),
    );
    const seed = state.userMessages[i] || state.userMessages[0];
    const next = resolveScrollEl(seed);
    bindScrollEl(next);
  }

  function getScrollTop() {
    const sc = state.scrollEl;
    if (!sc || sc === window) {
      return window.scrollY || document.documentElement.scrollTop || 0;
    }
    return sc.scrollTop;
  }

  function getViewportHeight() {
    const sc = state.scrollEl;
    if (!sc || sc === window) return window.innerHeight || 800;
    return sc.clientHeight || window.innerHeight || 800;
  }

  function getMessageTopInScroll(el) {
    const sc = state.scrollEl;
    if (!sc || sc === window) {
      return el.getBoundingClientRect().top + (window.scrollY || 0);
    }
    const scRect = sc.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return elRect.top - scRect.top + sc.scrollTop;
  }

  // живой поиск индекса без кеша tops
  function findClosestIndexByYLive(y) {
    const n = state.userMessages.length;
    if (!n) return -1;

    let lo = 0;
    let hi = n - 1;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const top = getMessageTopInScroll(state.userMessages[mid]);
      if (top < y) lo = mid + 1;
      else hi = mid;
    }

    const i = lo;
    if (i <= 0) return 0;
    if (i >= n) return n - 1;

    const prev = i - 1;

    const topPrev = getMessageTopInScroll(state.userMessages[prev]);
    const topI = getMessageTopInScroll(state.userMessages[i]);

    const a = Math.abs(topPrev - y);
    const b = Math.abs(topI - y);
    return a <= b ? prev : i;
  }

  function setOpen(open) {
    const panel = state.panelEl;
    const list = state.listEl;
    if (!panel || !list) return;

    panel.classList.toggle("cgpt-open", open);
    panel.classList.toggle("cgpt-mask-off", !open);

    list.querySelectorAll("[data-cgpt-nav='text']").forEach((t) => {
      t.classList.toggle("cgpt-open", open);
    });

    if (state.currentIndex < 0 && state.userMessages.length) {
      ensureScrollBinding();
      const y = getScrollTop() + Math.round(getViewportHeight() * 0.25);
      const idx = findClosestIndexByYLive(y);
      if (idx >= 0) state.currentIndex = idx;
    }

    if (state.currentIndex >= 0)
      setActive(state.currentIndex, { ensureVisible: true });

    if (!open) clearHoverTip();
    updatePanelMasks();
  }

  function ensureUI() {
    const host = ensureHost();

    let mount = host.querySelector(`#${SHADOW_MOUNT_ID}`);
    if (!mount) {
      mount = document.createElement("div");
      mount.id = SHADOW_MOUNT_ID;
      mount.style.pointerEvents = "auto";
      host.appendChild(mount);
    }

    let shadow = mount.shadowRoot;
    if (!shadow) shadow = mount.attachShadow({ mode: "open" });

    updateThemeFlag(shadow);

    if (!shadow.querySelector('style[data-cgpt-nav="1"]')) {
      const style = document.createElement("style");
      style.setAttribute("data-cgpt-nav", "1");
      style.textContent = `
        :host, * { box-sizing: border-box; }

        :host {
          --cgpt-bg: rgba(255,255,255,.94);
          --cgpt-border: rgba(0,0,0,.06);
          --cgpt-text: rgb(9, 9, 9);
          --cgpt-text-muted: rgba(17, 17, 17, 0.75);
          --cgpt-mark: rgba(0, 0, 0, 0.4);
          --cgpt-accent: rgb(37, 99, 235);
          --cgpt-shadow: 0 10px 26px rgba(0,0,0,.12);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }

        :host([data-cgpt-theme="dark"]) {
          --cgpt-bg: rgba(21,21,23,.92);
          --cgpt-border: rgba(255,255,255,.10);
          --cgpt-text: rgba(248,250,255,.92);
          --cgpt-text-muted: rgba(248,250,255,.55);
          --cgpt-mark: rgba(255,255,255,.22);
          --cgpt-shadow: 0 10px 26px rgba(0,0,0,.45);
        }

        .cgpt-root {
          user-select: none;
          z-index: 2147483647;
          border-radius: 8px;
          align-items: center;
          width: 34px;
          height: 300px;
          transition: all .2s;
          display: flex;
          position: fixed;
          top: 50%;
          right: 16px;
          transform: translateY(-50%);
          pointer-events: auto;
        }

        .cgpt-hit {
          position: absolute;
          left: -20px;
          top: -44px;
          bottom: -44px;
          width: 20px;
          background: transparent;
        }

        .cgpt-bg {
          width: 34px;
          height: var(--cgpt-bg-height, 180px);
          -webkit-backdrop-filter: blur(5px);
          backdrop-filter: blur(5px);
          z-index: -1;
          background-color: rgba(255,255,255,.80);
          border-radius: 16px;
          max-height: calc(100% - 8px);
          position: absolute;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
        }

        :host([data-cgpt-theme="dark"]) .cgpt-bg {
          background-color: rgba(21,21,23,.60);
        }

        .cgpt-panel {
          pointer-events: auto;
          border: 1px solid transparent;
          border-radius: 16px;
          width: 34px;
          max-width: 240px;
          transition: width .2s, background .2s, box-shadow .2s, border-color .2s;
          position: absolute;
          right: 0;
          overflow: hidden;
          background: transparent;
          box-shadow: none;
        }

        .cgpt-panel.cgpt-open {
          background: var(--cgpt-bg);
          box-shadow: var(--cgpt-shadow);
          border: 1px solid var(--cgpt-border);
          width: 240px;
        }

        .cgpt-panel:before,
        .cgpt-panel:after {
          content: "";
          z-index: 2;
          pointer-events: none;
          opacity: 0;
          background: linear-gradient(#fff 20.19%, rgba(255,255,255,0) 100%);
          width: 100%;
          height: 32px;
          transition: opacity .2s;
          position: absolute;
          left: 0;
        }

        :host([data-cgpt-theme="dark"]) .cgpt-panel:before,
        :host([data-cgpt-theme="dark"]) .cgpt-panel:after {
          background: linear-gradient(180deg, var(--cgpt-bg) 20.19%, rgba(35,35,36,0) 100%);
        }

        .cgpt-panel:before { top: 0; }
        .cgpt-panel:after { bottom: 0; transform: rotate(180deg); }

        .cgpt-panel.cgpt-open:before,
        .cgpt-panel.cgpt-open:after { opacity: 1; transition: none; }

        .cgpt-panel.cgpt-mask-bottom-off:after,
        .cgpt-panel.cgpt-mask-top-off:before,
        .cgpt-panel.cgpt-mask-off:before,
        .cgpt-panel.cgpt-mask-off:after { opacity: 0; }

        .cgpt-list {
          max-height: 250px;
          padding: var(--cgpt-page-padding, 20px 0px 20px 24px);
          overscroll-behavior: contain;
          flex-direction: column;
          align-items: flex-end;
          display: flex;
          position: relative;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .cgpt-list::-webkit-scrollbar { display: none; }
        .cgpt-panel:not(.cgpt-open) .cgpt-list { overflow-y: hidden; }

        .cgpt-item {
          cursor: pointer;
          height: 20px;
          color: var(--cgpt-text-muted);
          justify-content: flex-end;
          align-items: center;
          width: calc(100% - 6px);
          margin-top: 10px;
          margin-right: 8px;
          line-height: 20px;
          display: flex;
        }
        .cgpt-item.cgpt-first { margin-top: 0; }

        .cgpt-mark-wrap {
          flex-shrink: 0;
          justify-content: center;
          align-items: center;
          width: 16px;
          height: 20px;
          display: flex;
        }

        .cgpt-mark {
          background-color: var(--cgpt-mark);
          border-radius: 4px;
          flex-shrink: 0;
          width: 8px;
          height: 2px;
          transition: background-color .2s, transform .2s;
          transform-origin: 50%;
          transform: scaleX(1);
        }

        /* активный маркер в закрытом виде - синий */
        .cgpt-panel:not(.cgpt-open) .cgpt-item.cgpt-active-closed .cgpt-mark {
          background-color: var(--cgpt-accent);
          transform: scaleX(1.6);
          opacity: 1;
        }

        .cgpt-text {
          font-size: 13px;
          line-height: 20px;
          font-weight: 400;
          text-overflow: ellipsis;
          white-space: nowrap;
          opacity: 0;
          margin-right: 0;
          transition: opacity .1s, color .2s;
          overflow: hidden;

          flex: 1 1 auto;
          min-width: 0;
          text-align: left;
        }

        .cgpt-text.cgpt-open { opacity: 1; }

        .cgpt-panel.cgpt-open .cgpt-item { justify-content: flex-start; }
        .cgpt-panel.cgpt-open .cgpt-mark-wrap { margin-left: auto; }
        .cgpt-panel.cgpt-open .cgpt-text { margin-right: 12px; }

        .cgpt-panel.cgpt-open .cgpt-item:hover,
        .cgpt-panel.cgpt-open .cgpt-item:hover .cgpt-text {
          color: var(--cgpt-text);
        }

        .cgpt-panel.cgpt-open .cgpt-item:hover .cgpt-mark {
          background-color: var(--cgpt-text);
        }

        .cgpt-panel.cgpt-open .cgpt-item.cgpt-active .cgpt-text {
          color: var(--cgpt-accent);
          font-weight: 500;
        }

        .cgpt-panel.cgpt-open .cgpt-item.cgpt-active .cgpt-mark {
          background-color: var(--cgpt-accent);
          transform: scaleX(1.5);
        }

        .cgpt-tip {
          position: fixed;
          z-index: 2147483647;
          max-width: 520px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(0,0,0,0.86);
          color: rgba(255,255,255,0.96);
          font-size: 13px;
          line-height: 17px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.25);
          opacity: 0;
          transform: translateY(4px);
          pointer-events: none;
          transition: opacity 140ms ease, transform 140ms ease;
        }
        .cgpt-tip.is-on {
          opacity: 1;
          transform: translateY(0);
        }

        @media not all and (min-width: 768px) {
          .cgpt-root { display: none; }
        }
      `;
      shadow.appendChild(style);
    }

    let root = shadow.querySelector('[data-cgpt-nav="root"]');
    if (!root) {
      root = document.createElement("div");
      root.className = "cgpt-root";
      root.setAttribute("data-cgpt-nav", "root");

      root.style.setProperty("--cgpt-page-padding", "20px 0px 20px 24px");
      root.style.setProperty("--cgpt-bg-height", "180px");

      const hit = document.createElement("div");
      hit.className = "cgpt-hit";
      root.appendChild(hit);

      const bg = document.createElement("div");
      bg.className = "cgpt-bg";
      root.appendChild(bg);

      const panel = document.createElement("div");
      panel.className = "cgpt-panel cgpt-mask-off";
      panel.setAttribute("data-cgpt-nav", "panel");

      const list = document.createElement("div");
      list.className = "cgpt-list";
      list.setAttribute("data-cgpt-nav", "list");

      list.addEventListener(
        "scroll",
        () => {
          if (!state.programmaticListScroll)
            state.lastListUserScroll = Date.now();
          updatePanelMasks();
        },
        PASSIVE,
      );

      panel.appendChild(list);
      root.appendChild(panel);

      const tip = document.createElement("div");
      tip.className = "cgpt-tip";
      tip.setAttribute("data-cgpt-nav", "tip");
      shadow.appendChild(tip);
      state.tipEl = tip;

      root.addEventListener("mouseenter", () => {
        state.hovered = true;
        setOpen(true);
      });

      root.addEventListener("mouseleave", () => {
        state.hovered = false;
        setOpen(false);
      });

      root.addEventListener(
        "wheel",
        (e) => {
          if (!state.userMessages.length) return;

          const listEl = state.listEl;
          const canScrollList =
            state.hovered &&
            listEl &&
            listEl.scrollHeight > listEl.clientHeight + 1;

          if (canScrollList) return;

          e.preventDefault();
          const dir = e.deltaY > 0 ? 1 : -1;
          jumpRelative(dir);
        },
        { passive: false },
      );

      shadow.appendChild(root);

      state.rootEl = root;
      state.panelEl = panel;
      state.listEl = list;
    } else {
      state.rootEl = root;
      state.panelEl = shadow.querySelector('[data-cgpt-nav="panel"]');
      state.listEl = shadow.querySelector('[data-cgpt-nav="list"]');
      state.tipEl = shadow.querySelector('[data-cgpt-nav="tip"]');
      if (state.tipEl && state.tipEl.parentNode === shadow)
        shadow.appendChild(state.tipEl);
    }

    updateRightOffset();
    updateListMaxHeight();
    setOpen(Boolean(state.hovered));

    return shadow;
  }

  function normalizeText(text) {
    return (text || "")
      .replace(/\u200B/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleFromText(text) {
    const t = normalizeText(text);
    if (!t) return "—";
    const max = 80;
    return t.length > max ? `${t.slice(0, max)}…` : t;
  }

  function findUserMessages() {
    const byRole = Array.from(
      document.querySelectorAll('[data-message-author-role="user"]'),
    );
    if (byRole.length) return byRole;

    const articles = Array.from(document.querySelectorAll("article"));
    return articles.filter((el) => normalizeText(el.textContent).length > 0);
  }

  function extractUserText(el) {
    return normalizeText(el.innerText || el.textContent || "");
  }

  function scrollToMessage(el) {
    if (!el) return;

    ensureScrollBinding();

    const sc = state.scrollEl;

    if (sc && sc !== window) {
      const top = Math.max(0, getMessageTopInScroll(el) - 80);
      sc.scrollTo({ top, left: 0, behavior: "smooth" });
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      window.scrollBy({ top: -80, left: 0, behavior: "instant" });
    }, 120);
  }

  function keepItemVisibleInList(itemEl) {
    const list = state.listEl;
    if (!list) return;

    const pad = 14;

    const itemTop = itemEl.offsetTop;
    const itemBottom = itemTop + itemEl.offsetHeight;

    const viewTop = list.scrollTop;
    const viewBottom = viewTop + list.clientHeight;

    let nextTop = null;

    if (itemTop < viewTop + pad) {
      nextTop = Math.max(0, itemTop - pad);
    } else if (itemBottom > viewBottom - pad) {
      nextTop = Math.max(0, itemBottom - list.clientHeight + pad);
    }

    if (nextTop === null) return;

    state.programmaticListScroll = true;
    list.scrollTop = nextTop;
    requestAnimationFrame(() => {
      state.programmaticListScroll = false;
      updatePanelMasks();
    });
  }

  function setActive(index, opts = {}) {
    state.currentIndex = index;

    const list = state.listEl;
    if (!list) return;

    const items = Array.from(list.querySelectorAll("[data-cgpt-nav='item']"));
    items.forEach((node) => {
      node.classList.remove("cgpt-active");
      node.classList.remove("cgpt-active-closed");
    });

    const activeItem = items.find((n) => Number(n.dataset.index) === index);
    if (!activeItem) return;

    const canScrollList = list.scrollHeight > list.clientHeight + 1;
    const wantEnsureVisible = opts.ensureVisible !== false && canScrollList;

    if (state.hovered) {
      activeItem.classList.add("cgpt-active");

      // в раскрытом виде автодоводим, но не мешаем ручному скроллу списка
      if (wantEnsureVisible) keepItemVisibleInList(activeItem);
    } else {
      activeItem.classList.add("cgpt-active-closed");

      // даже в свернутом виде автоскроллим список, чтобы активная полоска всегда была видна
      if (wantEnsureVisible) keepItemVisibleInList(activeItem);
    }
  }

  function jumpRelative(delta) {
    if (!state.userMessages.length) return;

    let next = state.currentIndex;
    if (next < 0) next = 0;

    next += delta;

    if (next < 0) next = 0;
    if (next >= state.userMessages.length) next = state.userMessages.length - 1;

    const el = state.userMessages[next];
    scrollToMessage(el);
    setActive(next, { ensureVisible: true });
  }

  function rebuildList() {
    const shadow = ensureUI();
    const root = shadow.querySelector('[data-cgpt-nav="root"]');
    const list = shadow.querySelector('[data-cgpt-nav="list"]');
    if (!list) return;

    updateRightOffset();
    updateListMaxHeight();
    updateThemeFlag(shadow);

    const messages = findUserMessages();
    state.userMessages = messages;

    if (root) root.style.display = messages.length ? "" : "none";

    ensureScrollBinding();

    list.innerHTML = "";

    if (!messages.length) {
      state.currentIndex = -1;
      clearHoverTip();
      return;
    }

    const frag = document.createDocumentFragment();

    messages.forEach((el, idx) => {
      const full = extractUserText(el);
      const title = titleFromText(full);

      const item = document.createElement("div");
      item.className = "cgpt-item";
      item.setAttribute("data-cgpt-nav", "item");
      if (idx === 0) item.classList.add("cgpt-first");
      item.dataset.index = String(idx);

      const label = document.createElement("div");
      label.className = "cgpt-text";
      label.setAttribute("data-cgpt-nav", "text");
      label.textContent = title;

      const markWrap = document.createElement("div");
      markWrap.className = "cgpt-mark-wrap";

      const mark = document.createElement("div");
      mark.className = "cgpt-mark";

      markWrap.appendChild(mark);
      item.appendChild(label);
      item.appendChild(markWrap);

      item.addEventListener("click", () => {
        scrollToMessage(el);
        setActive(idx, { ensureVisible: true });
      });

      item.addEventListener("mouseenter", () => {
        if (!state.hovered) return;
        const needsTip =
          full &&
          (full.length > title.length ||
            label.scrollWidth > label.clientWidth + 1);
        if (!needsTip) return;
        scheduleHoverTip(item, full);
      });

      item.addEventListener("mouseleave", () => {
        clearHoverTip();
      });

      frag.appendChild(item);
    });

    list.appendChild(frag);

    setOpen(Boolean(state.hovered));
    updateActiveByScroll(true);
    updatePanelMasks();

    if (state.currentIndex < 0 && state.userMessages.length) {
      const y = getScrollTop() + Math.round(getViewportHeight() * 0.25);
      const idx = findClosestIndexByYLive(y);
      if (idx >= 0) setActive(idx, { ensureVisible: true });
    }
  }

  function scheduleRebuild() {
    if (state.scheduledRebuild) return;
    state.scheduledRebuild = true;

    window.setTimeout(() => {
      state.scheduledRebuild = false;
      rebuildList();
    }, 200);
  }

  function startObserver() {
    if (state.observer) return;

    state.observer = new MutationObserver(() => {
      scheduleRebuild();
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function updateActiveByScroll(force = false) {
    if (!state.userMessages.length) return;

    ensureScrollBinding();

    const y = getScrollTop() + Math.round(getViewportHeight() * 0.25);
    const idx = findClosestIndexByYLive(y);

    if (idx < 0) return;
    if (!force && idx === state.currentIndex) return;

    const list = state.listEl;

    const canScrollList = Boolean(
      list && list.scrollHeight > list.clientHeight + 1,
    );
    const inOpenAndUserScrollingList =
      state.hovered &&
      canScrollList &&
      Date.now() - state.lastListUserScroll <= 350;

    const ensureVisible = !inOpenAndUserScrollingList;

    setActive(idx, { ensureVisible });
  }

  function scheduleActiveFromScroll() {
    if (state.scheduledActive) return;
    state.scheduledActive = true;

    window.requestAnimationFrame(() => {
      state.scheduledActive = false;
      updateActiveByScroll(false);
    });
  }

  function boot() {
    ensureUI();
    rebuildList();
    startObserver();

    window.addEventListener(
      "resize",
      () => {
        updateRightOffset();
        updateListMaxHeight();
        scheduleRebuild();
      },
      PASSIVE,
    );

    window.addEventListener("load", () => scheduleRebuild(), { once: true });
  }

  boot();
})();
