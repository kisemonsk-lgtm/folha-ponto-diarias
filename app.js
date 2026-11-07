/* =========================================================
   Folha de Ponto — Diárias
   Regras de negócio + persistência local
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- constantes ---------------- */
  const CHAVE = "ponto-diarias-v1";
  const CHAVE_TEMA = "ponto-diarias-tema";
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const VALORES = {
    80: { integral: 80, meia: 40, rotulo: "R$ 80 / R$ 40" },
    100: { integral: 100, meia: 50, rotulo: "R$ 100 / R$ 50" }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- utilidades ---------------- */
  const pad = (n) => String(n).padStart(2, "0");

  function isoDe(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function hojeISO() { return isoDe(new Date()); }

  function parseISO(iso) {
    const [a, m, d] = String(iso).split("-").map(Number);
    return new Date(a, (m || 1) - 1, d || 1);
  }
  function validaISO(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) && !isNaN(parseISO(iso).getTime()); }

  function moeda(v) {
    const n = Number(v) || 0;
    return "R$ " + n.toFixed(2).replace(".", ",");
  }

  function dataLonga(iso) {
    const d = parseISO(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function addDias(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return isoDe(d);
  }

  function uid() {
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------------- estado ---------------- */
  function estadoInicial() {
    const ano = new Date().getFullYear();
    const mes = new Date().getMonth();
    const m = pad(mes + 1);
    // Registros iniciais: dia 5 meia diária e dia 6 integral, com valor antigo (R$ 40 / R$ 80)
    return {
      versao: 1,
      reajuste: ano + "-" + m + "-15", // data do reajuste (editável)
      valorPadrao: 80,
      registros: [
        { id: uid() + "a", data: ano + "-" + m + "-05", tipo: "meia", valor: 40, obs: "valor antigo" },
        { id: uid() + "b", data: ano + "-" + m + "-06", tipo: "integral", valor: 80, obs: "valor antigo" }
      ]
    };
  }

  function normalizar(d) {
    const base = estadoInicial();
    if (!d || typeof d !== "object") return base;
    const regs = Array.isArray(d.registros) ? d.registros : [];
    return {
      versao: 1,
      reajuste: validaISO(d.reajuste) ? d.reajuste : base.reajuste,
      valorPadrao: VALORES[d.valorPadrao] ? Number(d.valorPadrao) : 80,
      registros: regs
        .filter((r) => r && validaISO(r.data) && (r.tipo === "integral" || r.tipo === "meia"))
        .map((r) => ({
          id: r.id || uid(),
          data: r.data,
          tipo: r.tipo,
          valor: Number.isFinite(Number(r.valor)) ? Math.max(0, Number(r.valor)) : 0,
          obs: typeof r.obs === "string" ? r.obs : ""
        }))
    };
  }

  let estado = carregar();
  let editandoId = null;
  let mesFiltro = hojeISO().slice(0, 7);

  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) return normalizar(JSON.parse(bruto));
    } catch (e) { console.warn("Falha ao ler dados salvos", e); }
    const ini = estadoInicial();
    try { localStorage.setItem(CHAVE, JSON.stringify(ini)); } catch (e) { /* ignora */ }
    return ini;
  }

  let timerSalvar = null;
  function salvar(imediato) {
    clearTimeout(timerSalvar);
    const status = $("#statusSalvo");
    if (status) { status.textContent = "salvando…"; status.classList.add("pendente"); }
    const gravar = () => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(estado));
        if (status) { status.textContent = "tudo salvo neste aparelho"; status.classList.remove("pendente"); }
      } catch (e) {
        if (status) { status.textContent = "não foi possível salvar"; status.classList.remove("pendente"); }
        console.warn(e);
      }
    };
    if (imediato) gravar(); else timerSalvar = setTimeout(gravar, 250);
  }

  /* ---------------- períodos de pagamento ---------------- */
  // Ciclos de 15 dias que começam no dia 5: 05→19 e 20→04 do mês seguinte.
  function periodoDe(iso) {
    const d = parseISO(iso);
    const dia = d.getDate();
    let inicio;
    if (dia >= 5 && dia <= 19) {
      inicio = new Date(d.getFullYear(), d.getMonth(), 5);
    } else if (dia >= 20) {
      inicio = new Date(d.getFullYear(), d.getMonth(), 20);
    } else {
      inicio = new Date(d.getFullYear(), d.getMonth() - 1, 20);
    }
    const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 14);
    return { inicio: isoDe(inicio), fim: isoDe(fim) };
  }

  function nomePeriodo(p) {
    const i = parseISO(p.inicio), f = parseISO(p.fim);
    return pad(i.getDate()) + "/" + pad(i.getMonth() + 1) + " a " + pad(f.getDate()) + "/" + pad(f.getMonth() + 1) + "/" + f.getFullYear();
  }

  function periodosComTotais() {
    const mapa = new Map();
    estado.registros.forEach((r) => {
      const p = periodoDe(r.data);
      const chave = p.inicio;
      if (!mapa.has(chave)) mapa.set(chave, { inicio: p.inicio, fim: p.fim, total: 0, qtd: 0, integrais: 0, meias: 0 });
      const item = mapa.get(chave);
      item.total += r.valor;
      item.qtd += 1;
      if (r.tipo === "integral") item.integrais += 1; else item.meias += 1;
    });
    return Array.from(mapa.values()).sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  }

  function periodosOrdenadosCronologico() {
    return periodosComTotais().slice().sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  }

  /* ---------------- regra do valor vigente ---------------- */
  function valorPadraoPara(dataISO) {
    return dataISO >= estado.reajuste ? 100 : 80;
  }
  function valorSugerido(dataISO, tipo) {
    const base = valorPadraoPara(dataISO);
    return tipo === "meia" ? VALORES[base].meia : VALORES[base].integral;
  }

  /* ---------------- DOM refs ---------------- */
  const campoData = $("#campoData");
  const campoValor = $("#campoValor");
  const campoReajuste = $("#campoReajuste");
  const filtroMes = $("#filtroMes");
  const mensagem = $("#mensagem");

  let tipoSelecionado = "integral";
  let valorSelecionado = 80;

  /* ---------------- tema ---------------- */
  function aplicarTema(tema) {
    const raiz = document.documentElement;
    raiz.classList.add("trocando-tema");
    raiz.setAttribute("data-tema", tema);
    void raiz.offsetWidth; // força o repaint imediato
    setTimeout(() => raiz.classList.remove("trocando-tema"), 60);
    const botao = $("#btnTema");
    const escuro = tema === "escuro";
    $(".tema-icone", botao).textContent = escuro ? "☀️" : "🌙";
    $(".tema-texto", botao).textContent = escuro ? "Claro" : "Escuro";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", escuro ? "#0b1d18" : "#0f6b52");
    try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) { /* ignora */ }
  }

  function temaInicial() {
    let t = null;
    try { t = localStorage.getItem(CHAVE_TEMA); } catch (e) { /* ignora */ }
    if (t === "claro" || t === "escuro") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  }

  /* ---------------- mensagens ---------------- */
  let timerMsg = null;
  function avisar(texto, erro) {
    clearTimeout(timerMsg);
    mensagem.textContent = texto;
    mensagem.classList.toggle("erro", !!erro);
    mensagem.hidden = false;
    timerMsg = setTimeout(() => { mensagem.hidden = true; }, 3200);
  }

  /* ---------------- seleções ---------------- */
  function marcarValor(v) {
    valorSelecionado = Number(v);
    $$(".opcao-valor").forEach((b) => {
      const sel = Number(b.dataset.valor) === valorSelecionado;
      b.classList.toggle("selecionado", sel);
      b.setAttribute("aria-checked", sel ? "true" : "false");
    });
    $("#subIntegral").textContent = moeda(VALORES[valorSelecionado].integral);
    $("#subMeia").textContent = moeda(VALORES[valorSelecionado].meia);
    estado.valorPadrao = valorSelecionado;
    salvar();
    if (!editandoId) campoValor.value = valorSugerido(campoData.value, tipoSelecionado).toFixed(2);
    atualizarAvisoValor();
  }

  function marcarTipo(t) {
    tipoSelecionado = t;
    $$(".opcao-tipo").forEach((b) => {
      const sel = b.dataset.tipo === t;
      b.classList.toggle("selecionado", sel);
      b.setAttribute("aria-checked", sel ? "true" : "false");
    });
    if (!editandoId) campoValor.value = valorSugerido(campoData.value, t).toFixed(2);
    atualizarAvisoValor();
  }

  function atualizarAvisoValor() {
    const aviso = $("#avisoValor");
    const v = Number(campoValor.value);
    const sugerido = valorSugerido(campoData.value, tipoSelecionado);
    if (!campoValor.value || !Number.isFinite(v)) { aviso.hidden = true; return; }
    if (Math.abs(v - sugerido) > 0.001) {
      aviso.textContent = "Valor diferente do padrão (" + moeda(sugerido) + "). Está correto?";
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }
  }

  /* ---------------- render: resumo ---------------- */
  function renderResumo() {
    const regs = estado.registros;
    const total = regs.reduce((s, r) => s + r.valor, 0);
    const integrais = regs.filter((r) => r.tipo === "integral").length;
    const meias = regs.filter((r) => r.tipo === "meia").length;

    $("#totalGeral").textContent = moeda(total);
    $("#resumoIntegral").textContent = integrais;
    $("#resumoMeia").textContent = meias;
    $("#resumoDias").textContent = regs.length;
    $("#resumoQtd").textContent = regs.length === 0
      ? "nenhum dia registrado"
      : regs.length + (regs.length === 1 ? " dia registrado" : " dias registrados");
    $("#contadorRegistros").textContent = regs.length;
  }

  /* ---------------- render: períodos ---------------- */
  function renderPeriodos() {
    const alvo = $("#listaPeriodos");
    const lista = periodosComTotais();
    alvo.innerHTML = "";
    if (!lista.length) {
      alvo.innerHTML = '<div class="vazio">Nenhum período com registros ainda.</div>';
      return;
    }
    const hoje = hojeISO();
    const atual = periodoDe(hoje).inicio;
    lista.forEach((p) => {
      const div = document.createElement("div");
      div.className = "periodo" + (p.inicio === atual ? " atual" : "");
      div.innerHTML =
        '<div class="periodo-info">' +
          '<span class="periodo-nome">' + nomePeriodo(p) + "</span>" +
          '<span class="periodo-detalhe">' + p.qtd + (p.qtd === 1 ? " dia" : " dias") +
            " · " + p.integrais + " integral(is) · " + p.meias + " meia(s)</span>" +
        "</div>" +
        '<span class="periodo-valor">' + moeda(p.total) + "</span>";
      alvo.appendChild(div);
    });
  }

  /* ---------------- render: filtro mês ---------------- */
  function mesesDisponiveis() {
    const set = new Set();
    estado.registros.forEach((r) => set.add(r.data.slice(0, 7)));
    set.add(hojeISO().slice(0, 7));
    set.add(mesFiltro);
    return Array.from(set).sort().reverse();
  }

  function renderFiltroMes() {
    const meses = mesesDisponiveis();
    if (!meses.includes(mesFiltro)) meses.push(mesFiltro);
    meses.sort().reverse();
    filtroMes.innerHTML = "";
    meses.forEach((m) => {
      const [a, mm] = m.split("-");
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = MESES_CURTO[Number(mm) - 1] + " / " + a;
      filtroMes.appendChild(opt);
    });
    filtroMes.value = mesFiltro;
  }

  /* ---------------- render: registros ---------------- */
  function renderRegistros() {
    const alvo = $("#listaRegistros");
    alvo.innerHTML = "";

    const regs = estado.registros
      .filter((r) => r.data.slice(0, 7) === mesFiltro)
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

    if (!regs.length) {
      alvo.innerHTML = '<div class="vazio">Nenhum registro neste mês.<br>Use o formulário acima para adicionar.</div>';
      return;
    }

    regs.forEach((r) => {
      const d = parseISO(r.data);
      const p = periodoDe(r.data);
      const base = valorPadraoPara(r.data);
      const padrao = valorSugerido(r.data, r.tipo);
      const fora = Math.abs(r.valor - padrao) > 0.001;

      const div = document.createElement("div");
      div.className = "registro";
      div.innerHTML =
        '<div class="registro-data">' +
          '<span class="registro-dia">' + pad(d.getDate()) + "</span>" +
          '<span class="registro-mes">' + MESES_CURTO[d.getMonth()] + "</span>" +
        "</div>" +
        '<div class="registro-corpo">' +
          '<span class="registro-tipo">' + (r.tipo === "integral" ? "Dia integral" : "Meia diária") + "</span>" +
          '<span class="registro-meta">' + SEMANA[d.getDay()] + " · período " + nomePeriodo(p) +
            (r.obs ? " · " + r.obs : "") + (fora ? " · valor ajustado" : "") +
            " · tabela R$ " + base + "</span>" +
        "</div>" +
        '<span class="registro-valor">' + moeda(r.valor) + "</span>" +
        '<div class="registro-acoes">' +
          '<button class="acao editar" type="button" data-acao="editar" data-id="' + r.id + '" aria-label="Editar registro de ' + dataLonga(r.data) + '">✏️</button>' +
          '<button class="acao excluir" type="button" data-acao="excluir" data-id="' + r.id + '" aria-label="Excluir registro de ' + dataLonga(r.data) + '">🗑️</button>' +
        "</div>";
      alvo.appendChild(div);
    });
  }

  function renderTudo() {
    renderResumo();
    renderPeriodos();
    renderFiltroMes();
    renderRegistros();
  }

  /* ---------------- formulário ---------------- */
  function limparFormulario() {
    editandoId = null;
    $("#tituloForm").textContent = "Registrar ponto";
    $("#btnSalvar").textContent = "Adicionar registro";
    $("#btnCancelar").hidden = true;
    campoData.value = hojeISO();
    marcarValor(valorPadraoPara(campoData.value));
    marcarTipo("integral");
    campoValor.value = valorSugerido(campoData.value, "integral").toFixed(2);
    atualizarAvisoValor();
  }

  function iniciarEdicao(id) {
    const r = estado.registros.find((x) => x.id === id);
    if (!r) return;
    editandoId = id;
    $("#tituloForm").textContent = "Editando registro de " + dataLonga(r.data);
    $("#btnSalvar").textContent = "Salvar alterações";
    $("#btnCancelar").hidden = false;
    campoData.value = r.data;
    tipoSelecionado = r.tipo;
    $$(".opcao-tipo").forEach((b) => {
      const sel = b.dataset.tipo === r.tipo;
      b.classList.toggle("selecionado", sel);
      b.setAttribute("aria-checked", sel ? "true" : "false");
    });
    campoValor.value = Number(r.valor).toFixed(2);
    atualizarAvisoValor();
    $(".cartao[aria-label='Registrar ponto']").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function salvarFormulario() {
    const data = campoData.value;
    if (!validaISO(data)) { avisar("Escolha uma data válida.", true); return; }

    let valor = Number(String(campoValor.value).replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      valor = valorSugerido(data, tipoSelecionado);
    }
    valor = Math.round(valor * 100) / 100;

    if (editandoId) {
      const r = estado.registros.find((x) => x.id === editandoId);
      if (r) {
        r.data = data;
        r.tipo = tipoSelecionado;
        r.valor = valor;
        r.obs = valor === valorSugerido(data, tipoSelecionado)
          ? (valorPadraoPara(data) === 80 ? "valor antigo" : "valor reajustado")
          : "valor personalizado";
      }
      salvar(true);
      avisar("Registro atualizado: " + dataLonga(data) + " · " + moeda(valor));
      limparFormulario();
      mesFiltro = data.slice(0, 7);
      renderTudo();
      return;
    }

    // novo registro — evita duplicar a mesma data
    const existente = estado.registros.find((x) => x.data === data);
    if (existente) {
      avisar("Já existe um registro em " + dataLonga(data) + ". Editando esse registro.", true);
      mesFiltro = data.slice(0, 7);
      renderTudo();
      iniciarEdicao(existente.id);
      return;
    }

    estado.registros.push({
      id: uid(),
      data,
      tipo: tipoSelecionado,
      valor,
      obs: valorPadraoPara(data) === 80 ? "valor antigo" : "valor reajustado"
    });
    salvar(true);
    avisar("Registrado: " + dataLonga(data) + " · " + (tipoSelecionado === "integral" ? "dia integral" : "meia diária") + " · " + moeda(valor));
    mesFiltro = data.slice(0, 7);
    campoValor.value = valorSugerido(data, tipoSelecionado).toFixed(2);
    renderTudo();
  }

  function excluir(id) {
    const r = estado.registros.find((x) => x.id === id);
    if (!r) return;
    const ok = window.confirm("Excluir o registro de " + dataLonga(r.data) + " (" + (r.tipo === "integral" ? "dia integral" : "meia diária") + " · " + moeda(r.valor) + ")?");
    if (!ok) return;
    estado.registros = estado.registros.filter((x) => x.id !== id);
    if (editandoId === id) limparFormulario();
    salvar(true);
    renderTudo();
    avisar("Registro excluído.");
  }

  /* ---------------- relatório ---------------- */
  function textoRelatorio() {
    const linhas = [];
    const larg = 44;
    const linha = "=".repeat(larg);
    linhas.push(linha);
    linhas.push("FOLHA DE PONTO — DIÁRIAS");
    linhas.push("Gerado em " + dataLonga(hojeISO()));
    linhas.push("Reajuste aplicado a partir de " + dataLonga(estado.reajuste));
    linhas.push(linha);
    linhas.push("");

    const periodos = periodosOrdenadosCronologico();
    periodos.forEach((p) => {
      linhas.push("PERÍODO " + nomePeriodo(p));
      linhas.push("-".repeat(larg));
      const regs = estado.registros
        .filter((r) => periodoDe(r.data).inicio === p.inicio)
        .sort((a, b) => (a.data < b.data ? -1 : 1));
      regs.forEach((r) => {
        const tipo = r.tipo === "integral" ? "Dia integral" : "Meia diária";
        const esq = "  " + dataLonga(r.data) + "  " + tipo.padEnd(14, " ");
        linhas.push(esq + moeda(r.valor).padStart(larg - esq.length, " "));
      });
      linhas.push("  " + "Subtotal do período".padEnd(28, " ") + moeda(p.total).padStart(larg - 30, " "));
      linhas.push("");
    });

    const total = estado.registros.reduce((s, r) => s + r.valor, 0);
    linhas.push(linha);
    linhas.push("  TOTAL A RECEBER".padEnd(28, " ") + moeda(total).padStart(larg - 18, " "));
    linhas.push("  " + estado.registros.length + " dia(s) registrado(s) · " +
      estado.registros.filter((r) => r.tipo === "integral").length + " integral(is) · " +
      estado.registros.filter((r) => r.tipo === "meia").length + " meia(s)");
    linhas.push(linha);
    return linhas.join("\n");
  }

  function baixar(nome, conteudo, tipo) {
    try {
      const blob = new Blob([conteudo], { type: tipo });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
      avisar("Arquivo " + nome + " gerado. Confira a pasta de downloads do aparelho.");
    } catch (e) {
      console.warn(e);
      avisar("Não foi possível gerar o arquivo neste navegador.", true);
    }
  }

  function gerarRelatorioTxt() {
    baixar("folha-ponto-" + hojeISO() + ".txt", "\uFEFF" + textoRelatorio(), "text/plain;charset=utf-8");
  }

  function gerarCsv() {
    const linhas = ["Data;Tipo;Valor;Periodo;Observacao"];
    estado.registros
      .slice()
      .sort((a, b) => (a.data < b.data ? -1 : 1))
      .forEach((r) => {
        const p = periodoDe(r.data);
        linhas.push([
          dataLonga(r.data),
          r.tipo === "integral" ? "Dia integral" : "Meia diária",
          moeda(r.valor).replace("R$ ", ""),
          nomePeriodo(p),
          r.obs || ""
        ].join(";"));
      });
    const total = estado.registros.reduce((s, r) => s + r.valor, 0);
    linhas.push("");
    linhas.push("TOTAL;;;;" + moeda(total).replace("R$ ", ""));
    baixar("folha-ponto-" + hojeISO() + ".csv", "\uFEFF" + linhas.join("\r\n"), "text/csv;charset=utf-8");
  }

  /* ---------------- backup ---------------- */
  function exportarBackup() {
    baixar("backup-folha-ponto-" + hojeISO() + ".json", JSON.stringify(estado, null, 2), "application/json");
  }

  function importarBackup(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const dados = JSON.parse(String(leitor.result));
        if (!dados || !Array.isArray(dados.registros)) throw new Error("formato inválido");
        if (!window.confirm("Substituir todos os dados atuais pelo backup?")) return;
        estado = normalizar(dados);
        salvar(true);
        campoReajuste.value = estado.reajuste;
        marcarValor(estado.valorPadrao);
        renderTudo();
        avisar("Backup restaurado: " + estado.registros.length + " registro(s).");
      } catch (e) {
        avisar("Arquivo de backup inválido.", true);
      }
    };
    leitor.readAsText(arquivo);
  }

  /* ---------------- eventos ---------------- */
  function ligarEventos() {
    $("#btnTema").addEventListener("click", () => {
      const atual = document.documentElement.getAttribute("data-tema");
      aplicarTema(atual === "escuro" ? "claro" : "escuro");
    });

    $$(".opcao-valor").forEach((b) => b.addEventListener("click", () => marcarValor(b.dataset.valor)));
    $$(".opcao-tipo").forEach((b) => b.addEventListener("click", () => marcarTipo(b.dataset.tipo)));

    campoData.addEventListener("change", () => {
      if (!editandoId) {
        const padrao = valorPadraoPara(campoData.value);
        if (padrao !== valorSelecionado) marcarValor(padrao);
        campoValor.value = valorSugerido(campoData.value, tipoSelecionado).toFixed(2);
      }
      atualizarAvisoValor();
    });

    campoValor.addEventListener("input", atualizarAvisoValor);

    $("#btnSugerir").addEventListener("click", () => {
      campoValor.value = valorSugerido(campoData.value, tipoSelecionado).toFixed(2);
      atualizarAvisoValor();
    });

    $("#btnSalvar").addEventListener("click", salvarFormulario);
    $("#btnCancelar").addEventListener("click", () => { limparFormulario(); avisar("Edição cancelada."); });

    $("#listaRegistros").addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-acao]");
      if (!b) return;
      if (b.dataset.acao === "editar") iniciarEdicao(b.dataset.id);
      if (b.dataset.acao === "excluir") excluir(b.dataset.id);
    });

    filtroMes.addEventListener("change", () => { mesFiltro = filtroMes.value; renderRegistros(); });

    $("#btnMesAnterior").addEventListener("click", () => mudarMes(-1));
    $("#btnMesProximo").addEventListener("click", () => mudarMes(1));

    campoReajuste.addEventListener("change", () => {
      if (!validaISO(campoReajuste.value)) { avisar("Data de reajuste inválida.", true); return; }
      estado.reajuste = campoReajuste.value;
      salvar(true);
      if (!editandoId) {
        marcarValor(valorPadraoPara(campoData.value));
        campoValor.value = valorSugerido(campoData.value, tipoSelecionado).toFixed(2);
      }
      renderRegistros();
      avisar("Reajuste definido para " + dataLonga(estado.reajuste) + ".");
    });

    $("#btnRelatorio").addEventListener("click", gerarRelatorioTxt);
    $("#btnCsv").addEventListener("click", gerarCsv);
    $("#btnImprimir").addEventListener("click", () => window.print());

    $("#btnBackup").addEventListener("click", exportarBackup);
    $("#btnRestaurar").addEventListener("click", () => $("#arquivoBackup").click());
    $("#arquivoBackup").addEventListener("change", (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (f) importarBackup(f);
      ev.target.value = "";
    });
  }

  function mudarMes(delta) {
    const [a, m] = mesFiltro.split("-").map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    mesFiltro = d.getFullYear() + "-" + pad(d.getMonth() + 1);
    renderFiltroMes();
    renderRegistros();
  }

  /* ---------------- inicialização ---------------- */
  function iniciar() {
    aplicarTema(temaInicial());
    campoReajuste.value = estado.reajuste;
    ligarEventos();
    limparFormulario();
    marcarValor(estado.valorPadrao);
    renderTudo();
    const status = $("#statusSalvo");
    status.textContent = "tudo salvo neste aparelho";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
