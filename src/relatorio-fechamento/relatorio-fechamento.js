/* =================================================
   NAGATORO — RELATÓRIO DO DIA (antes de fechar o grupo)
   - Guarda as mensagens de TEXTO do dia (quem mandou + texto), no máx. 400 por grupo.
   - Quando o horário automático (.fechar HH:MM ou cronômetro) vai fechar o grupo,
     a Nagatoro manda: CARD (top + assunto) e TEXTO (assuntos, quem mais falou, fofoca).
   - Funciona com a IA ligada ou desligada no grupo (usa a mesma IA grátis/chaves).
   - Desligar no config (opcional): RELATORIO_FECHAR: false
================================================= */

const fs = require("fs");
const path = require("path");
const config = require("../../config");

const ARQ = path.join(__dirname, "../dados/relatorio-fechamento.json");
const MAX_MSGS = 400;

function hoje() {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dataBR(iso) { const [a, m, d] = String(iso).split("-"); return `${d}/${m}/${a}`; }
function horaBR() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); }

let db = {};
try { if (fs.existsSync(ARQ)) db = JSON.parse(fs.readFileSync(ARQ, "utf8")) || {}; } catch { db = {}; }
let sujo = false;
setInterval(() => { if (!sujo) return; sujo = false; try { fs.writeFileSync(ARQ, JSON.stringify(db)); } catch {} }, 30000).unref?.();
function salvarAgora() { sujo = false; try { fs.writeFileSync(ARQ, JSON.stringify(db)); } catch {} }

function dia(grupo) {
    if (!db[grupo] || db[grupo].data !== hoje()) db[grupo] = { data: hoje(), nomes: {}, msgs: [] };
    return db[grupo];
}

/** chamado pra cada mensagem do grupo */
function registrarTextoRelatorio(msg, grupo, autor, body) {
    try {
        if (!grupo?.endsWith("@g.us") || msg?.key?.fromMe) return;
        const texto = String(body || "").replace(/\s+/g, " ").trim();
        if (!texto || texto.startsWith(config.PREFIX) || texto.length < 2) return;
        const d = dia(grupo);
        const j = String(autor || "");
        if (msg.pushName) d.nomes[j] = String(msg.pushName).slice(0, 40);
        d.msgs.push({ j, t: texto.slice(0, 160), h: horaBR() });
        if (d.msgs.length > MAX_MSGS) d.msgs.splice(0, d.msgs.length - MAX_MSGS);
        sujo = true;
    } catch {}
}

function numeroDe(j) { return String(j || "").split("@")[0].split(":")[0]; }

function nomeDe(d, meta, j) {
    if (d.nomes[j]) return d.nomes[j];
    const p = (meta?.participants || []).find(x => [x.id, x.lid, x.jid, x.phoneNumber].filter(Boolean).some(v => String(v) === j));
    const n = String(p?.notify || p?.name || "").trim();
    return n || `+${numeroDe(j)}`;
}

function lerJSON(t) {
    if (!t) return null;
    const m = String(t).match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
}

async function analisarComIA(d, meta) {
    let chamarIA;
    try { ({ chamarIA } = require("../nagatoro-ia/nagatoro-ia")); } catch { return null; }
    let conversa = d.msgs.map(m => `[${m.h}] ${nomeDe(d, meta, m.j)}: ${m.t}`).join("\n");
    if (conversa.length > 14000) conversa = conversa.slice(-14000);
    const sistema =
        "Você é a Nagatoro, bot de WhatsApp debochada e provocadora, e hoje é a repórter do grupo. " +
        "Leia as mensagens do dia e faça o relatório. Responda SOMENTE com um JSON válido, sem texto fora dele, no formato: " +
        '{"assunto":"assunto mais comentado em até 6 palavras","assuntos":["até 4 assuntos do dia, curtos"],' +
        '"fofoca":"a fofoca do dia em 2 a 4 frases, citando os nomes de quem falou o quê (vazio se não teve fofoca)",' +
        '"destaque":"nome de quem mais animou o grupo","fechamento":"1 frase debochada de boa noite pro grupo"}. ' +
        "Regras: use só o que está nas mensagens, não invente nada. Nunca coloque número de telefone, endereço, CPF, senha ou dado pessoal. " +
        "Fofoca é só o que rolou no grupo (brigas, indiretas, casais, dramas), em tom de zoeira, sem humilhar ninguém por aparência, raça, religião ou orientação. " +
        (!String(config.ESPOSA_NOME || "").trim() ? "" : `${String(config.ESPOSA_NOME).trim()} é a esposa do criador do bot (a rainha): nunca faça fofoca, deboche ou piada sobre ela; se ela aparecer, fale dela com carinho e respeito. `) +
        "Escreva em português do Brasil.";
    const tentar = async () => lerJSON(await chamarIA([
        { role: "system", content: sistema },
        { role: "user", content: `Grupo: ${meta?.subject || "Grupo"}\nMensagens de hoje:\n${conversa}` },
    ], config.AI_MODEL));
    try {
        return await Promise.race([tentar(), new Promise(r => setTimeout(() => r(null), 120000))]);
    } catch { return null; }
}

