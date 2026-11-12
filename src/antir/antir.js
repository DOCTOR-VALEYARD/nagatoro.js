/* =================================================
   🚧 ANTIR — PROTEÇÃO CONTRA INVASÃO EM MASSA (RAID)
   Comando: <prefixo>antir

   Faz duas coisas (por grupo, quando ligado):

   1) SOLICITAÇÕES INSISTENTES: se a MESMA pessoa fica mandando pedido
      de entrada de novo e de novo (padrão: 3 vezes), o bot:
        • recusa (dispensa) a solicitação,
        • coloca a pessoa na lista negra do antir daquele grupo,
        • passa a recusar automaticamente qualquer novo pedido dela
          naquele grupo — sempre que o WhatsApp permitir (grupo com
          "aprovar novos membros" ligado e bot admin).

   2) ENTRADA EM MASSA (raid): muita gente entrando em poucos segundos
      dispara um alerta para os admins e, se o "fechar" estiver ligado,
      o bot fecha o grupo (só admins falam) para estancar — depois um
      admin reabre com <prefixo>abrir.

   ⚠️ Limite do WhatsApp: ninguém consegue IMPEDIR que um número envie
   solicitação. O que dá pra fazer — e o antir faz — é recusar na hora,
   automaticamente, todo pedido de quem está na lista negra.
================================================= */
const config = require("../../config");
const B = require("../seguranca-base/seguranca-base");

const SISTEMA = "antir";
const PADRAO = {
    on: false,
    limitePedidos: 3,     // nº de pedidos até cair na lista negra
    janelaPedidos: 3600000, // 1h: janela pra contar os pedidos insistentes
    raidQtd: 5,           // nº de entradas
    raidJanela: 20000,    // em 20s = raid
    fecharNoRaid: false,  // fechar o grupo quando detectar raid
    negra: [],            // números na lista negra
    pedidos: {}           // numero -> { marcas:[timestamps] }
};

const entradasRecentes = B.mapaLimitado(2000); // grupo -> [timestamps]
const raidAvisado = B.mapaLimitado(2000);       // grupo -> ate(ts)

function numeroDoEvento(dados) {
    const p = dados?.participant || dados?.participants?.[0];
    return typeof p === "string" ? p : (p?.id || p?.jid || null);
}

// ==================================================
// 🙋 SOLICITAÇÃO DE ENTRADA — recusa insistência / lista negra
// Retorna true se JÁ resolveu (recusou) a solicitação.
// ==================================================
async function tratarSolicitacao(sock, dados) {
    try {
        const grupo = dados?.id;
        const participante = dados?.participant;
        if (!grupo?.endsWith("@g.us") || !participante) return false;
        // só pedido novo (quando outra pessoa resolve, author != participant)
        if (dados.author && B.norm(dados.author) !== B.norm(participante)) return false;
        // pedido cancelado pela própria pessoa / recusado: não conta como pedido novo
        const acao = String(dados.action || "").toLowerCase();
        if (["revoked", "rejected", "approved", "cancelled", "canceled"].includes(acao)) return false;

        const LN = require("../lista-negra/lista-negra");
        // todos os ids da pessoa (lid + número, quando o WhatsApp manda)
        const idsPessoa = [participante, dados.participantPn, dados.participantAlt, dados.participantPhoneNumber]
            .filter(v => typeof v === "string" && v).map(B.norm).filter(Boolean);
        const chave = B.norm(participante);

        // 🚫 Está na lista negra (comando lista OU antir) → recusa SEMPRE, mesmo com antir desligado
        if (LN.estaNaLista(grupo, idsPessoa)) {
            const ok = await recusar(sock, grupo, participante);
            console.log(`🚧 [antir] pedido de ${chave} recusado (lista negra) em ${grupo}: ${ok}`);
            return true;
        }

        const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
        if (!cfg.on) return false;

        // Conta insistência (pedidos seguidos da MESMA pessoa)
        const agora = Date.now();
        const pedidos = { ...(cfg.pedidos || {}) };
        const reg = pedidos[chave] || { marcas: [] };
        reg.marcas = (reg.marcas || []).filter(t => agora - t < cfg.janelaPedidos);
        // o WhatsApp às vezes manda o MESMO pedido 2x em seguida: não conta em dobro
        if (reg.marcas.length && agora - reg.marcas[reg.marcas.length - 1] < 3000) return false;
        reg.marcas.push(agora);
        pedidos[chave] = reg;

        if (reg.marcas.length >= Math.max(2, cfg.limitePedidos)) {
            const negra = new Set(cfg.negra || []);
            idsPessoa.forEach(i => negra.add(i));
            delete pedidos[chave];
            B.salvarCfg(grupo, SISTEMA, { negra: [...negra].slice(-1000), pedidos });
            try { LN.adicionar(grupo, ...idsPessoa); } catch {}
            const ok = await recusar(sock, grupo, participante);
            await B.enviar(sock, grupo, {
                text: `〔 🚧 ᴀɴᴛɪʀ — ʟɪsᴛᴀ ɴᴇɢʀᴀ 〕\n\n👤 @${B.norm(dados.participantPn || participante)}\n📌 Mandou ${reg.marcas.length} solicitações seguidas.\n🚫 Cancelei o pedido e coloquei na lista negra${ok ? "" : " (não consegui recusar agora — preciso ser admin)"}.\n\nTodo novo pedido dele(a) será recusado automaticamente — e se entrar, é removido.\n\n${B.rodape()}`,
                mentions: [participante]
            });
            return true;
        }

        B.salvarCfg(grupo, SISTEMA, { pedidos });
        return false; // ainda não insistiu o bastante: deixa o fluxo normal (card de solicitação) seguir
    } catch (e) {
        console.error("⚠️ [antir] erro na solicitação (contido):", e?.message || e);
        return false;
    }
}

