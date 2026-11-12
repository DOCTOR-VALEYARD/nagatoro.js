/* =================================================
   📋 MENUS EM BOTÕES — NAGATORO
   Todos os menus (menuadm, menudono, menugold, menumidias,
   brincadeiras) no MESMO formato do card de música:
     • um botão na conversa ("VER TUDO")
     • ao tocar: 📋 COMANDOS (lista com as seções), BY, CANAL, CRIADOR
     • tocou no comando → executa (ou pede o que falta, ex.: @pessoa)

   COM prefixo  (.menuadm)  → vem em botões (este arquivo)
   SEM prefixo  (menuadm)   → vem só a lista em texto (arquivo antigo de cada menu)
================================================= */
const config = require("../../config");

const MENUS = {
    menuadm: {
        titulo: "🛡️ MENU ADM",
        texto: "🔐 Área exclusiva dos administradores.\nToque em *VER TUDO* e escolha o comando:",
        restrito: "admin",
        secoes: [
            ["📊 RESUMO E ATIVIDADE", ["resumo", "atividades", "top10", "rankativo", "tempo", "relatorio"]],
            ["⚔️ GRUPO", ["ban", "kick", "promover", "rebaixar", "aviso", "marcar", "hidetag", "citar", "sair", "abrir", "fechar", "fixar"]],
            ["🔒 SEGURANÇA", ["antilink", "antinota", "antiloc", "antidoc", "antifake", "antipalavrao", "antispam", "antiflood", "antip", "antib", "antir", "antig"]],
            ["⚙️ AUTOMÁTICOS", ["dvcl-auto", "dvcl1", "dvcl0", "bemvindo", "aceitar", "mencao", "saudacao", "ativar"]],
            ["🚫 LISTA NEGRA", ["lista", "tirarlista", "logban"]],
            ["🧰 FERRAMENTAS", ["add", "modulos", "limparbot", "calc", "wiki", "encurtar", "traduzir", "base64", "md5", "spoiler", "qrcode", "me", "adms"]]
        ]
    },
    menudono: {
        titulo: "👑 MENU DONO",
        texto: `🔐 Comandos exclusivos: ${config.OWNER_NAME}\nToque em *VER TUDO* e escolha:`,
        secoes: [
            ["💻 MÍDIA E FERRAMENTAS", ["play", "s", "gif", "toimg"]],
            ["💰 SISTEMA ECONÔMICO", ["saldo", "roubar", "loja", "gastar"]],
            ["🎮 DIVERSÃO E JOGOS", ["forca", "adivinha", "quiz", "duelo", "roleta"]],
            ["⚙️ CONTROLE GERAL", ["ativar", "configurar", "ligar", "desligar", "restart", "broadcast", "backup"]]
        ]
    },
    menugold: {
        titulo: "💰 MENU GOLD",
        texto: "💸 Economia e moedas.\nToque em *VER TUDO* e escolha:\n\n🧣 1000 Gold = 1 Premium",
        secoes: [
            ["💸 ECONOMIA E MOEDAS", ["saldo", "gold", "daily", "checkin", "trabalhar", "roubar", "loja", "duelo", "resgatar"]],
            ["🏆 RANKING", ["rank", "perfil", "topgold"]]
        ]
    },
    menumidias: {
        titulo: "🎵 MENU MÍDIAS",
        texto: "🎶 Central de mídias.\nToque em *VER TUDO* e escolha:",
        secoes: [
            ["🎶 MÚSICA E ÁUDIO", ["play", "dvcl-yt", "musica-aleatoria"]],
            ["🎬 VÍDEOS POR LINK", ["video", "tiktok", "instagram", "kwai"]],
            ["🖼️ FIGURINHA E CONVERSÃO", ["s", "sf", "gif", "toimg", "attp", "dvcl-auto"]],
            ["📂 ARQUIVOS", ["dvcl-prt", "mediafire"]]
        ]
    },
    brincadeiras: {
        titulo: "🎭 BRINCADEIRAS",
        texto: "🌸 Diversão, resenha e sistema social.\nToque em *VER TUDO* e escolha:",
        secoes: [
            ["🎲 INTERAÇÕES", ["tapa", "matar", "beijar", "abracar", "amizade", "compatibilidade", "dupla"]],
            ["🕹️ JOGOS", ["jogos", "crush", "rankcrush", "sortear"]],
            ["💞 RELACIONAMENTOS", ["familia", "familias", "casamento", "meucasal", "divorcio", "topcasais"]],
            ["📊 ENQUETES", ["enquete"]],
            ["🎯 MISSÕES E CONQUISTAS", ["missao", "missoes", "conquistas", "xp", "nivel", "topxp"]],
            ["💰 GOLD", ["checkin", "trabalhar", "roubar", "bonus", "transferir", "presente", "inventario", "topgold"]]
        ]
    }
};
MENUS.menubrinquedos = MENUS.brincadeiras;