/** troca nomes conhecidos por @número (pra marcar), devolve { texto, mentions } */
function marcarNomes(texto, d, meta, top) {
    let t = String(texto || ""); const mentions = new Set();
    const pessoas = top.map(([j]) => ({ j, nome: nomeDe(d, meta, j) }))
        .concat(Object.entries(d.nomes).map(([j, nome]) => ({ j, nome })))
        .filter(p => p.nome && p.nome.length >= 3 && !p.nome.startsWith("+"))
        .sort((a, b) => b.nome.length - a.nome.length);
    const feitos = new Set();
    for (const p of pessoas) {
        if (feitos.has(p.nome.toLowerCase())) continue; feitos.add(p.nome.toLowerCase());
        const re = new RegExp(p.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        if (re.test(t)) { t = t.replace(re, `@${numeroDe(p.j)}`); mentions.add(p.j); }
    }
    return { texto: t, mentions: [...mentions] };
}

// .relatorio — mostra o relatório do dia ATÉ AGORA (qualquer membro, 1 vez a cada 3 min por grupo)
const _ultimoAgora = new Map();
async function cmdRelatorioAgora(sock, msg) {
    const grupo = msg?.key?.remoteJid;
    if (!grupo?.endsWith("@g.us")) return sock.sendMessage(grupo, { text: "📰 O relatório do dia só funciona em grupo." }, { quoted: msg });
    const falta = 180000 - (Date.now() - (_ultimoAgora.get(grupo) || 0));
    if (falta > 0) return sock.sendMessage(grupo, { text: `⏳ Calma, acabei de fazer um relatório. Tenta de novo em ${Math.ceil(falta / 60000)} min~` }, { quoted: msg });
    _ultimoAgora.set(grupo, Date.now());
    await sock.sendMessage(grupo, { text: "📰 Lendo tudo que rolou hoje… espera aí, senpai~" }, { quoted: msg }).catch(() => {});
    return enviarRelatorioFechamento(sock, grupo, { agora: true, quoted: msg });
}

const t = (x) => `> ❲ ⛮ ❳  ${x}  ❲ ⛮ ❳`;

/** chamado pelo horário automático ANTES de fechar */
async function enviarRelatorioFechamento(sock, grupo, { agora = false, quoted } = {}) {
    if (!agora && config.RELATORIO_FECHAR === false) return;
    const op = quoted ? { quoted } : {};
    const d = dia(grupo);
    let meta = null;
    try { meta = await sock.groupMetadata(grupo); } catch {}
    let stats = null;
    try { stats = require("../relatorio/relatorio").obterStats(grupo); } catch {}
    const usarStats = stats?.usuarios && (stats.mensagens || 0) >= d.msgs.length && Object.keys(stats.usuarios).length;
    const contagem = usarStats ? stats.usuarios : d.msgs.reduce((o, m) => (o[m.j] = (o[m.j] || 0) + 1, o), {});
    const total = usarStats ? stats.mensagens : d.msgs.length;
    const top = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    if (!total) {
        await sock.sendMessage(grupo, { text: `${t("ʀᴇʟᴀᴛᴏ́ʀɪᴏ ᴅᴏ ᴅɪᴀ")}\n\n> 📅 ${dataBR(hoje())}${agora ? ` · ⏰ até ${horaBR()}` : ""}\n\nDia parado. Ninguém falou nada hoje… que grupo morto, hein~ 🙄` }, op).catch(() => {});
        return;
    }

    const ia = d.msgs.length >= 5 ? await analisarComIA(d, meta) : null;

    // 🖼️ card
    try {
        let foto = null;
        try { foto = await require("../cardGenerator/cardGenerator").baixarBuffer(await sock.profilePictureUrl(grupo, "image")); } catch {}
        const { criarCardRelatorio } = require("../cards-nagatoro/cards-nagatoro");
        const img = await criarCardRelatorio({
            fotoGrupoBuffer: foto, nomeGrupo: meta?.subject || "Grupo", data: dataBR(hoje()),
            total, pessoas: top.length, assunto: ia?.assunto,
            lista: top.slice(0, 4).map(([j, qtd]) => ({ nome: nomeDe(d, meta, j), qtd })),
        });
        await sock.sendMessage(grupo, { image: img, caption: `📰 Relatório do dia — ${meta?.subject || "Grupo"}${agora ? ` · até ${horaBR()}` : ""}` }, op);
    } catch (e) { console.error("⚠️ relatório: card falhou:", e?.message || e); }

    // 📝 texto
    const medalhas = ["🥇", "🥈", "🥉"];
    const mentions = new Set();
    const linhasTop = top.slice(0, 5).map(([j, q], i) => { mentions.add(j); return `> ${medalhas[i] || "🏅"} @${numeroDe(j)} — ${q} msg`; });
    const partes = [
        t("ʀᴇʟᴀᴛᴏ́ʀɪᴏ ᴅᴏ ᴅɪᴀ"),
        `> 📅 ${dataBR(hoje())} · ${agora ? `⏰ até agora (${horaBR()})` : "🔒 o grupo vai fechar"}`,
        `> 💬 ${total} mensagens · 👥 ${top.length} pessoas falaram`,
        "",
    ];
    const assuntos = Array.isArray(ia?.assuntos) ? ia.assuntos.filter(Boolean).slice(0, 4) : [];
    if (assuntos.length) partes.push("💬 *Assuntos do dia:*", ...assuntos.map(a => `> ❀ ${String(a).slice(0, 80)}`), "");
    partes.push("🗣️ *Quem mais falou:*", ...linhasTop, "");
    if (ia?.destaque) { const m = marcarNomes(String(ia.destaque).slice(0, 60), d, meta, top); m.mentions.forEach(x => mentions.add(x)); partes.push(`👑 *Destaque do dia:* ${m.texto}`, ""); }
    if (ia?.fofoca && String(ia.fofoca).trim()) {
        const m = marcarNomes(String(ia.fofoca).slice(0, 600), d, meta, top); m.mentions.forEach(x => mentions.add(x));
        partes.push("☕ *FOFOCA DO DIA:*", `> ${m.texto.replace(/\n+/g, "\n> ")}`, "");
    }
    if (!ia) partes.push("> 🤖 (a IA não respondeu agora, então hoje vai só os números)", "");
    partes.push(agora ? "O dia ainda não acabou… continuem que eu tô anotando tudo~ 👀" : (ia?.fechamento ? String(ia.fechamento).slice(0, 160) : "Boa noite, senpais. Amanhã eu abro de novo~ 🌙"));
    try {
        const { RODAPE_CRIADOR } = require("../boasvindas-mensagens/boasvindas-mensagens");
        if (RODAPE_CRIADOR) partes.push(`> ${RODAPE_CRIADOR}`);
    } catch {}
    await sock.sendMessage(grupo, { text: partes.join("\n"), mentions: [...mentions] }, op).catch(e => console.error("⚠️ relatório: texto falhou:", e?.message || e));

    if (agora) return; // relatório de agora não zera o dia
    // zera o dia desse grupo
    db[grupo] = { data: hoje(), nomes: {}, msgs: [] };
    salvarAgora();
}

module.exports = { registrarTextoRelatorio, enviarRelatorioFechamento, cmdRelatorioAgora };