async function recusar(sock, grupo, participante) {
    try { await sock.groupRequestParticipantsUpdate(grupo, [participante], "reject"); return true; }
    catch (e) { console.error("⚠️ [antir] falha ao recusar:", e?.message || e); return false; }
}

// ==================================================
// 👥 ENTRADA EM MASSA (raid) — chamado no group-participants.update (add)
// ==================================================
async function tratarEntrada(sock, dados) {
    try {
        const grupo = dados?.id;
        if (!grupo?.endsWith("@g.us") || dados.action !== "add") return;
        const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
        if (!cfg.on) return;

        const agora = Date.now();
        const lista = (entradasRecentes.get(grupo) || []).filter(t => agora - t < cfg.raidJanela);
        const quantos = (dados.participants || []).length || 1;
        for (let i = 0; i < quantos; i++) lista.push(agora);
        entradasRecentes.set(grupo, lista);

        if (lista.length < Math.max(3, cfg.raidQtd)) return;
        // evita repetir o alerta a cada entrada do mesmo surto
        if ((raidAvisado.get(grupo) || 0) > agora) return;
        raidAvisado.set(grupo, agora + cfg.raidJanela);
        entradasRecentes.set(grupo, []);

        if (!(await B.botEhAdmin(sock, grupo))) {
            console.log(`🚧 [antir] raid detectado em ${grupo}, mas o bot não é admin.`);
            return;
        }

        let fechou = false;
        if (cfg.fecharNoRaid) {
            try { await sock.groupSettingUpdate(grupo, "announcement"); fechou = true; } catch (e) { console.error("⚠️ [antir] falha ao fechar:", e?.message || e); }
        }

        await B.enviar(sock, grupo, {
            text: `〔 🚧 ᴀɴᴛɪʀ — ᴇɴᴛʀᴀᴅᴀ ᴇᴍ ᴍᴀssᴀ 〕\n\n⚠️ Detectei *${lista.length}* entradas em poucos segundos — isso tem cara de invasão.\n` +
                (fechou
                    ? `🔒 Fechei o grupo (só admins falam). Reabra com *${config.PREFIX}abrir* quando normalizar.\n`
                    : `👮 Admins, confiram quem entrou agora.\n`) +
                `\n${B.rodape()}`
        });
    } catch (e) {
        console.error("⚠️ [antir] erro na entrada (contido):", e?.message || e);
    }
}

// ==================================================
// 🔌 INSTALA os ouvintes próprios do antir (não mexe nos já existentes)
// ==================================================
function instalarAntir(sock) {
    try {
        // Solicitações são tratadas pelo listener de grupo, antes do
        // autoaceite, para evitar corrida e contagem duplicada.
        sock.ev.on("group-participants.update", (dados) => { tratarEntrada(sock, dados).catch(() => {}); });
    } catch (e) { console.error("⚠️ [antir] falha ao instalar ouvintes:", e?.message || e); }
}

