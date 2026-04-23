const PORTAL_URL = "https://portalunico.siscomex.gov.br/portal/";
const statusEl = () => document.getElementById("status");

function setStatus(msg, cls = "") {
  const el = statusEl();
  el.textContent = msg;
  el.className = cls;
}

document.getElementById("open").addEventListener("click", async () => {
  await chrome.tabs.create({ url: PORTAL_URL });
  setStatus("Aba aberta. Faça login com o certificado.", "ok");
});

document.getElementById("run").addEventListener("click", async () => {
  setStatus("Procurando aba do Portal Único...");
  const [tab] = await chrome.tabs.query({ url: "https://portalunico.siscomex.gov.br/*" });
  if (!tab) {
    setStatus("Nenhuma aba do Portal Único encontrada. Clique em 'Abrir Portal Único' primeiro.", "err");
    return;
  }
  await chrome.tabs.update(tab.id, { active: true });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["automation.js"],
    });
    setStatus("Automação iniciada. Acompanhe na aba do portal.", "ok");
  } catch (e) {
    setStatus("Erro: " + e.message, "err");
  }
});