const NOMES_MENU = new Set(Object.keys(MENUS));

async function enviarMenuEmBotoes(sock, msg, nome) {
    const from = msg?.key?.remoteJid;
    const def = MENUS[nome];
    if (!from || !def) return false;

    const MB = require("../menuBotoes/menuBotoes");

    // 🔐 menu ADM: só administrador (o dono conta como admin)
    if (def.restrito === "admin") {
        const autor = msg.key.participant || msg.key.participantAlt || from;
        let ok = false;
        try {
            const { ehDono } = require("../utils-validacao/utils-validacao");
            ok = !!msg.key.fromMe || ehDono([autor, msg.key.participantAlt], config.OWNER_NUMBER)
                || (from.endsWith("@g.us") && await require("../grupo/grupo").isAdmin(sock, from, autor));
        } catch {}
        if (!ok) {
            await sock.sendMessage(from, { text: "❌ O menu administrativo é exclusivo para administradores." }, { quoted: msg });
            return true;
        }
    }

    const validos = new Set(MB.extrairComandosDoBot());
    const P = config.PREFIX;
    const sections = def.secoes.map(([titulo, cmds]) => ({
        title: titulo,
        rows: cmds.filter(c => validos.has(c)).map(c => MB.linhaLista(`cmd:${c}`, `${P}${c}`, descricao(c, MB)))
    })).filter(s => s.rows.length);

    const extras = [
        MB.botao("BY : DOCTOR VALEYARD", "zoar_dono"),
        MB.botaoUrl("📢 ENTRAR NO CANAL", MB.obterLinkCanalConfig() || config.CHANNEL_URL || ""),
        MB.botaoUrl("💬 FALAR COM O CRIADOR", MB.linkFalarComCriador() || "")
    ].filter(b => b.buttonParamsJson && !b.buttonParamsJson.includes('"url":""'));

    const total = 1 + extras.length;
    const divisores = [];
    for (let i = 1; i < total; i++) divisores.push(i);
    divisores.push(999);

    try {
        await MB.enviarListaWhatsApp(sock, from, {
            text: `〔 ${def.titulo} — ${config.BOT_NAME || "NAGATORO"} 〕\n\n${def.texto}`,
            title: "📋 COMANDOS",
            sections,
            footer: "👑 ᴅᴏᴄᴛᴏʀ ᴠᴀʟᴇʏᴀʀᴅ",
            quoted: msg,
            extraButtons: extras,
            // igual ao card de música: 1 botão na conversa + VER TUDO
            messageParamsJson: JSON.stringify({
                bottom_sheet: {
                    in_thread_buttons_limit: 1,
                    divider_indices: divisores,
                    list_title: def.titulo,
                    button_title: "📋 VER TUDO"
                }
            })
        });
        return true;
    } catch (e) {
        console.error(`⚠️ menu em botões (${nome}) falhou, mandando em texto:`, e?.message || e);
        return false; // quem chamou manda a versão em texto
    }
}

function descricao(c, MB) {
    const extra = {
        lista: "Pôr número na lista negra (remove do grupo).",
        tirarlista: "Tirar número da lista negra.",
        antilink: "Apaga links: membro sai, ADM leva sermão.",
        antir: "Barra quem insiste em solicitação.",
        jogodavelha: "Jogo da velha com @pessoa ou contra a bot.",
        ban: "Remover alguém do grupo.",
        kick: "Remover alguém do grupo.",
        promover: "Dar ADM pra alguém.",
        rebaixar: "Tirar ADM de alguém."
    };
    return extra[c] || MB.descricaoComando?.(c) || `Executar ${config.PREFIX}${c}`;
}

module.exports = { enviarMenuEmBotoes, NOMES_MENU, MENUS };
