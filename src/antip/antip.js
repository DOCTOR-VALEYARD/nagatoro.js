/* =================================================
   🧪 ANTIP — PROTEÇÃO CONTRA CONTEÚDOS SUSPEITOS
   Comando: <prefixo>antip

   O que detecta (só em grupos com antip ligado):
   • Arquivo executável/perigoso (.exe .bat .vbs .jar .msi .ps1 .lnk ...)
   • Extensão dupla / disfarçada (ex.: foto.jpg.exe, nota.pdf.apk)
   • Nome com caractere invertido (U+202E) usado pra esconder extensão
   • Tipo real diferente do nome (diz ser PDF/imagem mas é APK/EXE)
   • APK solto (opcional — vem LIBERADO, porque o grupo pode trocar APK)
   • Arquivo já marcado como perigoso pelos admins (impressão digital SHA-256)
   • Links de "pegador de IP", link com IP cru, domínio punycode (xn--),
     link com truque de "@" e domínios que os admins adicionarem

   Ação: apaga + avisa. Reincidência (padrão: 2ª vez) → remove do grupo.
================================================= */
const config = require("../../config");
const B = require("../seguranca-base/seguranca-base");

const SISTEMA = "antip";
const PADRAO = { on: false, apk: false, kick: true, limite: 2, hashes: [], sites: [], strikes: {} };

// Extensões que executam código no PC/celular
const EXT_PERIGOSAS = new Set([
    "exe", "scr", "bat", "cmd", "com", "pif", "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta",
    "msi", "msp", "ps1", "psm1", "jar", "lnk", "reg", "cpl", "dll", "scf", "inf", "sys", "gadget",
    "application", "msc", "vb", "ws", "sct"
]);
const EXT_APK = new Set(["apk", "xapk", "apks", "apkm"]);
// Extensões "inocentes" usadas para disfarçar
const EXT_ISCA = new Set(["pdf", "jpg", "jpeg", "png", "gif", "mp4", "mp3", "doc", "docx", "txt", "xls", "xlsx", "zip", "webp", "ogg"]);
// Tipos reais (mimetype) executáveis
const MIME_PERIGOSO = /x-msdownload|x-dosexec|x-msdos-program|x-ms-installer|x-msi|java-archive|x-sh\b|x-bat|vbscript|hta/i;
const MIME_APK = /vnd\.android\.package-archive/i;

// Domínios conhecidos de captura de IP / rastreio
const SITES_CONHECIDOS = [
    "grabify.link", "iplogger.org", "iplogger.com", "iplogger.ru", "iplogger.co", "iplogger.info",
    "2no.co", "yip.su", "blasze.tk", "blasze.com", "ps3cfw.com", "iplis.ru", "ipgrabber.ru",
    "ezstat.ru", "bmwforum.co", "leancoding.co", "spottyfly.com", "stopify.co", "curiouscat.club",
    "catsnthings.com", "gyazo.nl", "joinmy.site", "screenshare.pics", "headshot.monster",
    "myprivate.pics", "noodshare.pics", "imageshare.best", "fortnitechat.site", "fortnight.space"
];

const RE_URL = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const RE_ESQUEMA_RUIM = /\b(?:javascript|vbscript|data):[^\s]{4,}/i;

const avisados = B.mapaLimitado(2000); // evita avisar 2x a mesma mensagem

// ── Arquivo da mensagem (qualquer tipo de mídia) ──
function midiaDe(m) {
    const tipos = ["documentMessage", "imageMessage", "videoMessage", "audioMessage", "stickerMessage"];
    for (const t of tipos) if (m?.[t]) return { tipo: t, dados: m[t] };
    return null;
}

function hashDe(dados) {
    try {
        const h = dados?.fileSha256;
        if (!h) return null;
        return typeof h === "string" ? h : Buffer.from(h).toString("base64");
    } catch { return null; }
}

