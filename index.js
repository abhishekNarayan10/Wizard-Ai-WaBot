const {default: makeWASocket,AnyMessageContent,DisconnectReason,delay,fetchLatestBaileysVersion,MessageType,MessageOptions, useMultiFileAuthState} = require("@whiskeysockets/baileys");
require("dotenv").config()
const { default: pino } = require("pino");
let { Boom } = require("@hapi/boom");
const {GoogleGenerativeAI} = require("@google/generative-ai")

const prefix = process.env.PREFIX || ".";
const sessionFile = "./session.json";

async function wizard() {
    const {state , saveCreds} = await useMultiFileAuthState(sessionFile)
    const {version , isLatest} = await fetchLatestBaileysVersion
    const zyn = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
        browser: ["Wizard-Ai", "safari", "1.0.0"],
    })
    zyn.ev.on("creds.update", saveCreds);

    zyn.ev.on("connection.update", async (tex) => {
        let { lastDisconnect, connection } = tex;
        if (connection === "connecting") {
          console.log("Connecting to Whatsapp...");
        }
        if (connection === "open") {
          await zyn.sendMessage(zyn.user.id, {
            text:
              "*BOT STARTED SUCCESSFULLY!*",
            });
          console.log("Successfully connected to Whatsapp!")
          console.log("\n\nBOT STARTED SUCCESSFULLY!");
        }
        if (connection === "close") {
          let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
          if (reason === DisconnectReason.badSession) {
            console.log(
              `Bad Session!, Please Delete ${sessionFile} and Scan Again`
            );
            zyn.logout();
          } else if (reason === DisconnectReason.connectionClosed) {
            console.log("Connection closed!, reconnecting....")
            wizard();
          } else if (reason === DisconnectReason.connectionLost) {
            console.log("Connection Lost from Server!, Reconnecting...")
            wizard();
          } else if (reason === DisconnectReason.connectionReplaced) {
            console.log(
                "Connection Replaced!, Another Session Opened, Please Close Current Session"
            );
            zyn.logout();
          } else if (reason === DisconnectReason.loggedOut) {
            console.log(
                `Device Logged Out, Please Delete  '${sessionFile}'  and Scan Again.`
            );
            zyn.logout();
          } else if (reason === DisconnectReason.restartRequired) {
            console.log("Restart Required, Restarting...");
            wizard();
          } else if (reason === DisconnectReason.timedOut) {
            console.log(
               "Connection TimedOut,"+" Reconnecting..."
            );
            wizard();
          } else {
            zyn.end(`DisconnectReason: ${reason}|${lastDisconnect.error}`)
          }
        }
    })

    zyn.ev.on("messages.upsert", async(m) => {
        try{
            let userName = m.messages[0].pushName
            const q = m.messages[0];
            if (!q) return;
            const messageTypes = Object.keys(q?.message);
            const messageType = messageTypes[0];
            const id = m.messages[0].key.remoteJid;

            let body = ''
            if (messageType === 'conversation' && m.type === 'notify') {
                var grpMsg = q.message.conversation
                body = grpMsg
            } else if (messageType === 'extendedTextMessage' && m.type === 'notify') {
                var dmMsg = q.message.extendedTextMessage.text
                body = dmMsg
            }
            const reply = async(msg) => {
                await zyn.sendMessage(id, { text: msg }, { quoted: q });
            };
            const read = () => {
                zyn.readMessages([q.key]);
            };
            const type = () => {
                zyn.sendPresenceUpdate("composing", id);
                delay(1000);
            };


            if(body){
                read(),type()
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
                async function ask(query) {
                  const model = genAI.getGenerativeModel({ model: "gemini-pro-vision"});
                  const result = await model.generateContent(query);
                  const response = await result.response;
                  const text = response.text();
                  await reply('✦ ' + text);
                }
              ask(body)
            }
            
        }catch(err){
          console.log(err)
        }
    })
    
}
wizard()
