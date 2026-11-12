/* =================================================
   🪪 NAGATORO — PERFIL
   📁 Arquivo: perfil.js

   <prefixo>perfil              → o seu perfil
   <prefixo>perfil @pessoa      → de quem foi marcado
   (ou responda a mensagem de alguém com <prefixo>perfil)

   Manda a FOTO de perfil da pessoa, marcando ela, com:
     • cargo no grupo (dono do grupo / administrador / membro) e nome do grupo
     • nível e moedas (se a pessoa já tiver)
     • barrinhas de brincadeira: gado, beleza, fiel, infiel, puto(a)
   e um botão direto "ENTRAR NO CANAL" (1 toque abre o canal).
   Qualquer pessoa pode usar — não precisa se registrar.
================================================= */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { baixarBuffer } = require("../cardGenerator/cardGenerator");

const dbPath = path.join(__dirname, "../../database/usuarios.json");

// 📚 LEITURA DO BANCO
function lerUsuarios() {
    if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(dbPath, "utf8") || "{}");
    } catch {
        return {};
    }
}

// 💾 SALVAR DADOS
function salvarUsuarios(dados) {
    fs.writeFileSync(dbPath, JSON.stringify(dados, null, 2), "utf8");
}

// 🎖️ CLASSIFICAÇÃO POR NÍVEL
function calcularPatente(nivel) {
    if (nivel >= 25) return "🏆 LENDÁRIO";
    if (nivel >= 18) return "🥇 DIAMANTE";
    if (nivel >= 12) return "🥈 OURO";
    if (nivel >= 7) return "🥉 PRATA";
    if (nivel >= 3) return "🔵 BRONZE";
    return "⚪ INICIANTE";
}

// ───────────── brincadeira das barrinhas ─────────────
// A porcentagem é "sorteada" a partir da pessoa + a semana, então o resultado é
// o mesmo a semana toda (ninguém muda no refresh) e muda na semana seguinte.
function semanaDoAno() {
    const d = new Date();
    const inicio = new Date(d.getFullYear(), 0, 1);
    return `${d.getFullYear()}-${Math.floor((d - inicio) / (7 * 86400000))}`;
}

function hashParaPorcentagem(texto) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0) % 101; // 0 a 100
}

function barra(pct) {
    const cheios = Math.round(pct / 12.5);
    return "▰".repeat(cheios) + "▱".repeat(8 - cheios);
}

const ATRIBUTOS = [
    { id: "gado",   emoji: "🐂", nome: "Gado"    },
    { id: "beleza", emoji: "😍", nome: "Beleza"  },
    { id: "fiel",   emoji: "💍", nome: "Fiel"    },
    { id: "infiel", emoji: "💔", nome: "Infiel"  },
    { id: "puto",   emoji: "🔥", nome: "Puto(a)" }
];

// selo curtinho do lado da porcentagem
function selo(p) {
    if (p >= 90) return "lendário";
    if (p >= 70) return "alto";
    if (p >= 40) return "médio";
    if (p >= 15) return "baixo";
    return "quase nada";
}

function calcularBarras(alvo) {
    const semana = semanaDoAno();
    const v = {};
    for (const a of ATRIBUTOS) v[a.id] = hashParaPorcentagem(`${alvo}|${semana}|${a.id}`);
    return v;
}

function linhasDasBarras(alvo, valores) {
    const v = valores || calcularBarras(alvo);
    return ATRIBUTOS.map(a => `${a.emoji} ${a.nome} ${barra(v[a.id])} ${v[a.id]}% · ${selo(v[a.id])}`).join("\n");
}

// 😏 uma frase debochada pra cada situação (vale a mais forte)
function fraseDeboche(v, cargo, ehCriador, nivel) {
    const r = (l) => l[Math.floor(Math.random() * l.length)];
    if (ehCriador) return r(["Meu criador… os números não mentem, mas eu fiz eles serem gentis com você 😌", "Ah, o dono. Vou fingir que esses números são justos 😏"]);
    if (v.fiel >= 70 && v.infiel >= 70) return r(["Fiel E infiel ao mesmo tempo? Tá fazendo hora extra, né 😏", "Fiel em casa, infiel no grupo. Multitarefa nível máximo 🫠"]);
    if (v.gado >= 85) return r(["Gado nível pecuária. Ela visualizou e não respondeu, e você mandou bom dia mesmo assim 🐂", "Tá no pasto já, né? Muuu~ 🐂"]);
    if (v.infiel >= 85) return r(["Infiel desse jeito, o celular deve viver com a tela pra baixo 👀", "Com essa infidelidade, até o Wi-Fi desconfia de você 💔"]);
    if (v.beleza >= 90) return r(["Beleza lendária… ou o filtro tá trabalhando dobrado 😍", "Tá bonito(a), tá. Não sobe pra cabeça 🙄"]);
    if (v.beleza <= 15) return r(["Beleza baixinha, mas a personalidade compensa. Compensa? 🤔", "Beleza quase nada… pelo menos você é engraçado(a). Né? 😬"]);
    if (v.fiel >= 90) return r(["Fiel demais. Até seu ex sente sua falta 💍", "Fidelidade lendária. Raridade nesse grupo, viu 😌"]);
    if (v.puto >= 85) return r(["Calma aí, esquentadinho(a). Respira 🔥", "Nível de raiva: discute até com o corretor do teclado 🔥"]);
    if (cargo.includes("Dono do grupo")) return "Dono do grupo e mesmo assim nesse estado? Que exemplo, hein 👑";
    if (cargo.includes("Administrador")) return "ADM com esses números? Tô começando a entender o grupo 🛡️";
    if (nivel <= 1) return r(["Nível 1. Fala mais no grupo que eu começo a te levar a sério 🥱", "Iniciante… ainda tá no tutorial da vida 😌"]);
    return r(["Números medianos pra uma pessoa mediana. Combina 😏", "Nada de especial por aqui. Normal até demais 🥱", "Tá na média. Igual sua conversa no grupo~"]);
}