// ── Analisa o nome/tipo do arquivo ──
function analisarArquivo(dados, cfg) {
    const nomeBruto = String(dados?.fileName || dados?.title || "");
    const mime = String(dados?.mimetype || "");
    if (/[‮‭⁦-⁩]/.test(nomeBruto)) return "Nome de arquivo com caractere invertido (extensão disfarçada)";

    const nome = nomeBruto.toLowerCase().trim().replace(/[\s.]+$/, "");
    const partes = nome.split(".").filter(Boolean);
    const ext = partes.length > 1 ? partes[partes.length - 1] : "";
    const anterior = partes.length > 2 ? partes[partes.length - 2] : "";

    if (ext && EXT_PERIGOSAS.has(ext)) {
        return anterior && EXT_ISCA.has(anterior)
            ? `Arquivo disfarçado (.${anterior}.${ext})`
            : `Arquivo executável (.${ext})`;
    }
    if (ext && EXT_APK.has(ext) && anterior && EXT_ISCA.has(anterior)) return `APK disfarçado (.${anterior}.${ext})`;

    // Tipo real não bate com o nome
    if (MIME_PERIGOSO.test(mime) && !EXT_PERIGOSAS.has(ext)) return "Tipo real do arquivo é executável (nome falso)";
    if (MIME_APK.test(mime) && ext && !EXT_APK.has(ext)) return "Tipo real do arquivo é APK (nome falso)";

    if (cfg.apk && (EXT_APK.has(ext) || MIME_APK.test(mime))) return "APK não permitido neste grupo";
    return null;
}

