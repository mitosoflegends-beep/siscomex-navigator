(async () => {
  if (window.__siscomexAutoRunning) {
    console.log("[Siscomex Auto] já em execução");
    return;
  }
  window.__siscomexAutoRunning = true;

  const log = (...a) => console.log("[Siscomex Auto]", ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MENU_CONTAINER_SELECTOR = [
    "ul",
    "[role='menu']",
    "[role='group']",
    ".submenu",
    ".dropdown-menu",
    ".p-submenu-list",
    ".p-menu-list",
    ".p-tieredmenu-root-list",
    ".p-panelmenu-content",
    ".ui-menu-list",
    ".children",
    ".menu"
  ].join(", ");
  const norm = (s) =>
    (s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const uniq = (items) => {
    const out = [];
    const seen = new Set();
    for (const item of items) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
    return out;
  };

  function allDocs() {
    const docs = [document];
    const walk = (doc) => {
      const frames = doc.querySelectorAll("iframe, frame");
      for (const f of frames) {
        try {
          const d = f.contentDocument;
          if (d && !docs.includes(d)) {
            docs.push(d);
            walk(d);
          }
        } catch (e) {}
      }
    };
    walk(document);
    return docs;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const win = el.ownerDocument.defaultView || window;
    const cs = win.getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  }

  function elementOwnText(el) {
    if (!el) return "";
    let text = "";
    for (const node of el.childNodes || []) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += ` ${node.textContent || ""}`;
      }
    }
    return norm(text);
  }

  function elementText(el) {
    if (!el) return "";
    return norm(el.innerText || el.textContent || "");
  }

  function matchesText(el, targets, exact = false) {
    const txt = elementText(el);
    const own = elementOwnText(el);
    const aria = norm(el.getAttribute?.("aria-label"));
    const title = norm(el.getAttribute?.("title"));
    const href = norm(el.getAttribute?.("href"));

    for (const t of targets) {
      if (!t) continue;
      if (exact) {
        if (txt === t || own === t || aria === t || title === t) return true;
      } else {
        if (txt && (txt === t || txt.includes(t))) return true;
        if (own && (own === t || own.includes(t))) return true;
        if (aria && aria.includes(t)) return true;
        if (title && title.includes(t)) return true;
        if (href && href.includes(t.replace(/\s+/g, ""))) return true;
      }
    }
    return false;
  }

  function hasExpandableHints(el) {
    if (!el) return false;
    const role = norm(el.getAttribute?.("role"));
    const cls = norm(el.className?.toString());
    const ariaExpanded = el.getAttribute?.("aria-expanded");
    return (
      ariaExpanded != null ||
      el.hasAttribute?.("aria-haspopup") ||
      role === "tab" ||
      role === "treeitem" ||
      role === "menuitem" ||
      cls.includes("menu") ||
      cls.includes("submenu") ||
      cls.includes("accordion") ||
      cls.includes("panelmenu") ||
      !!el.querySelector?.(MENU_CONTAINER_SELECTOR)
    );
  }

  function clickableAncestor(el) {
    let cur = el;
    for (let i = 0; i < 10 && cur; i++) {
      const tag = (cur.tagName || "").toLowerCase();
      const role = cur.getAttribute?.("role");
      const cls = norm(cur.className?.toString());
      if (
        tag === "a" ||
        tag === "li" ||
        tag === "button" ||
        tag === "summary" ||
        role === "button" ||
        role === "menuitem" ||
        role === "treeitem" ||
        role === "tab" ||
        cur.onclick ||
        cur.classList?.contains("clickable") ||
        cur.hasAttribute?.("ng-click") ||
        cur.hasAttribute?.("(click)") ||
        hasExpandableHints(cur) ||
        cls.includes("menu") ||
        cls.includes("submenu") ||
        cls.includes("tab") ||
        cls.includes("dropdown")
      ) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return el;
  }

  function getRelatedContainers(node) {
    const containers = [];
    const push = (el) => {
      if (!el) return;
      if (el.matches?.(MENU_CONTAINER_SELECTOR)) containers.push(el);
      el.querySelectorAll?.(MENU_CONTAINER_SELECTOR)?.forEach((item) => containers.push(item));
    };

    let cur = node;
    for (let depth = 0; depth < 4 && cur; depth++) {
      push(cur);
      push(cur.nextElementSibling);
      push(cur.previousElementSibling);

      const controls = cur.getAttribute?.("aria-controls");
      if (controls) {
        for (const id of controls.split(/\s+/)) {
          push(cur.ownerDocument.getElementById(id));
        }
      }

      const target = cur.getAttribute?.("data-target") || cur.getAttribute?.("data-bs-target");
      if (target?.startsWith("#")) {
        push(cur.ownerDocument.querySelector(target));
      }

      cur = cur.parentElement;
    }

    return uniq(containers);
  }

  function candidateScore(el, targets) {
    const txt = elementText(el);
    const own = elementOwnText(el);
    const tag = (el.tagName || "").toLowerCase();
    const cls = norm(el.className?.toString());
    const exact = targets.some((t) => own === t || txt === t);
    const starts = targets.some((t) => own.startsWith(t) || txt.startsWith(t));
    return (
      (exact ? 1200 : 0) +
      (starts ? 200 : 0) +
      (hasExpandableHints(el) ? 240 : 0) +
      (tag === "li" ? 140 : 0) +
      (tag === "a" ? 120 : 0) +
      (tag === "button" ? 100 : 0) +
      (el.getAttribute?.("aria-expanded") === "false" ? 80 : 0) +
      (cls.includes("menu") ? 70 : 0) +
      (cls.includes("panelmenu") ? 70 : 0) +
      Math.max(0, 140 - own.length - txt.length / 4)
    );
  }

  function findAll(texts, root = null) {
    const targets = (Array.isArray(texts) ? texts : [texts]).map(norm).filter(Boolean);
    const results = [];
    const roots = root ? [root] : allDocs().map((doc) => doc.body || doc.documentElement || doc);

    for (const currentRoot of roots) {
      const elements = currentRoot.querySelectorAll?.("*") || [];
      for (const el of elements) {
        if (!isVisible(el)) continue;
        if (!matchesText(el, targets)) continue;
        const wrapped = clickableAncestor(el);
        if (!isVisible(wrapped)) continue;
        results.push({ el: wrapped, score: candidateScore(wrapped, targets) });
      }
    }

    return uniq(
      results
        .sort((a, b) => b.score - a.score)
        .map((item) => item.el)
    );
  }

  function findOne(texts, root = null) {
    return findAll(texts, root)[0] || null;
  }

  async function waitFor(texts, timeoutMs = 15000, root = null) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = findOne(texts, root);
      if (el) return el;
      await sleep(250);
    }
    return null;
  }

  function fireMouse(el, type) {
    const r = el.getBoundingClientRect();
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: el.ownerDocument.defaultView || window,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      button: 0,
    });
    el.dispatchEvent(ev);
  }

  function firePointer(el, type) {
    if (typeof PointerEvent !== "function") return;
    const r = el.getBoundingClientRect();
    const ev = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      view: el.ownerDocument.defaultView || window,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    });
    el.dispatchEvent(ev);
  }

  function fireKeyboard(el, key) {
    const options = { bubbles: true, cancelable: true, key };
    try {
      el.dispatchEvent(new KeyboardEvent("keydown", options));
      el.dispatchEvent(new KeyboardEvent("keyup", options));
    } catch (e) {}
  }

  async function hoverEl(el) {
    el.scrollIntoView({ block: "center", inline: "center" });
    await sleep(120);
    firePointer(el, "pointerover");
    firePointer(el, "pointerenter");
    fireMouse(el, "mouseover");
    fireMouse(el, "mouseenter");
    fireMouse(el, "mousemove");
    try {
      el.focus?.();
    } catch (e) {}
  }

  async function clickEl(el) {
    await hoverEl(el);
    await sleep(120);
    firePointer(el, "pointerdown");
    fireMouse(el, "mousedown");
    firePointer(el, "pointerup");
    fireMouse(el, "mouseup");
    fireMouse(el, "click");
    try {
      el.click();
    } catch (e) {}
  }

  async function tryOpenSidebar() {
    for (const doc of allDocs()) {
      const candidates = doc.querySelectorAll(
        "button, a, [role='button'], .menu-toggle, .navbar-toggler, [aria-label*='menu' i], [title*='menu' i], .hamburger, .icon-menu, .pi-bars"
      );
      for (const el of candidates) {
        if (!isVisible(el)) continue;
        const aria = norm(el.getAttribute("aria-label"));
        const title = norm(el.getAttribute("title"));
        const cls = norm(el.className?.toString());
        if (
          aria.includes("menu") ||
          title.includes("menu") ||
          cls.includes("menu-toggle") ||
          cls.includes("hamburger") ||
          cls.includes("navbar-toggler") ||
          cls.includes("icon-menu") ||
          cls.includes("pi-bars")
        ) {
          log("Abrindo menu lateral:", el);
          await clickEl(el);
          await sleep(700);
          return true;
        }
      }
    }
    return false;
  }

  function revealContainers(node) {
    const targets = uniq([node, ...getRelatedContainers(node)]);
    for (const el of targets) {
      try {
        if (el.hasAttribute?.("aria-hidden")) el.setAttribute("aria-hidden", "false");
        if (el.hasAttribute?.("aria-expanded")) el.setAttribute("aria-expanded", "true");
        if (typeof el.hidden === "boolean") el.hidden = false;
        el.style.display = el.style.display === "none" ? "block" : el.style.display || "block";
        el.style.visibility = "visible";
        el.style.opacity = "1";
        el.style.maxHeight = el.style.maxHeight || "2000px";
        el.style.pointerEvents = "auto";
      } catch (e) {}
    }
  }

  async function waitForChildNear(parent, childTexts, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const scopes = uniq([
        parent,
        parent.parentElement,
        parent.closest?.("li, [role='treeitem'], [role='menuitem'], .menuitem, .p-menuitem, .p-panelmenu-panel") || null,
        ...getRelatedContainers(parent),
      ]);

      for (const scope of scopes) {
        const child = findOne(childTexts, scope);
        if (child) return child;
      }

      const globalChild = findOne(childTexts);
      if (globalChild) return globalChild;
      await sleep(250);
    }
    return null;
  }

  async function tryExpandCandidate(candidate, childTexts) {
    const actionTargets = uniq([
      candidate,
      clickableAncestor(candidate),
      candidate.querySelector?.("a, button, [role='button'], [role='menuitem'], [role='treeitem'], [role='tab']") || null,
      candidate.closest?.("li, [role='treeitem'], [role='menuitem'], .menuitem, .p-menuitem, .p-panelmenu-header") || null,
      ...Array.from(
        candidate.querySelectorAll?.(
          "button, a, [role='button'], [role='menuitem'], [role='treeitem'], [role='tab'], .pi-chevron-right, .pi-chevron-down, .caret, .toggle, .submenu-toggler"
        ) || []
      ).filter(isVisible).slice(0, 4),
    ]);

    for (const target of actionTargets) {
      log("Tentando expandir/clicar:", elementText(target) || target.className || target.tagName, target);
      revealContainers(target);
      await hoverEl(target);
      fireKeyboard(target, "ArrowRight");
      fireKeyboard(target, "ArrowDown");
      fireKeyboard(target, "Enter");
      await clickEl(target);
      revealContainers(target);
      await sleep(450);
      const child = await waitForChildNear(candidate, childTexts, 1800);
      if (child) return child;
    }

    return null;
  }

  async function openMenuPath(label, parentTexts, childTexts, opts = {}) {
    const { retries = 5 } = opts;
    for (let attempt = 1; attempt <= retries; attempt++) {
      log(`🔎 [${attempt}/${retries}] Procurando ${label}`);

      const alreadyOpen = findOne(childTexts);
      if (alreadyOpen) {
        log(`✅ ${label}: filho já visível`);
        return alreadyOpen;
      }

      const candidates = findAll(parentTexts).slice(0, 8);
      if (!candidates.length) {
        log(`${label} não encontrado; tentando abrir menu lateral`);
        await tryOpenSidebar();
        await sleep(700);
        continue;
      }

      for (const candidate of candidates) {
        const immediateChild = await waitForChildNear(candidate, childTexts, 500);
        if (immediateChild) {
          log(`✅ ${label}: submenu já disponível`);
          return immediateChild;
        }

        const child = await tryExpandCandidate(candidate, childTexts);
        if (child) {
          log(`✅ ${label}: submenu aberto`);
          return child;
        }
      }

      await tryOpenSidebar();
      await sleep(700);
    }

    return null;
  }

  try {
    log("Iniciando. URL:", location.href);
    await sleep(600);
    await tryOpenSidebar();

    const importacaoTexts = ["importacao", "importação"];
    const declaracaoTexts = [
      "declaracao unica de importacao",
      "declaração única de importação",
      "declaracao de importacao",
      "declaração de importação",
    ];
    const consultarTexts = ["consultar duimp", "consultar a duimp", "consulta duimp", "consuttar duimp"];

    let consultar = findOne(consultarTexts);

    if (!consultar) {
      const declaracao = await openMenuPath("Importação", importacaoTexts, declaracaoTexts, { retries: 6 });
      if (declaracao) {
        consultar = await openMenuPath(
          "Declaração Única de Importação",
          declaracaoTexts,
          consultarTexts,
          { retries: 6 }
        );
      }
    }

    if (!consultar) {
      consultar = await waitFor(consultarTexts, 2500);
    }

    if (!consultar) {
      alert("[Siscomex Auto] Não encontrei 'Consultar Duimp'. Abra o console (F12) e me envie os logs com [Siscomex Auto].");
      throw new Error("consultar duimp");
    }

    log("👆 Clicando Consultar Duimp", consultar);
    await clickEl(consultar);
    log("✅ Fluxo concluído");
  } catch (e) {
    console.error("[Siscomex Auto] falhou:", e);
  } finally {
    window.__siscomexAutoRunning = false;
  }
})();
