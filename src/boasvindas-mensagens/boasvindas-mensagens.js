/* =================================================
   🎉 NAGATORO — MENSAGENS DE ENTRADA E SAÍDA DO GRUPO
   📁 Arquivo: boasvindas-mensagens.js
================================================= */

// 😏 Chamadas de entrada — no deboche da Nagatoro
const chamadasEntrada = [
    "😏 OLHA SÓ... CHEGOU MAIS UM(A) PRA EU IMPLICAR!",
    "🖤 ENTROU? AGORA AGUENTA, SENPAI.",
    "😈 NOVATO(A) DETECTADO(A). VAI SER DIVERTIDO.",
    "🙄 MAIS UM(A)? TÁ BOM, EU FINJO QUE ME IMPORTO.",
    "💜 CHEGOU ACHANDO QUE IA SER FÁCIL? TÁ FOFO.",
    "😂 QUE CARINHA DE PERDIDO(A)... HEHE~",
    "👀 ENTROU QUIETINHO(A)? EU VI, VIU?",
    "🫦 BEM-VINDO(A) À ZONA DE DEBOCHE.",
    "😼 TÁ COM MEDO? DEVERIA. HEHE~",
    "🎯 NOVO ALVO PRA MINHA ZOEIRA CHEGOU!",
    "🤭 AI QUE GRACINHA, ACHOU O GRUPO SOZINHO(A)?",
    "😏 SE AGUENTA, FICA. SE NÃO AGUENTA, SOME.",
    "🖤 APARECEU MAIS UM(A) PRA EU NÃO FICAR ENTEDIADA.",
    "😈 ENTRA, SENTA E NÃO ME FAZ PASSAR VERGONHA.",
    "💅 CHEGOU. AGORA FINGE QUE É INTERESSANTE.",
    "🙃 OLHA QUEM ACHOU O CAMINHO... DEMOROU, HEIN?",
];

// 🥀 Zoeiras de saída — deboche puro
const zoeirasSaida = [
    "😂 @{nome} saiu correndo... nem aguentou o primeiro deboche. Fraquinho(a).",
    "🙄 @{nome} foi embora. Calma, gente, ninguém vai sentir falta. Nem eu.",
    "🤭 Fugiu, @{nome}? Que dó... só que não. HEHE~",
    "🚪 @{nome} apertou o \"sair\" com a mão tremendo. Eu vi, tá?",
    "😏 Tchau, @{nome}! A porta é serventia da casa, e você usou bem.",
    "🥲 @{nome} desistiu. Achou que ia ser fácil? Tá fofo.",
    "🫠 @{nome} sumiu igual sinal de wi-fi no meio do mato.",
    "🤡 @{nome} saiu sem se despedir. Educação mandou lembranças.",
    "💨 @{nome} evaporou. Nem fez falta pra virar fofoca.",
    "😈 Mais um(a) que não aguentou a Nagatoro. Próximo!",
    "📉 O grupo ficou mais leve: @{nome} saiu. Coincidência? Não.",
    "😼 @{nome} correu chorando... volta não, viu? Tá bom assim.",
    "🍃 @{nome} foi levado(a) pelo vento. Vento, obrigada.",
    "🖤 @{nome} saiu. Eu ia sentir saudade, mas achei mais nada pra fazer.",
];

function preencher(texto, nome) {
    return texto.replace(/\{nome\}/g, nome);
}

function gerarChamadaEntrada() {
    return chamadasEntrada[Math.floor(Math.random() * chamadasEntrada.length)];
}

function gerarZoeiraSaida(nome) {
    const escolhida = zoeirasSaida[Math.floor(Math.random() * zoeirasSaida.length)];
    return preencher(escolhida, nome);
}

// ─────────────────────────────────────────────────
// 📐 MONTAGEM DAS MENSAGENS (visual compacto, letrinhas pequenas + 🧣)
// ─────────────────────────────────────────────────

// WhatsApp corta legenda de imagem em ~1024 caracteres. Se cabeçalho + regras
// couberem, vai tudo junto; se não, as regras completas vão numa 2ª mensagem.
const LIMITE_LEGENDA = 950;