// ── Analisa links do texto ──
function hostDe(url) {
    try {
        const u = new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`);
        return { host: u.hostname.toLowerCase(), credenciais: !!(u.username || u.password) };
    } catch { return null; }
}

function analisarTexto(texto, cfg) {
    if (!texto) return null;
    if (RE_ESQUEMA_RUIM.test(texto)) return "Link com esquema perigoso (javascript:/data:)";
    const urls = texto.match(RE_URL) || [];
    const sitesExtras = (cfg.sites || []).map(s => String(s).toLowerCase());
    for (const url of urls.slice(0, 30)) {
        const info = hostDe(url);
        if (!info) continue;
        const { host, credenciais } = info;
        if (credenciais) return "Link com truque de \"@\" (endereço falso)";
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return "Link apontando para IP cru";
        if (host.split(".").some(p => p.startsWith("xn--"))) return "Domínio com letras disfarçadas (punycode)";
        const bate = d => host === d || host.endsWith(`.${d}`);
        if (SITES_CONHECIDOS.some(bate)) return `Link de captura de IP (${host})`;
        if (sitesExtras.some(bate)) return `Domínio bloqueado pelos admins (${host})`;
    }
    return null;
}

// ==================================================
// 🔎 PROCESSAMENTO AUTOMÁTICO (chamado no messages.upsert)
// Retorna true se a mensagem foi tratada (apagada) → o bot para ali.
// ==================================================
async function processarAntip(sock, msg) {
    try {
        const grupo = msg?.key?.remoteJid;
        if (!grupo?.endsWith("@g.us") || msg.key.fromMe) return false;
        const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
        if (!cfg.on) return false;

        const m = B.conteudoReal(msg.message);
        const midia = midiaDe(m);
        let motivo = null;

        if (midia) {
            const h = hashDe(midia.dados);
            if (h && (cfg.hashes || []).includes(h)) motivo = "Arquivo marcado como perigoso pelos admins";
            if (!motivo && midia.tipo === "documentMessage") motivo = analisarArquivo(midia.dados, cfg);
        }
        if (!motivo) motivo = analisarTexto(B.textoDe(m), cfg);
        if (!motivo) return false;

        const autor = B.autorMsg(msg);
        if (await B.ehAdminGrupo(sock, grupo, [autor, msg.key.participantAlt])) return false;
        if (!(await B.botEhAdmin(sock, grupo))) {
            console.log(`🧪 [antip] detectou "${motivo}" em ${grupo}, mas o bot não é admin.`);
            return false;
        }
        if (avisados.has(msg.key.id)) return true;
        avisados.set(msg.key.id, true);

        await B.apagar(sock, grupo, msg.key);

        // Reincidência
        const chave = B.norm(autor);
        const atual = B.lerCfg(grupo, SISTEMA, PADRAO);
        const strikes = { ...(atual.strikes || {}) };
        strikes[chave] = (strikes[chave] || 0) + 1;
        const limite = Math.max(1, Number(atual.limite) || 2);
        let removido = false;
        if (atual.kick && strikes[chave] >= limite) {
            removido = await B.remover(sock, grupo, autor);
            if (removido) delete strikes[chave];
        }
        B.salvarCfg(grupo, SISTEMA, { strikes });

        await B.enviar(sock, grupo, {
            text: `〔 🧪 ᴀɴᴛɪᴘ — ᴄᴏɴᴛᴇᴜ́ᴅᴏ sᴜsᴘᴇɪᴛᴏ 〕\n\n` +
                `👤 @${chave}\n📌 Motivo: ${motivo}\n🗑️ Mensagem apagada.\n` +
                (removido
                    ? `🚪 Removido(a) do grupo por reincidência.\n`
                    : atual.kick ? `⚠️ Aviso ${strikes[chave]}/${limite} — na próxima, tchau. 😏\n` : "") +
                `\n${B.rodape()}`,
            mentions: [autor]
        });
        return true;
    } catch (e) {
        console.error("⚠️ [antip] erro contido:", e?.message || e);
        return false;
    }
}

// ==================================================
// ⚙️ COMANDO <prefixo>antip
// ==================================================
async function cmdAntip(sock, msg, args = []) {
    const grupo = msg.key.remoteJid;
    const P = config.PREFIX;
    if (!grupo?.endsWith("@g.us")) return B.enviar(sock, grupo, { text: "🧪 Esse comando só funciona em grupos." }, { quoted: msg });
    const autor = B.autorMsg(msg);
    if (!msg.key.fromMe && !(await B.ehAdminGrupo(sock, grupo, [autor, msg.key.participantAlt]))) {
        return B.enviar(sock, grupo, { text: "❌ Só administrador mexe na proteção. Boa tentativa~ 😏" }, { quoted: msg });
    }

    const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
    const sub = String(args[0] || "").toLowerCase();
    const resto = args.slice(1).join(" ").trim();
    const estado = B.lerEstado(sub);

    const ajuda = () =>
        `〔 🧪 ᴀɴᴛɪᴘ — ᴄᴏɴᴛᴇᴜ́ᴅᴏ sᴜsᴘᴇɪᴛᴏ 〕\n\n` +
        `🔒 Estado: *${B.onOff(cfg.on)}*\n` +
        `📦 Bloquear APK solto: *${cfg.apk ? "sim" : "não"}*\n` +
        `🚪 Remover reincidente: *${cfg.kick ? `sim (na ${cfg.limite}ª vez)` : "não"}*\n` +
        `🧬 Arquivos marcados: *${(cfg.hashes || []).length}*\n` +
        `🌐 Domínios bloqueados: *${(cfg.sites || []).length}*\n\n` +
        `❀ ${P}antip on / off\n` +
        `❀ ${P}antip apk on / off\n` +
        `❀ ${P}antip kick on / off\n` +
        `❀ ${P}antip limite 2\n` +
        `❀ ${P}antip add (respondendo um arquivo)\n` +
        `❀ ${P}antip add site.com\n` +
        `❀ ${P}antip del (respondendo) / ${P}antip del site.com\n` +
        `❀ ${P}antip lista\n` +
        `❀ ${P}antip zerar (limpa os avisos)\n\n${B.rodape()}`;

    if (estado !== null) {
        B.salvarCfg(grupo, SISTEMA, { on: estado });
        const semAdm = estado && !(await B.botEhAdmin(sock, grupo)) ? "\n\n⚠️ Me dá *admin* no grupo, senão não consigo apagar nem remover!" : "";
        return B.enviar(sock, grupo, { text: `〔 🧪 ᴀɴᴛɪᴘ 〕\n\n🔒 Estado: *${B.onOff(estado)}*${semAdm}\n\n${B.rodape()}` }, { quoted: msg });
    }

    if (sub === "apk" || sub === "kick") {
        const v = B.lerEstado(args[1]);
        if (v === null) return B.enviar(sock, grupo, { text: `Use: ${P}antip ${sub} on / off` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { [sub]: v });
        return B.enviar(sock, grupo, { text: `🧪 antip ${sub}: *${v ? "ligado" : "desligado"}*` }, { quoted: msg });
    }

    if (sub === "limite") {
        const n = parseInt(args[1], 10);
        if (!(n >= 1 && n <= 10)) return B.enviar(sock, grupo, { text: `Use: ${P}antip limite 1 a 10` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { limite: n });
        return B.enviar(sock, grupo, { text: `🧪 Remoção na *${n}ª* vez.` }, { quoted: msg });
    }

    if (sub === "add" || sub === "del") {
        const adicionar = sub === "add";
        // Domínio digitado
        if (resto) {
            const dominio = resto.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/\s]/)[0];
            if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio)) return B.enviar(sock, grupo, { text: "❌ Domínio inválido. Ex.: site-golpe.com" }, { quoted: msg });
            const sites = new Set(cfg.sites || []);
            adicionar ? sites.add(dominio) : sites.delete(dominio);
            B.salvarCfg(grupo, SISTEMA, { sites: [...sites].slice(-300) });
            return B.enviar(sock, grupo, { text: `🌐 *${dominio}* ${adicionar ? "bloqueado" : "liberado"}.` }, { quoted: msg });
        }
        // Arquivo respondido
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const citado = B.conteudoReal(ctx?.quotedMessage);
        const midia = midiaDe(citado);
        const h = midia && hashDe(midia.dados);
        if (!h) return B.enviar(sock, grupo, { text: `❌ Responda um arquivo/mídia com *${P}antip ${sub}* ou informe um domínio.` }, { quoted: msg });
        const hashes = new Set(cfg.hashes || []);
        adicionar ? hashes.add(h) : hashes.delete(h);
        B.salvarCfg(grupo, SISTEMA, { hashes: [...hashes].slice(-500) });
        if (adicionar && ctx?.stanzaId) {
            await B.apagar(sock, grupo, { remoteJid: grupo, id: ctx.stanzaId, participant: ctx.participant, fromMe: false });
        }
        return B.enviar(sock, grupo, {
            text: adicionar
                ? "🧬 Arquivo marcado como perigoso. Se alguém mandar de novo, eu apago na hora."
                : "🧬 Arquivo desmarcado."
        }, { quoted: msg });
    }

    if (sub === "lista") {
        const sites = (cfg.sites || []).map(s => `• ${s}`).join("\n") || "nenhum";
        return B.enviar(sock, grupo, { text: `〔 🧪 ʟɪsᴛᴀ ᴀɴᴛɪᴘ 〕\n\n🌐 Domínios:\n${sites}\n\n🧬 Arquivos marcados: ${(cfg.hashes || []).length}\n\n${B.rodape()}` }, { quoted: msg });
    }

    if (sub === "zerar") {
        B.salvarCfg(grupo, SISTEMA, { strikes: {} });
        return B.enviar(sock, grupo, { text: "🧪 Avisos do antip zerados." }, { quoted: msg });
    }

    return B.enviar(sock, grupo, { text: ajuda() }, { quoted: msg });
}

module.exports = { processarAntip, cmdAntip, analisarArquivo, analisarTexto };
