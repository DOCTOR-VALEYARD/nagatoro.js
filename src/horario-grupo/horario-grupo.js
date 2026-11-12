/* =================================================
   ⏰ NAGATORO — ABRIR / FECHAR O GRUPO NO HORÁRIO (automático)
   📁 Arquivo: horario-grupo.js

   Todo dia (horário de Brasília):
     <prefixo>fechar 00:00     → fecha todo dia à meia-noite
     <prefixo>abrir 06:00      → abre todo dia às 6h
     aceita: 00:00 · 00.00 · 0h · 23h30 · meia-noite · meio-dia
   Cronômetro (uma vez só):
     <prefixo>fechar 30min     → fecha daqui a 30 minutos
     <prefixo>abrir 2horas     → abre daqui a 2 horas   (também: +2h, 1h30min)
   Ver / cancelar:
     <prefixo>horario          → mostra o que está agendado
     <prefixo>fechar off · <prefixo>abrir off · <prefixo>horario off (tudo)
   Sem nada depois (<prefixo>fechar / <prefixo>abrir) continua abrindo/fechando NA HORA.
   Só ADM usa. O bot precisa ser ADM pra conseguir abrir/fechar.
================================================= */
const fs = require("fs");
const path = require("path");
const config = require("../../config");

const ARQ = path.join(__dirname, "../../database/horario-grupo.json");
const TOLERANCIA_MIN = 15; // se o bot estava fora no minuto exato, ainda executa até 15 min depois

let sockAtual = null, intervalo = null;

function ler() { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return {}; } }
function salvar(db) { try { fs.mkdirSync(path.dirname(ARQ), { recursive: true }); fs.writeFileSync(ARQ, JSON.stringify(db, null, 2)); } catch {} }

// hora atual em Brasília
function agoraBR() {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
        .formatToParts(new Date()).map(x => [x.type, x.value]));
    const h = Number(p.hour) % 24, m = Number(p.minute);
    return { dia: `${p.year}-${p.month}-${p.day}`, min: h * 60 + m };
}
const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Lê o que a pessoa digitou. Retorna { tipo:'diario', min } | { tipo:'timer', ms } | { tipo:'off' } | null */
function interpretar(args) {
    const t = args.join(" ").trim().toLowerCase().replace(/\s+/g, " ");
    if (!t) return null;
    if (/^(off|cancelar|desligar|remover|0ff)$/.test(t)) return { tipo: "off" };
    if (/^meia[\s-]?noite$/.test(t)) return { tipo: "diario", min: 0 };
    if (/^meio[\s-]?dia$/.test(t)) return { tipo: "diario", min: 12 * 60 };
    // cronômetro: 30min · 2horas · +2h · em 1h30 · 1h30min · 90m
    const rel = t.match(/^(?:\+|em |daqui(?: a)? )?\s*(?:(\d+)\s*(?:h|hora|horas))?\s*(?:(\d+)\s*(?:m|min|mins|minuto|minutos))?$/);
    const ehRelativo = /^(\+|em |daqui)/.test(t) || /(min|minuto|hora)/.test(t) || /^\d+m$/.test(t);
    if (rel && ehRelativo && (rel[1] || rel[2])) {
        const ms = ((Number(rel[1] || 0) * 60) + Number(rel[2] || 0)) * 60000;
        if (ms >= 60000 && ms <= 7 * 86400000) return { tipo: "timer", ms };
    }
    // horário do dia: 00:00 · 00.00 · 0h · 23h30 · 2330
    const hm = t.match(/^(\d{1,2})(?:\s*[:.h]\s*(\d{2})?)?\s*(?:h)?$/) || t.match(/^(\d{2})(\d{2})$/);
    if (hm) {
        const h = Number(hm[1]), m = Number(hm[2] || 0);
        if (h <= 23 && m <= 59) return { tipo: "diario", min: h * 60 + m };
        if (h === 24 && m === 0) return { tipo: "diario", min: 0 };
    }
    return null;
}