// Limpa a descrição do grupo SEM cortar nada (agora mostra a regra inteira).
function limparRegras(texto) {
    return String(texto || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function montarTextoRegras(regras, { nomeBot, nomeDono } = {}) {
    const rodape = nomeBot ? `\n\n🧣 ${nomeBot}${nomeDono ? ` • 👑 ${nomeDono}` : ""}` : "";
    return `〔 📜 ʀᴇɢʀᴀs ᴅᴏ ɢʀᴜᴘᴏ 〕\n\n${limparRegras(regras)}${rodape}`;
}

// Devolve { legenda, regrasExtra }:
//  - legenda: texto que vai junto do card
//  - regrasExtra: texto das regras completas (só quando não coube na legenda), senão null
function montarBemVindoPartes({ chamada, nomeUsuario, nomeGrupo, totalMembros, regras, autorAceite, semFoto, nomeBot, nomeDono }) {
    const topo = [
        `〔 😏 ᴇɴᴛʀᴏᴜ ᴍᴀɪs ᴜᴍ(ᴀ) 〕`,
        "",
        chamada,
        "",
        `> 👋 @${nomeUsuario}`,
        `> 🏷️ ${nomeGrupo}`,
        `> 👥 ${totalMembros} membros`
    ];
    if (autorAceite) topo.push(`> ✅ Quem teve dó e aceitou: @${autorAceite}`);

    const fim = ["", `💬 Fala \"oi\" pra galera... ou vai ficar de enfeite? 😏`];
    if (semFoto) fim.push(`📸 _Sem foto de perfil? Escondendo o quê, hein? Hehe~_`);
    fim.push("", `🧣 ${nomeBot} • 👑 ${nomeDono}`);

    const regrasLimpas = limparRegras(regras);
    const blocoRegras = regrasLimpas ? ["", `〔 📜 ʀᴇɢʀᴀs ᴅᴏ ɢʀᴜᴘᴏ 〕`, "", regrasLimpas] : [];

    const completo = [...topo, ...blocoRegras, ...fim].join("\n");
    if (completo.length <= LIMITE_LEGENDA || !regrasLimpas) {
        return { legenda: completo, regrasExtra: null };
    }
    return {
        legenda: [...topo, "", `📜 _As regras completas vão logo abaixo_ 👇`, ...fim].join("\n"),
        regrasExtra: montarTextoRegras(regrasLimpas, { nomeBot, nomeDono })
    };
}

// Compatível com o uso antigo (retorna só a legenda).
function montarMensagemBemVindo(dados) {
    return montarBemVindoPartes(dados).legenda;
}

// 🖤 Saída debochada. motivo: "saiu" | "removido"
function montarMensagemSaida({ zoeira, nomeGrupo, totalMembros, nomeBot, nomeDono, nomeUsuario, tempoNoGrupo, motivo, autor }) {
    const removido = motivo === "removido";
    const linhas = [
        `〔 🖤 ꜰᴜɢᴀ ʀᴇɢɪsᴛʀᴀᴅᴀ 〕`,
        removido ? `🚨 *CHUTADO(A) DO GRUPO! HEHE~*` : `🚨 *FUGIU!*`,
        "",
        zoeira,
        ""
    ];
    if (nomeUsuario) linhas.push(`> 👤 @${nomeUsuario}`);
    linhas.push(`> 🏷️ ${nomeGrupo}`);
    if (tempoNoGrupo) linhas.push(`> ⏳ Aguentou só ${tempoNoGrupo}`);
    if (removido && autor) linhas.push(`> 🔨 Quem deu o chute: @${autor}`);
    linhas.push(`> 👥 Restam ${totalMembros} membros`, "", `🧣 ${nomeBot} • 👑 ${nomeDono}`);
    return linhas.join("\n");
}

module.exports = { gerarChamadaEntrada, gerarZoeiraSaida, montarMensagemBemVindo, montarBemVindoPartes, montarTextoRegras, montarMensagemSaida };
