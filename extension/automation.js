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

  // Coleta document + todos iframes mesma origem (recursivo)
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
        } catch (e) {
          /* cross-origin */
        }
      }
    };
    walk(document);
    return docs;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = (el.ownerDocument.defaultView || window).getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  }

  // Sobe até achar elemento clicável "real"
  function clickableAncestor(el) {
    let cur = el;
    for (let i = 0; i < 6 && cur; i++) {
      const tag = (cur.tagName || "").toLowerCase();
      if (
        tag === "a" ||
        tag === "button" ||
        cur.getAttribute?.("role") === "button" ||
        cur.getAttribute?.("role") === "menuitem" ||
        cur.onclick ||
        cur.classList?.contains("clickable")
      ) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return el;
  }

  function matchesText(el, targets) {
    const txt = norm(el.innerText || el.textContent);
    const aria = norm(el.getAttribute?.("aria-label"));
    const title = norm(el.getAttribute?.("title"));
    const href = norm(el.getAttribute?.("href"));
    for (const t of targets) {
      if (!t) continue;
      if (txt && (txt === t || txt.includes(t))) return true;
      if (aria && aria.includes(t)) return true;
      if (title && title.includes(t)) return true;
      if (href && href.includes(t.replace(/\s+/g, ""))) return true;
    }
    return false;
  }

  function findOne(texts) {
    const targets = (Array.isArray(texts) ? texts : [texts]).map(norm);
    for (const doc of allDocs()) {
      const all = doc.querySelectorAll("*");
      // Preferir elementos pequenos (folhas) com o texto
      let best = null;
      let bestLen = Infinity;
      for (const el of all) {
        if (!isVisible(el)) continue;
        if (!matchesText(el, targets)) continue;
        const tlen = (el.innerText || el.textContent || "").length;
        if (tlen < bestLen) {
          best = el;
          bestLen = tlen;
        }
      }
      if (best) return clickableAncestor(best);
    }
    return null;
  }

  async function waitFor(texts, timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = findOne(texts);
      if (el) return el;
      await sleep(400);
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
    await sleep(150);
    fireMouse(el, "mousemove");
    fireMouse(el, "mousedown");
    fireMouse(el, "mouseup");
    fireMouse(el, "click");
    try {
      el.click();
    } catch (e) {}
  }

  // Tenta abrir o menu lateral (hambúrguer) se existir
  async function tryOpenSidebar() {
    for (const doc of allDocs()) {
      const candidates = doc.querySelectorAll(
        "button, a, [role='button'], .menu-toggle, .navbar-toggler, [aria-label*='menu' i], [title*='menu' i]"
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
          cls.includes("navbar-toggler")
        ) {
          log("Abrindo menu lateral:", el);
          await clickEl(el);
          await sleep(800);
          return true;
        }
      }
    }
    return false;
  }

  async function step(label, texts, timeout = 20000) {
    log(`🔎 Procurando: ${label}`);
    let el = await waitFor(texts, 4000);
    if (!el) {
      log("Não achei na 1ª tentativa, tentando abrir menu lateral...");
      await tryOpenSidebar();
      el = await waitFor(texts, timeout);
    }
    if (!el) {
      const msg = `[Siscomex Auto] Não encontrei: ${label}.\nAbra o console (F12) para ver o que foi inspecionado.`;
      console.error(msg);
      alert(msg);
      throw new Error(`não encontrado: ${label}`);
    }
    log(`👆 Clicando: ${label}`, el);
    await clickEl(el);
    await sleep(1500);
  }

  try {
    log("Iniciando. URL:", location.href);
    await sleep(500);
    await tryOpenSidebar();

    await step("Importação", ["importacao", "importação"]);
    await step("Declaração Única de Importação", [
      "declaracao unica de importacao",
      "declaração única de importação",
      "declaracao de importacao",
      "declaração de importação",
      "duimp",
    ]);
    await step("Consultar Duimp", [
      "consultar duimp",
      "consultar a duimp",
      "consulta duimp",
    ]);
    log("✅ Fluxo concluído");
  } catch (e) {
    console.error("[Siscomex Auto] falhou:", e);
  } finally {
    window.__siscomexAutoRunning = false;
  }
})();