const FRASE_FECHAR = ["Hora de dormir, bando de coruja 😴", "Fechei. Vão viver a vida real um pouco 🙄", "Silêncio no grupo. Finalmente paz~ 😌", "Grupo fechado. Quem quiser chorar, chora no PV 😏"];
const FRASE_ABRIR = ["Acordem! O grupo tá aberto de novo ☀️", "Liberado. Podem voltar a falar besteira 😏", "Grupo aberto. Comportem-se (sei que não vão) 🙄", "Bom dia, fantasminhas. Pode falar~ 👻"];
const sortear = (l) => l[Math.floor(Math.random() * l.length)];

async function executar(sock, grupo, acao, motivo) {
    // 📰 relatório do dia antes de fechar (src/relatorio-fechamento)
    if (acao === "fechar") { try { await require("../relatorio-fechamento/relatorio-fechamento").enviarRelatorioFechamento(sock, grupo); } catch (e) { console.error("⚠️ relatório do dia falhou:", e?.message || e); } }
    try {
        await sock.groupSettingUpdate(grupo, acao === "fechar" ? "announcement" : "not_announcement");
        const g = ler()[grupo] || {};
        const prox = acao === "fechar" ? (Number.isFinite(g.abrir) ? `\n🔓 Abre às ${fmt(g.abrir)}` : "") : (Number.isFinite(g.fechar) ? `\n🔒 Fecha às ${fmt(g.fechar)}` : "");
        await sock.sendMessage(grupo, {
            text: acao === "fechar"
                ? `〔 🔒 ɢʀᴜᴘᴏ ꜰᴇᴄʜᴀᴅᴏ 〕\n\n⏰ ${motivo}\n${sortear(FRASE_FECHAR)}${prox}\n\n🧣 ${config.BOT_NAME}`
                : `〔 🔓 ɢʀᴜᴘᴏ ᴀʙᴇʀᴛᴏ 〕\n\n⏰ ${motivo}\n${sortear(FRASE_ABRIR)}${prox}\n\n🧣 ${config.BOT_NAME}`
        });
        return true;
    } catch (e) {
        console.error(`⚠️ horário: não consegui ${acao} ${grupo}:`, e?.message || e);
        return false;
    }
}

// roda a cada 20 s
let verificando = false;
async function verificar() {
    if (verificando) return; verificando = true;
    try { await verificarAgora(); } finally { verificando = false; }
}
async function verificarAgora() {
    const sock = sockAtual; if (!sock) return;
    const db = ler(); if (!Object.keys(db).length) return;
    const { dia, min } = agoraBR(); const agora = Date.now(); let mudou = false;
    for (const [grupo, g] of Object.entries(db)) {
        for (const acao of ["fechar", "abrir"]) {
            // todo dia
            const alvo = g[acao];
            if (Number.isFinite(alvo) && g["feito_" + acao] !== dia) {
                const passou = (min - alvo + 1440) % 1440;
                if (passou <= TOLERANCIA_MIN) {
                    g["feito_" + acao] = dia; mudou = true;
                    await executar(sock, grupo, acao, `Horário automático (${fmt(alvo)})`);
                }
            }
            // cronômetro
            const tm = g["timer_" + acao];
            if (tm && agora >= tm) {
                delete g["timer_" + acao]; mudou = true;
                await executar(sock, grupo, acao, "Cronômetro terminou");
            }
        }
        if (!Number.isFinite(g.fechar) && !Number.isFinite(g.abrir) && !g.timer_fechar && !g.timer_abrir) { delete db[grupo]; mudou = true; }
    }
    if (mudou) salvar(db);
}

/** Chamado quando o bot conecta (passa o sock novo). */
function iniciarHorarios(sock) {
    sockAtual = sock;
    if (!intervalo) { intervalo = setInterval(() => verificar().catch(() => {}), 20000); intervalo.unref?.(); }
}

