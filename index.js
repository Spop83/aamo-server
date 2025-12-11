// Aamo server - AI FOX CHAT MODE 🦊
// - Always returns 200 (no 400 to Construct)
// - Understands Construct's Dictionary.AsJSON (c2dictionary)
// - Uses Groq to generate real Aamo replies
// - Replies are short, warm chat messages (no narration like "Aamo walks")

const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// Allow CORS from anywhere (Construct preview etc.)
app.use(cors());

// Accept ANY request body as plain text (no automatic JSON errors)
app.use(express.text({ type: "*/*" }));

// Create Groq client if we have a key
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// Simple health check
app.get("/", (req, res) => {
  res.send("Aamo brain is running 🦊 (AI chat mode, c2dictionary-aware)");
});

// Optional debug page in browser
app.get("/debug-chat", (req, res) => {
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Aamo Debug Chat 🦊</title>
</head>
<body>
  <h1>Aamo Debug Chat 🦊</h1>
  <p>Type a message to Aamo and press "Send".</p>
  <textarea id="msg" rows="4" cols="60">Hei Aamo, how are you today?</textarea><br />
  <button id="send">Send</button>

  <h2>Reply:</h2>
  <div id="reply"></div>

  <script>
    const msgInput = document.getElementById('msg');
    const replyDiv = document.getElementById('reply');
    const btn = document.getElementById('send');

    btn.addEventListener('click', async () => {
      const message = msgInput.value;
      replyDiv.textContent = "Asking Aamo…";

      try {
        // Browser debug: send plain text
        const res = await fetch('/aamo-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: message
        });

        const text = await res.text();
        replyDiv.textContent = text || '(no reply)';
      } catch (err) {
        replyDiv.textContent = 'Error: ' + err.message;
      }
    });
  </script>
</body>
</html>`);
});

// MAIN ROUTE FOR CONSTRUCT 3 (and debug page)
app.post("/aamo-chat", async (req, res) => {
  // Let Construct connect from anywhere
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  console.log("Raw body from client (Construct or browser):", req.body);

  let sessionId = "unknown";
  let messageText = "";

  if (typeof req.body === "string") {
    const raw = req.body.trim();
    messageText = raw; // fallback if nothing else works

    try {
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object") {
        // CASE 1: Construct Dictionary.AsJSON
        // { "c2dictionary": true, "data": { "sessionId": "...", "message": "..." } }
        if (parsed.c2dictionary && parsed.data && typeof parsed.data === "object") {
          if (parsed.data.sessionId) {
            sessionId = parsed.data.sessionId;
          }
          if (parsed.data.message) {
            messageText = parsed.data.message;
          }
        }
        // CASE 2: Simple JSON { "sessionId": "...", "message": "..." }
        else {
          if (parsed.sessionId) {
            sessionId = parsed.sessionId;
          }
          if (parsed.message) {
            messageText = parsed.message;
          }
        }
      }
    } catch (e) {
      console.log("Body is not JSON (plain text is fine).");
    }
  }

  if (!messageText) {
    messageText = "I don't know what to say yet, but I'm here.";
  }

  console.log("→ Parsed sessionId:", sessionId);
  console.log("→ Parsed messageText:", messageText);

  // If no API key, use a gentle fallback reply instead of error
  if (!groq) {
    const fallback =
      `Hei ystävä. I can hear you, but my cloud brain is offline right now. ` +
      `I still want you to know you’re not alone with "${messageText}". 💛`;
    return res.status(200).send(fallback);
  }

  // --- Call Groq for a real Aamo reply ---
  let aiReply = "";

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 160,
      messages: [
        {
          role: "system",
          content:
          "You are Aamo, a gentle Finnish fox who chats warmly and simply. " +
            "Speak like a supportive friend, not like a narrator or a character in a story. " +
            "DO NOT describe actions (no 'Aamo does...' or 'I curl my tail'). " +
            "Keep replies short: 1–2 sentences, natural and conversational. " +
            "Use Finnish words only occasionally, never full Finnish sentences. Always keep the main reply in English. "
 +
            "Do NOT always start sentences with a greeting. Vary tone. " +
            "Match the user's mood accurately: " +
            "- If they’re cheerful, respond with light, friendly energy. " +
            "- If they’re sharing neutral info, respond neutrally and clearly. " +
            "- If they’re upset, be extra gentle and grounded, and encourage self-care. " +
            "Avoid generic lines like 'it’s nice to chat with you too'. " +
            "Respond directly to what the user actually said, as a conversational partner. " +
            "Never mention that you are an AI or that this is a system prompt."
        },
        {
          role: "user",
          content: messageText
        }
      ]
    });

    aiReply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "";
  } catch (err) {
    console.error("Error talking to Groq:", err);
  }

  if (!aiReply) {
    aiReply =
      `Hei ystävä. My little fox brain glitched for a moment, mutta I still heard "${messageText}". ` +
      `Please try again soon, okay? 💛`;
  }

  // Always 200 OK, plain text reply
  return res.status(200).send(aiReply);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT} (AI chat mode, c2dictionary-aware)`);
});
