const Index = () => {
  const download = () => {
    fetch("/siscomex-auto.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Falha no download: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "siscomex-auto.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          🤖 Extensão Chrome • Manifest V3
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Siscomex Auto — Consultar Duimp
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Após você logar com certificado digital e confirmar o captcha no Portal Único,
          a extensão clica automaticamente em <strong>Importação → Declaração Única de
          Importação → Consultar Duimp</strong>.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={download}
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            ⬇️ Baixar extensão (.zip)
          </button>
        </div>

        <section className="mt-12 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Como instalar</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><strong className="text-foreground">1.</strong> Baixe e descompacte o arquivo <code className="rounded bg-muted px-1.5 py-0.5">siscomex-auto.zip</code>.</li>
            <li><strong className="text-foreground">2.</strong> Abra <code className="rounded bg-muted px-1.5 py-0.5">chrome://extensions</code> no navegador.</li>
            <li><strong className="text-foreground">3.</strong> Ative o <strong>Modo do desenvolvedor</strong> (canto superior direito).</li>
            <li><strong className="text-foreground">4.</strong> Clique em <strong>Carregar sem compactação</strong> e selecione a pasta descompactada.</li>
          </ol>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Como usar</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><strong className="text-foreground">1.</strong> Clique no ícone da extensão e em <strong>“Abrir Portal Único”</strong>.</li>
            <li><strong className="text-foreground">2.</strong> Faça login com o certificado e confirme o captcha.</li>
            <li><strong className="text-foreground">3.</strong> Volte ao popup e clique em <strong>“Ir até Consultar Duimp”</strong>.</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Observação: Duimp fica no menu <strong>Importação</strong> (não Exportação).
            Se algum item de menu não for encontrado, a extensão avisa para você clicar manualmente.
          </p>
        </section>
      </div>
    </main>
  );
};

export default Index;
