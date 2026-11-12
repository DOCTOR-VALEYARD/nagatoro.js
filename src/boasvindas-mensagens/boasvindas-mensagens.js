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

const RODAPE_CRIADOR = '❲ ᶜʳⁱᵃᵈᵒʳ ❲ ⛮ ❳ ᵈᵒᶜᵗᵒʳ ᵛᵃˡᵉʸᵃʳᵈ ❳';
const titulo = (t) => `> ❲ ⛮ ❳  ${t}  ❲ ⛮ ❳`;

function montarTextoRegras(regras) {
    return `${titulo('ʀᴇɢʀᴀꜱ ᴅᴏ ɢʀᴜᴘᴏ')}\n\n${limparRegras(regras)}\n\n> ${RODAPE_CRIADOR}`;
}

// Devolve { legenda, regrasExtra }:
//  - legenda: texto que vai junto do card (compacto, estilo painel)
//  - regrasExtra: regras do grupo, sempre numa 2ª mensagem (ou null se não tiver)
function montarBemVindoPartes({ nomeUsuario, nomeGrupo, totalMembros, regras, autorAceite, semFoto, fotoPixel }) {
    const linhas = [
        titulo('ᴇɴᴛʀᴏᴜ ᴍᴀɪꜱ ᴜᴍ(ᴀ)'),
        `> ❲ ɴᴏᴠᴀᴛᴏ(ᴀ) ❳  @${nomeUsuario}`,
        `> ❲ ɢʀᴜᴘᴏ ❳`,
        `> ${nomeGrupo}`,
        `> ❲ ᴍᴇᴍʙʀᴏꜱ ❳  ${totalMembros}`
    ];
    if (autorAceite) linhas.push(`> ❲ quem ᴛᴇᴠᴇ ᴅᴏ́ ❳  @${autorAceite}`);

    const regrasLimpas = limparRegras(regras);
    linhas.push("");
    if (regrasLimpas) linhas.push(`📜 ᴀꜱ ʀᴇɢʀᴀꜱ ᴠᴀ̃ᴏ ʟᴏɢᴏ ᴀʙᴀɪxᴏ 👇`);
    if (fotoPixel) linhas.push(fotoPixel);
    else if (semFoto) linhas.push(`📸 _Sem foto de perfil? Escondendo o quê, hein? Hehe~_`);
    linhas.push(`> ${RODAPE_CRIADOR}`);

    return {
        legenda: linhas.join("\n"),
        regrasExtra: regrasLimpas ? montarTextoRegras(regrasLimpas) : null
    };
}

// Compatível com o uso antigo (retorna só a legenda).
function montarMensagemBemVindo(dados) {
    return montarBemVindoPartes(dados).legenda;
}

// 🖤 Saída debochada. motivo: "saiu" | "removido"
function montarMensagemSaida({ zoeira, nomeGrupo, totalMembros, nomeUsuario, tempoNoGrupo, motivo, autor, extra }) {
    const removido = motivo === "removido";
    const linhas = [titulo(removido ? 'ᴄʜᴜᴛᴀᴅᴏ(ᴀ) ᴅᴏ ɢʀᴜᴘᴏ' : 'ꜰᴜɢᴀ ʀᴇɢɪꜱᴛʀᴀᴅᴀ')];
    if (nomeUsuario) linhas.push(`> ❲ ${removido ? 'ᴄʜᴜᴛᴀᴅᴏ(ᴀ)' : 'ꜰᴜɢɪᴜ'} ❳  @${nomeUsuario}`);
    linhas.push(`> ❲ ɢʀᴜᴘᴏ ❳`, `> ${nomeGrupo}`);
    if (tempoNoGrupo) linhas.push(`> ❲ ᴀɢᴜᴇɴᴛᴏᴜ ❳  ${tempoNoGrupo}`);
    if (removido && autor) linhas.push(`> ❲ quem ᴄʜᴜᴛᴏᴜ ❳  @${autor}`);
    linhas.push(`> ❲ ʀᴇꜱᴛᴀᴍ ❳  ${totalMembros}`, "", zoeira);
    if (extra) linhas.push(extra);
    linhas.push(`> ${RODAPE_CRIADOR}`);
    return linhas.join("\n");
}

// 🚪 Pedido de entrada / ❌ pedido recusado — mesmo painel
function montarMensagemPorta({ frase, nomeSolicitante, nomeGrupo, quemRecusou }) {
    const recusado = !!quemRecusou;
    const linhas = [
        titulo(recusado ? 'ʙᴀʀʀᴀᴅᴏ(ᴀ) ɴᴀ ᴘᴏʀᴛᴀ' : 'ᴀʟɢᴜᴇ́ᴍ ɴᴀ ᴘᴏʀᴛᴀ'),
        `> ❲ ${recusado ? 'ʙᴀʀʀᴀᴅᴏ(ᴀ)' : 'ɴᴀ ᴘᴏʀᴛᴀ'} ❳  @${nomeSolicitante}`,
        `> ❲ ɢʀᴜᴘᴏ ❳`,
        `> ${nomeGrupo}`,
        recusado ? `> ❲ quem ʀᴇᴄᴜꜱᴏᴜ ❳  @${quemRecusou}` : `> ❲ quem ᴅᴇᴄɪᴅᴇ ❳  ᴏꜱ ᴀᴅᴍꜱ`,
        "",
        frase,
        `> ${RODAPE_CRIADOR}`
    ];
    return linhas.join("\n");
}

module.exports = { RODAPE_CRIADOR, montarMensagemPorta, gerarChamadaEntrada, gerarZoeiraSaida, montarMensagemBemVindo, montarBemVindoPartes, montarTextoRegras, montarMensagemSaida };