// 📖 versículo do dia (muda todo dia, o mesmo pra todo mundo)
const VERSICULOS = [
    ["O Senhor é o meu pastor; nada me faltará.", "Salmos 23:1"],
    ["Tudo posso naquele que me fortalece.", "Filipenses 4:13"],
    ["O amor é paciente, o amor é bondoso.", "1 Coríntios 13:4"],
    ["Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", "Salmos 37:5"],
    ["Não temas, porque eu sou contigo.", "Isaías 41:10"],
    ["Alegrai-vos na esperança, sede pacientes na tribulação.", "Romanos 12:12"],
    ["Lâmpada para os meus pés é a tua palavra.", "Salmos 119:105"],
    ["Bem-aventurados os pacificadores.", "Mateus 5:9"],
    ["A resposta branda desvia o furor.", "Provérbios 15:1"],
    ["Sede fortes e corajosos.", "Josué 1:9"],
    ["O choro pode durar uma noite, mas a alegria vem pela manhã.", "Salmos 30:5"],
    ["Vinde a mim, todos os que estais cansados.", "Mateus 11:28"],
    ["Confia no Senhor de todo o teu coração.", "Provérbios 3:5"],
    ["Deus é o nosso refúgio e fortaleza.", "Salmos 46:1"],
    ["Amarás o teu próximo como a ti mesmo.", "Mateus 22:39"],
    ["Em tudo dai graças.", "1 Tessalonicenses 5:18"],
    ["O coração alegre é bom remédio.", "Provérbios 17:22"],
    ["Buscai primeiro o Reino de Deus.", "Mateus 6:33"],
    ["Eu sou o caminho, a verdade e a vida.", "João 14:6"],
    ["O Senhor pelejará por vós.", "Êxodo 14:14"]
];
function versiculoDoDia() {
    const d = new Date(); const i = (d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % VERSICULOS.length;
    return VERSICULOS[i];
}

// ───────────── quem é o alvo ─────────────
function limparJid(jid) {
    return String(jid || "").replace(/:\d+@/, "@");
}

function descobrirAlvo(msg, args, remetente) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0];
    if (ctx?.participant) return ctx.participant;
    const numero = String(args?.[0] || "").replace(/\D/g, "");
    if (numero.length >= 10) return `${numero}@s.whatsapp.net`;
    return remetente;
}

function acharParticipante(meta, alvo) {
    const procurado = limparJid(alvo);
    const numero = procurado.split("@")[0];
    return (meta?.participants || []).find(p =>
        limparJid(p.id) === procurado ||
        (p.lid && limparJid(p.lid) === procurado) ||
        (p.phoneNumber && limparJid(p.phoneNumber) === procurado) ||
        String(p.id).split("@")[0] === numero
    );
}

function descreverCargo(participante) {
    if (participante?.admin === "superadmin") return "👑 Dono do grupo";
    if (participante?.admin === "admin") return "🛡️ Administrador";
    return "👤 Membro";
}

async function baixarFoto(sock, candidatos) {
    for (const jid of candidatos.filter(Boolean)) {
        try {
            const url = await sock.profilePictureUrl(jid, "image");
            if (url) return await baixarBuffer(url);
        } catch {}
    }
    return null;
}

