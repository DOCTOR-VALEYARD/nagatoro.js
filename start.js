




const chalk = require("chalk");

module.exports = function startInfo() {

    // ═══════════════════════════════════════════════════════════
    // 🧹 LIMPA O TERMINAL
    // ═══════════════════════════════════════════════════════════

    process.stdout.write("\x1B[2J\x1B[0f");


    // ═══════════════════════════════════════════════════════════
    // 🎨 PALETA
    // ═══════════════════════════════════════════════════════════

    const c = {
        cyan: chalk.hex("#00F5FF"),
        azul: chalk.hex("#00B4D8"),
        rosa: chalk.hex("#F72585"),
        vermelho: chalk.hex("#FF2E63"),
        roxo: chalk.hex("#9B5DE5"),
        amarelo: chalk.hex("#FFD166"),
        verde: chalk.hex("#06D6A0"),
        branco: chalk.white,
        cinza: chalk.hex("#A8A8A8"),
        laranja: chalk.hex("#FF9F1C")
    };


    // ═══════════════════════════════════════════════════════════
    // 🖥️ BANNER — MANTIDO
    // ═══════════════════════════════════════════════════════════

    const asciiArt = `
███╗   ██╗ █████╗  ██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ 
████╗  ██║██╔══██╗██╔════╝ ██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗
██╔██╗ ██║███████║██║  ███╗███████║   ██║   ██║   ██║██████╔╝██║   ██║
██║╚██╗██║██╔══██║██║   ██║██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║
██║ ╚████║██║  ██║╚██████╔╝██║  ██║   ██║   ╚██████╔╝██║  ██║╚██████╔╝
╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ 
`;


    // ═══════════════════════════════════════════════════════════
    // 🤖 INFORMAÇÕES
    // ═══════════════════════════════════════════════════════════

    const botInfo = {

        creator:
            "Doctor Valeyard C'rizz Lunático",

        botName:
            "NAGATORO",

        version:
            "V5",

        status:
            "INICIANDO..."
    };


    const largura = 52;


    const linha =
        "━".repeat(largura);


    const caixaTopo =
        "═".repeat(largura);


    // ═══════════════════════════════════════════════════════════
    // ⚡ CABEÇALHO
    // ═══════════════════════════════════════════════════════════

    const titulo =
        c.rosa.bold(
            "💜  N A G A T O R O  •  V 5  💜"
        );


    const subtitulo =
        c.roxo.bold(
            "😏  SE AGUENTA, FICA. SE NÃO AGUENTA, SOME.  😏"
        );


    // ═══════════════════════════════════════════════════════════
    // 📊 INFORMAÇÕES DO BOT
    // ═══════════════════════════════════════════════════════════

    const informacoes = `

${c.cyan("╔" + caixaTopo + "╗")}
${c.cyan("║")}  ${c.roxo.bold("🤖 IDENTIDADE DO SISTEMA")}                         ${c.cyan("║")}
${c.cyan("╠" + caixaTopo + "╣")}

${c.cyan("║")}  ${c.cinza("▸")} ${c.branco.bold("Bot      :")} ${c.amarelo.bold(botInfo.botName)}
${c.cyan("║")}  ${c.cinza("▸")} ${c.branco.bold("Versão   :")} ${c.verde.bold(botInfo.version)}
${c.cyan("║")}  ${c.cinza("▸")} ${c.branco.bold("Criador  :")} ${c.vermelho.bold(botInfo.creator)}
${c.cyan("║")}  ${c.cinza("▸")} ${c.branco.bold("Status   :")} ${c.laranja.bold(botInfo.status)}

${c.cyan("╚" + caixaTopo + "╝")}
`;


    // ═══════════════════════════════════════════════════════════
    // 📡 ÁREA DE MENSAGENS
    // ═══════════════════════════════════════════════════════════

    const mensagens = `

${c.rosa("╔" + caixaTopo + "╗")}
${c.rosa("║")}  ${c.amarelo.bold("📡 MENSAGENS DO SISTEMA")}                         ${c.rosa("║")}
${c.rosa("╠" + caixaTopo + "╣")}

${c.rosa("║")}  ${c.azul("▸")} ${c.branco("Acordando a Nagatoro (de mau humor)...")}
${c.rosa("║")}  ${c.azul("▸")} ${c.branco("Carregando configurações...")}
${c.rosa("║")}  ${c.azul("▸")} ${c.branco("Preparando módulos do sistema...")}
${c.rosa("║")}  ${c.azul("▸")} ${c.branco("Carregando comandos...")}
${c.rosa("║")}  ${c.azul("▸")} ${c.branco("Preparando conexão com WhatsApp...")}
${c.rosa("║")}  ${c.amarelo("▸")} ${c.branco.bold("Aguardando conexão...")}

${c.rosa("╚" + caixaTopo + "╝")}
`;


    // ═══════════════════════════════════════════════════════════
    // 🔐 RODAPÉ
    // ═══════════════════════════════════════════════════════════

    const rodape = `

${c.cyan("╔" + caixaTopo + "╗")}
${c.cyan("║")}  ${c.verde.bold("🔐 SISTEMA NAGATORO")}                              ${c.cyan("║")}
${c.cyan("║")}  ${c.cinza("Status:")} ${c.verde.bold("● OPERACIONAL")}
${c.cyan("║")}  ${c.cinza("Motor :")} ${c.branco("Node.js")}
${c.cyan("║")}  ${c.cinza("Canal :")} ${c.branco("WhatsApp")}
${c.cyan("╚" + caixaTopo + "╝")}

${c.roxo(linha)}
${c.rosa.bold("        ✦  NAGATORO • SISTEMA ONLINE  ✦")}
${c.roxo(linha)}
`;


    // ═══════════════════════════════════════════════════════════
    // 🖨️ EXIBIÇÃO FINAL
    // ═══════════════════════════════════════════════════════════

    const output = `

${c.vermelho(asciiArt)}

${c.cyan("╔" + caixaTopo + "╗")}
${c.cyan("║")}        ${titulo}        ${c.cyan("║")}
${c.cyan("║")}        ${subtitulo}        ${c.cyan("║")}
${c.cyan("╚" + caixaTopo + "╝")}

${informacoes}
${mensagens}
${rodape}
`;

    console.log(output);
};