function textoAgenda(g) {
    if (!g) return "Nenhum horário agendado neste grupo.";
    const l = [];
    if (Number.isFinite(g.fechar)) l.push(`🔒 Fecha todo dia às *${fmt(g.fechar)}*`);
    if (Number.isFinite(g.abrir)) l.push(`🔓 Abre todo dia às *${fmt(g.abrir)}*`);
    const restante = (t) => { const m = Math.max(1, Math.round((t - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`; };
    if (g.timer_fechar) l.push(`⏳ Fecha em *${restante(g.timer_fechar)}* (cronômetro)`);
    if (g.timer_abrir) l.push(`⏳ Abre em *${restante(g.timer_abrir)}* (cronômetro)`);
    return l.length ? l.join("\n") : "Nenhum horário agendado neste grupo.";
}

/**
 * .abrir/.fechar COM argumento, e .horario.
 * Retorna false quando não tem argumento (aí o grupo.js abre/fecha na hora, como sempre).
 */
async function cmdHorario(sock, msg, command, args, { userAdmin, botAdmin } = {}) {
    const from = msg.key.remoteJid; const P = config.PREFIX;
    if (command !== "horario" && !(args || []).length) return false;
    if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "⏰ Isso é só em grupo." }, { quoted: msg }); return true; }
    if (!userAdmin) { await sock.sendMessage(from, { text: "❌ Só administrador mexe no horário do grupo, senpai." }, { quoted: msg }); return true; }
    const db = ler(); const g = db[from] || {};

    if (command === "horario") {
        if (/^(off|cancelar|limpar)$/i.test(args[0] || "")) { delete db[from]; salvar(db); await sock.sendMessage(from, { text: "🗑️ Todos os horários deste grupo foram cancelados." }, { quoted: msg }); return true; }
        await sock.sendMessage(from, { text: `〔 ⏰ ʜᴏʀᴀ́ʀɪᴏ ᴅᴏ ɢʀᴜᴘᴏ 〕\n\n${textoAgenda(db[from])}\n\n❀ ${P}fechar 00:00 · ${P}abrir 06:00 (todo dia)\n❀ ${P}fechar 30min (cronômetro)\n❀ ${P}fechar off · ${P}abrir off · ${P}horario off` }, { quoted: msg });
        return true;
    }

    const acao = command; // "abrir" | "fechar"
    const r = interpretar(args);
    if (!r) {
        await sock.sendMessage(from, { text: `🤔 Não entendi o horário.\n\nExemplos:\n❀ ${P}${acao} 00:00 · ${P}${acao} 23h30 · ${P}${acao} meia-noite (todo dia)\n❀ ${P}${acao} 30min · ${P}${acao} 2horas (cronômetro)\n❀ ${P}${acao} off (cancelar)` }, { quoted: msg });
        return true;
    }
    if (r.tipo === "off") { delete g[acao]; delete g["timer_" + acao]; delete g["feito_" + acao]; }
    else if (r.tipo === "diario") {
        g[acao] = r.min;
        // se já passou do horário hoje, não executa agora — só a partir do próximo
        const { dia, min } = agoraBR(); if (((min - r.min + 1440) % 1440) <= TOLERANCIA_MIN) g["feito_" + acao] = dia; else delete g["feito_" + acao];
    } else g["timer_" + acao] = Date.now() + r.ms;
    db[from] = g; salvar(db);
    if (!Object.keys(g).some(k => !k.startsWith("feito_"))) { delete db[from]; salvar(db); }

    const aviso = botAdmin === false ? "\n\n⚠️ Eu ainda não sou ADM aqui — me dá ADM senão na hora eu não consigo." : "";
    const ok = r.tipo === "off" ? `🗑️ Horário de *${acao}* cancelado.` :
        r.tipo === "diario" ? `✅ Combinado: vou *${acao}* o grupo todo dia às *${fmt(r.min)}* (horário de Brasília).` :
        `✅ Cronômetro ligado: vou *${acao}* o grupo daqui a *${Math.round(r.ms / 60000)} min*.`;
    await sock.sendMessage(from, { text: `〔 ⏰ ʜᴏʀᴀ́ʀɪᴏ ᴅᴏ ɢʀᴜᴘᴏ 〕\n\n${ok}\n\n${textoAgenda(ler()[from])}${aviso}` }, { quoted: msg });
    return true;
}

module.exports = { cmdHorario, iniciarHorarios, interpretar, verificar };
