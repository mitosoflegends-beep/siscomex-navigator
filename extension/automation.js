(async () => {
  // Evita reentrada
  if (window.__siscomexAutoRunning) {
    console.log("[Siscomex Auto] já em execução");
    return;
  }
  window.__siscomexAutoRunning = true;

  const log = (...a) => console.log("[Siscomex Auto]", ...a);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Procura elemento por texto visível dentro do documento e iframes
  function findByText(texts, root = document) {
    const list = Array.isArray(texts) ? texts : [texts];
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const targets = list.map(norm);

    const candidates = root.querySelectorAll(
      "a, button, span, div, li, p, h1, h2, h3, h4, [role='button'], [role='menuitem']"
    );
    for (const el of candidates) {
      const t = norm(el.innerText || el.textContent);
      if (!t) continue;
      if (targets.some((x) => t === x || t.includes(x))) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    }
    return null;
  }

  // Busca também dentro de iframes acessíveis (mesma origem)
  function findEverywhere(texts) {
    let el = findByText(texts, document);
    if (el) return el;
    const iframes = document.querySelectorAll("iframe");
    for (const f of iframes) {
      try {
        const doc = f.contentDocument;
        if (doc) {
          el = findByText(texts, doc);
          if (el) return el;
        }
      } catch (e) {
        // cross-origin: ignora
      }
    }
    return null;
  }

  async function waitFor(texts, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = findEverywhere(texts);
      if (el) return el;
      await sleep(400);
    }
    return null;
  }

  function clickEl(el) {
    el.scrollIntoView({ block: "center" });
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }

  async function step(label, texts, timeout = 15000) {
    log(`Procurando: ${label}`);
    const el = await waitFor(texts, timeout);
    if (!el) {
      alert(`[Siscomex Auto] Não encontrei: ${label}.\nVerifique se está logado e tente clicar manualmente.`);
      throw new Error(`não encontrado: ${label}`);
    }
    log(`Clicando: ${label}`, el);
    clickEl(el);
    await sleep(1200);
  }

  try {
    // 1. Importação (menu lateral)
    await step("Importação", ["Importação", "Importacao"]);
    // 2. Declaração Única de Importação / Declaração de Importação
    await step("Declaração Única de Importação", [
      "Declaração Única de Importação",
      "Declaração de Importação",
      "Declaracao Unica de Importacao",
      "Declaracao de Importacao",
    ]);
    // 3. Consultar Duimp
    await step("Consultar Duimp", ["Consultar Duimp", "Consultar DUIMP"]);
    log("✅ Fluxo concluído");
  } catch (e) {
    console.error("[Siscomex Auto] falhou:", e);
  } finally {
    window.__siscomexAutoRunning = false;
  }
})();