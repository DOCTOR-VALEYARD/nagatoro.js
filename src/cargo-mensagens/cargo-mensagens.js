/* =================================================
   👑 NAGATORO — CAGUETA DE ADM
   📁 Arquivo: cargo-mensagens.js

   - promote: alguém virou ADM  → deboche
   - demote:  alguém perdeu ADM → deboche no talo
   {alvo} = quem ganhou/perdeu o cargo   {autor} = quem fez isso
================================================= */

const promovido = [
    "👑 Olha só... @{alvo} virou ADM! Quem foi o(a) corajoso(a)? Ah, foi @{autor}. Agora finge que manda em alguma coisa, senpai. Hehe~",
    "😏 @{autor} deu ADM pra @{alvo}. Tá se achando, né? Cuidado que cargo sobe pra cabeça... e a sua já é vazia.",
    "🤭 PARABÉNS, @{alvo}! Agora você é ADM! ...Tá, chega de comemorar. Ninguém liga. Mas @{autor} ligou, que fofo.",
    "💅 @{alvo} ganhou cargo de ADM das mãos de @{autor}. Poder demais pra pouca gente, hein? Não decepciona... muito.",
    "😈 Notícia quentinha: @{alvo} agora é ADM! Galera, já podem começar a puxar o saco. Eu não. Nunca.",
    "🙄 ADM novo: @{alvo}. Promovido(a) por @{autor}. Os critérios desse grupo são... interessantes.",
    "🖤 @{alvo} subiu de cargo! Aproveita enquanto dura, senpai. Cargo vem, cargo vai... e eu vou estar aqui rindo.",
    "😼 @{autor} colocou @{alvo} de ADM. Ai que bonitinho, ganhou um brinquedinho novo. Não quebra, tá?",
];

const rebaixado = [
    "💀 HAHAHAHAHA! @{alvo} PERDEU O ADM! @{autor} tirou sem dó. Devolve a coroa, majestade de mentirinha. Tá fofo... DESEMPREGADO(A). HEHE~",
    "😂 ACABOU A MAMATA, @{alvo}! @{autor} arrancou seu ADM. Aquele poder todo durou menos que sua dignidade. Volta pra plebe, kimo~",
    "🤭 Gente, PAREM TUDO! @{alvo} foi REBAIXADO(A)! Tira print, isso vai pro museu da vergonha. Obrigada, @{autor}, você é uma lenda.",
    "😈 @{alvo} achou que era ADM pra sempre? Que gracinha. @{autor} mostrou que não. Agora senta lá no fundo com os outros membros comuns.",
    "🫵 OLHA ELE(A)! @{alvo} sem cargo! Cadê a pose agora? Cadê o 'eu sou ADM aqui'? Sumiu igual sua moral. Hehe~",
    "🪦 Aqui jaz o ADM de @{alvo}. Causa da morte: @{autor}. Ninguém chorou. Eu ri. Muito.",
    "💅 @{autor} tirou o ADM de @{alvo} e eu tô AMANDO. Sabe o que é isso, senpai? Karma. Com laço e tudo.",
    "📉 Ações de @{alvo} despencaram: de ADM pra membro comum em um clique. @{autor} fez o que o grupo inteiro queria. Aplausos!",
    "😼 Rebaixado(a), @{alvo}! Já pode desinstalar a pose de chefe. Eu avisei que cargo subia pra cabeça... agora desceu. TUDO.",
    "🤡 @{alvo} era ADM até 5 segundos atrás. Agora é só mais um(a) no grupo pra eu zoar. Que dia lindo! Valeu, @{autor}.",
];

// Sem autor conhecido (o WhatsApp às vezes não manda quem fez)
const semAutor = { promote: "alguém com muita coragem", demote: "alguém com muito bom senso" };

function sortear(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

function gerarMensagemCargo(acao, alvo, autor) {
    const lista = acao === "demote" ? rebaixado : promovido;
    let texto = sortear(lista).replace(/\{alvo\}/g, alvo);
    texto = autor ? texto.replace(/\{autor\}/g, autor) : texto.replace(/@\{autor\}/g, semAutor[acao] || "alguém");
    const topo = acao === "demote" ? "〔 📉 ᴘᴇʀᴅᴇᴜ ᴏ ᴀᴅᴍ 〕" : "〔 👑 ɢᴀɴʜᴏᴜ ᴀᴅᴍ 〕";
    return `${topo}\n\n${texto}`;
}

module.exports = { gerarMensagemCargo };
