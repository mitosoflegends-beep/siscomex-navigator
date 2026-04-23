(async () => {
  if (window.__siscomexAutoRunning) {
    console.log("[Siscomex Auto] já em execução");
    return;
  }
  window.__siscomexAutoRunning = true;

  const log = (...a) => console.log("[Siscomex Auto]", ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) =>
    (s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

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

  function clickableAncestor(el) {
    let cur = el;
    for (let i = 0; i < 8 && cur; i++) {
      const tag = (cur.tagName || "").toLowerCase();
      const role = cur.getAttribute?.("role");
      if (
        tag === "a" ||
        tag === "button" ||
        role === "button" ||
        role === "menuitem" ||
        role === "treeitem" ||
        cur.onclick ||
        cur.classList?.contains("clickable") ||
        cur.hasAttribute?.("ng-click") ||
        cur.hasAttribute?.("(click)")
      ) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return el;
  }

  function elementText(el) {
    return norm(el.innerText || el.textContent || "");
  }

  function matchesText(el, targets, exact = false) {
    const txt = elementText(el);
    const aria = norm(el.getAttribute?.("aria-label"));
    const title = norm(el.getAttribute?.("title"));
    const href = norm(el.getAttribute?.("href"));
    for (const t of targets) {
      if (!t) continue;
      if (exact) {
        if (txt === t) return true;
      } else {
        if (txt && (txt === t || txt.includes(t))) return true;
      }
      if (aria && aria.includes(t)) return true;
      if (title && title.includes(t)) return true;
      if (href && href.includes(t.replace(/\s+/g, ""))) return true;
    }
    return false;
  }

  // Acha o nó "folha" (menor texto) que contém o alvo, dentro de um root
  function findInRoot(root, targets) {
    const all = root.querySelectorAll("*");
    let best = null;
    let bestLen = Infinity;
    for (const el of all) {
      if (!isVisible(el)) continue;
      if (!matchesText(el, targets)) continue;
      const tlen = elementText(el).length;
      if (tlen > 0 && tlen < bestLen) {
        best = el;
        bestLen = tlen;
      }
    }
    return best ? clickableAncestor(best) : null;
  }

  function findOne(texts) {
    const targets = (Array.isArray(texts) ? texts : [texts]).map(norm);
    for (const doc of allDocs()) {
      const found = findInRoot(doc.body || doc, targets);
      if (found) return found;
    }
    return null;
  }

  async function waitFor(texts, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = findOne(texts);
      if (el) return el;
      await sleep(300);
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

  async function clickEl(el) {
    el.scrollIntoView({ block: "center", inline: "center" });
    await sleep(200);
    fireMouse(el, "mouseover");
    fireMouse(el, "mouseenter");
    await sleep(120);
    fireMouse(el, "mousemove");
    fireMouse(el, "mousedown");
    fireMouse(el, "mouseup");
    fireMouse(el, "click");
    try { el.click(); } catch (e) {}
  }

  async function tryOpenSidebar() {
    for (const doc of allDocs()) {
      const candidates = doc.querySelectorAll(
        "button, a, [role='button'], .menu-toggle, .navbar-toggler, [aria-label*='menu' i], [title*='menu' i], .hamburger, .icon-menu"
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
          cls.includes("icon-menu")
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

  // Clica num item pai e espera o submenu (filho) aparecer.
  // Se filho não aparecer, re-clica até `retries` vezes.
  async function clickAndExpand(parentLabel, parentTexts, childTexts, opts = {}) {
    const { retries = 3, waitChild = 8000 } = opts;
    for (let attempt = 1; attempt <= retries; attempt++) {
      log(`🔎 [${attempt}/${retries}] Procurando pai: ${parentLabel}`);
      const parent = await waitFor(parentTexts, 10000);
      if (!parent) {
        log("Pai não encontrado, tentando abrir sidebar...");
        await tryOpenSidebar();
        continue;
      }
      log(`👆 Clicando pai: ${parentLabel}`, parent);
      await clickEl(parent);
      await sleep(700);

      // Espera o filho aparecer
      log(`⏳ Aguardando submenu: ${childTexts[0]}`);
      const child = await waitFor(childTexts, waitChild);
      if (child) {
        log(`✅ Submenu apareceu`);
        return child;
      }
      log(`⚠️ Submenu não apareceu, re-tentando clicar no pai...`);
      // Talvez o clique tenha fechado — clicar de novo
    }
    return null;
  }

  try {
    log("Iniciando. URL:", location.href);
    await sleep(500);
    await tryOpenSidebar();

    // Passo 1: clicar Importação e esperar "Declaração..." aparecer
    const decl = await clickAndExpand(
      "Importação",
      ["importacao", "importação"],
      [
        "declaracao unica de importacao",
        "declaração única de importação",
        "declaracao de importacao",
        "declaração de importação",
        "duimp",
      ],
      { retries: 3, waitChild: 8000 }
    );
    if (!decl) {
      alert("[Siscomex Auto] Não consegui abrir o submenu de Importação.");
      throw new Error("submenu importação");
    }

    // Passo 2: clicar Declaração... e esperar "Consultar Duimp" aparecer
    log(`👆 Clicando: Declaração Única de Importação`, decl);
    await clickEl(decl);
    await sleep(700);

    let consultar = await waitFor(
      ["consultar duimp", "consultar a duimp", "consulta duimp", "consultar"],
      8000
    );
    if (!consultar) {
      log("Submenu de Declaração não apareceu — re-clicando");
      await clickEl(decl);
      await sleep(700);
      consultar = await waitFor(
        ["consultar duimp", "consultar a duimp", "consulta duimp"],
        8000
      );
    }
    if (!consultar) {
      alert("[Siscomex Auto] Não encontrei 'Consultar Duimp' no submenu.\nAbra o console (F12) e me envie os logs.");
      throw new Error("consultar duimp");
    }

    log(`👆 Clicando: Consultar Duimp`, consultar);
    await clickEl(consultar);
    log("✅ Fluxo concluído");
  } catch (e) {
    console.error("[Siscomex Auto] falhou:", e);
  } finally {
    window.__siscomexAutoRunning = false;
  }
})();