async function perfil(sock, msg, args) {
    const from = msg.key.remoteJid;
    const ehGrupo = String(from).endsWith("@g.us");
    const remetente = msg.key.participant || msg.key.remoteJid;
    const alvo = descobrirAlvo(msg, args, remetente);
    const numero = String(alvo).split("@")[0].split(":")[0];

    // 👥 Cargo e nome do grupo
    let cargo = "👤 Conversa privada";
    let nomeGrupo = "Conversa privada";
    let participante = null;
    if (ehGrupo) {
        try {
            const meta = await sock.groupMetadata(from);
            nomeGrupo = meta.subject || "Grupo";
            participante = acharParticipante(meta, alvo);
            cargo = descreverCargo(participante);
        } catch {
            cargo = "👤 Membro";
            nomeGrupo = "Grupo";
        }
    }

    // 📊 Nível e moedas (se a pessoa já tiver)
    const banco = lerUsuarios();
    const dados = banco[alvo] || banco[limparJid(alvo)] || banco[participante?.id] || banco[participante?.lid] || null;
    const nivel = dados?.nivel || 1;
    let linhaNivel = `⭐ Nv ${nivel} · ${calcularPatente(nivel)}`;
    if (dados) {
        try {
            const { xpNecessario } = require("../level/level");
            linhaNivel += ` · ${dados.xp || 0}/${xpNecessario(nivel)} xp`;
        } catch {}
    }
    const linhaMoedas = dados ? ` · 💸 ${Number(dados.ouro || 0).toLocaleString("pt-BR")}` : "";

    const valores = calcularBarras(limparJid(alvo));
    let ehCriador = false;
    try { ehCriador = require("../utils-validacao/utils-validacao").ehDono([alvo, participante?.phoneNumber, participante?.lid].filter(Boolean), config.OWNER_NUMBER); } catch {}
    // 📖 versículo novo a cada perfil (bible-api, Almeida); se cair, usa a lista local
    let vers, ref;
    try { [vers, ref] = await require("../apis-publicas/apis-publicas").versiculoAleatorio(VERSICULOS); }
    catch { [vers, ref] = versiculoDoDia(); }

    // 🔮 Espaço Crush (só aparece se a pessoa já jogou)
    let blocoCrush = null;
    try { blocoCrush = require("../espaco-crush/espaco-crush").linhasPerfil([alvo, participante?.id, participante?.lid, participante?.phoneNumber].filter(Boolean)); } catch {}

    const nivelTxt = linhaNivel.replace(/^⭐ /, "");
    const texto = [
        `> ❲ ⛮ ❳  Perfil  ❲ ⛮ ❳`,
        `> ❲ Nome ❳  @${numero}`,
        `> ❲ Cargo ❳  ${cargo}`,
        `> ❲ Grupo ❳`,
        `> ${nomeGrupo}`,
        `> ❲ Nível ❳  ${nivelTxt}`,
        ...(dados ? [`> ❲ Moedas ❳  💸 ${Number(dados.ouro || 0).toLocaleString("pt-BR")}`] : []),
        ``,
        `❲ ⛮ ❳  Zoeira da semana  ❲ ⛮ ❳`,
        linhasDasBarras(limparJid(alvo), valores),
        ...(blocoCrush ? [``, blocoCrush] : []),
        ``,
        `😏 ${fraseDeboche(valores, cargo, ehCriador, nivel)}`,
        ``,
        `📖 _"${vers}"_ — ${ref}`,
        `> ❲ ᶜʳⁱᵃᵈᵒʳ ❲ ⛮ ❳ ᵈᵒᶜᵗᵒʳ ᵛᵃˡᵉʸᵃʳᵈ ❳`
    ].join("\n");

    // 🖼️ Foto da pessoa (se não tiver/ou for privada, vai sem foto)
    let foto = await baixarFoto(sock, [alvo, participante?.id, participante?.lid, participante?.phoneNumber]);
    // 👾 sem foto (ou foto escondida) → bonequinho pixel
    let frasePixelPerfil = "";
    if (!foto) { try { foto = await require("../avatar-pixel/avatar-pixel").avatarPixel(participante?.phoneNumber || alvo); if (foto) frasePixelPerfil = require("../avatar-pixel/avatar-pixel").frasePixel(); } catch {} }
    // a frase do bonequinho pixel entra antes do rodapé
    const textoFinal = frasePixelPerfil ? texto.replace(/\n> ❲ ᶜʳⁱᵃᵈᵒʳ/, `\n${frasePixelPerfil}\n> ❲ ᶜʳⁱᵃᵈᵒʳ`) : texto;

    const { enviarNativeFlow, botaoUrl, obterLinkCanalConfig } = require("../menuBotoes/menuBotoes");
    const canal = obterLinkCanalConfig();
    const botoes = canal ? [botaoUrl("📢 ENTRAR NO CANAL", canal)] : [];

    try {
        if (botoes.length) {
            return await enviarNativeFlow(sock, from, {
                text: textoFinal,
                footer: "\u200e",   // o nome do criador já vai no fim do texto
                imageBuffer: foto || undefined,
                quoted: msg,
                mentions: [alvo],
                buttons: botoes
            });
        }
        throw new Error("sem botão");
    } catch (erro) {
        // Plano B: sem botão interativo, manda foto + texto normal
        if (foto) {
            return sock.sendMessage(from, { image: foto, caption: textoFinal, mentions: [alvo] }, { quoted: msg });
        }
        return sock.sendMessage(from, { text: textoFinal, mentions: [alvo] }, { quoted: msg });
    }
}

module.exports = { perfil, lerUsuarios, salvarUsuarios, linhasDasBarras, barra, calcularBarras };