// ==================================================
// ⚙️ COMANDO <prefixo>antir
// ==================================================
async function cmdAntir(sock, msg, args = []) {
    const grupo = msg.key.remoteJid;
    const P = config.PREFIX;
    if (!grupo?.endsWith("@g.us")) return B.enviar(sock, grupo, { text: "🚧 Esse comando só funciona em grupos." }, { quoted: msg });
    const autor = B.autorMsg(msg);
    if (!msg.key.fromMe && !(await B.ehAdminGrupo(sock, grupo, [autor, msg.key.participantAlt]))) {
        return B.enviar(sock, grupo, { text: "❌ Só administrador mexe na proteção." }, { quoted: msg });
    }

    const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
    const sub = String(args[0] || "").toLowerCase();
    const resto = args.slice(1).join(" ").trim();
    const estado = B.lerEstado(sub);

    if (estado !== null) {
        B.salvarCfg(grupo, SISTEMA, { on: estado });
        let extra = "";
        if (estado) {
            const temAdm = await B.botEhAdmin(sock, grupo);
            extra = temAdm ? "\n\n💡 Pra recusar pedidos sozinho, deixe o grupo em *aprovar novos membros* nas configurações do WhatsApp." : "\n\n⚠️ Me dá *admin*, senão não consigo recusar pedidos nem fechar o grupo.";
        }
        return B.enviar(sock, grupo, { text: `〔 🚧 ᴀɴᴛɪʀ 〕\n\n🔒 Estado: *${B.onOff(estado)}*${extra}\n\n${B.rodape()}` }, { quoted: msg });
    }

    if (sub === "limite") {
        const n = parseInt(args[1], 10);
        if (!(n >= 2 && n <= 20)) return B.enviar(sock, grupo, { text: `Use: ${P}antir limite 3 (2 a 20 pedidos)` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { limitePedidos: n });
        return B.enviar(sock, grupo, { text: `🚧 Lista negra após *${n}* pedidos.` }, { quoted: msg });
    }
    if (sub === "raid") {
        const n = parseInt(args[1], 10);
        if (!(n >= 3 && n <= 50)) return B.enviar(sock, grupo, { text: `Use: ${P}antir raid 5 (3 a 50 entradas)` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { raidQtd: n });
        return B.enviar(sock, grupo, { text: `🚧 Alerta de raid a partir de *${n}* entradas em ${Math.round(cfg.raidJanela / 1000)}s.` }, { quoted: msg });
    }
    if (sub === "fechar") {
        const v = B.lerEstado(args[1]);
        if (v === null) return B.enviar(sock, grupo, { text: `Use: ${P}antir fechar on / off` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { fecharNoRaid: v });
        return B.enviar(sock, grupo, { text: `🚧 Fechar grupo no raid: *${v ? "sim" : "não"}*` }, { quoted: msg });
    }
    if (sub === "add" || sub === "del") {
        const adicionar = sub === "add";
        let alvo = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])[0]
            || msg.message?.extendedTextMessage?.contextInfo?.participant
            || (resto.replace(/\D/g, "") ? `${resto.replace(/\D/g, "")}@s.whatsapp.net` : null);
        if (!alvo) return B.enviar(sock, grupo, { text: `❌ Marque a pessoa, responda a mensagem dela, ou passe o número.\nEx.: ${P}antir ${sub} @fulano` }, { quoted: msg });
        const chave = B.norm(alvo);
        const negra = new Set(cfg.negra || []);
        adicionar ? negra.add(chave) : negra.delete(chave);
        B.salvarCfg(grupo, SISTEMA, { negra: [...negra].slice(-1000) });
        return B.enviar(sock, grupo, { text: `🚧 @${chave} ${adicionar ? "entrou na" : "saiu da"} lista negra do antir.`, mentions: [alvo] }, { quoted: msg });
    }
    if (sub === "lista") {
        const negra = (cfg.negra || []).map(n => `• ${n}`).join("\n") || "ninguém";
        return B.enviar(sock, grupo, { text: `〔 🚧 ʟɪsᴛᴀ ɴᴇɢʀᴀ ᴀɴᴛɪʀ 〕\n\n${negra}\n\n${B.rodape()}` }, { quoted: msg });
    }
    if (sub === "limpar") {
        B.salvarCfg(grupo, SISTEMA, { negra: [], pedidos: {} });
        return B.enviar(sock, grupo, { text: "🚧 Lista negra do antir limpa." }, { quoted: msg });
    }

    return B.enviar(sock, grupo, {
        text: `〔 🚧 ᴀɴᴛɪʀ — ɪɴᴠᴀsᴀ̃ᴏ ᴇᴍ ᴍᴀssᴀ 〕\n\n` +
            `🔒 Estado: *${B.onOff(cfg.on)}*\n` +
            `🙋 Lista negra após: *${cfg.limitePedidos}* pedidos\n` +
            `👥 Alerta de raid: *${cfg.raidQtd}* entradas / ${Math.round(cfg.raidJanela / 1000)}s\n` +
            `🔒 Fechar no raid: *${cfg.fecharNoRaid ? "sim" : "não"}*\n` +
            `🚫 Na lista negra: *${(cfg.negra || []).length}*\n\n` +
            `❀ ${P}antir on / off\n❀ ${P}antir limite 3\n❀ ${P}antir raid 5\n❀ ${P}antir fechar on / off\n❀ ${P}antir add @pessoa / del @pessoa\n❀ ${P}antir lista / limpar\n\n` +
            `💡 Pro antir recusar sozinho, deixe o grupo em *aprovar novos membros* e o bot como *admin*.\n\n${B.rodape()}`
    }, { quoted: msg });
}

module.exports = { instalarAntir, tratarSolicitacao, tratarEntrada, cmdAntir };
