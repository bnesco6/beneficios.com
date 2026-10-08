require('dotenv').config();
const express = require('express');
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
app.use(express.json());

// Permitir solicitudes CORS desde cualquier origen
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-notify-secret');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; // bot token
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // chat id or channel id
const SECRET_KEY = process.env.SECRET_KEY || 'changeme';

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.warn('Warning: TELEGRAM_TOKEN and/or TELEGRAM_CHAT_ID are not set. Edit .env before running.');
}

app.post('/notify', async (req, res) => {
  try {
    const headerSecret = req.header('x-notify-secret') || '';
    if (SECRET_KEY && headerSecret !== SECRET_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, message, buttons } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Missing title or message' });

    const chatId = TELEGRAM_CHAT_ID;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    // prepare inline keyboard if buttons provided
    let reply_markup = undefined;
    if (Array.isArray(buttons) && buttons.length) {
      const keyboard = buttons.map(row => {
        if (Array.isArray(row)) {
          return row.map(btn => btn.callback_data ? { text: btn.text, callback_data: btn.callback_data } : { text: btn.text, url: btn.url });
        }
        return [row.callback_data ? { text: row.text, callback_data: row.callback_data } : { text: row.text, url: row.url }];
      });
      reply_markup = { inline_keyboard: keyboard };
    }

    const body = {
      chat_id: chatId,
      text: `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}`,
      parse_mode: 'HTML'
    };
    if (reply_markup) body.reply_markup = JSON.stringify(reply_markup);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!data || !data.ok) {
      return res.status(502).json({ error: 'Telegram API error', details: data });
    }

    res.json({ ok: true, result: data.result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Notify server listening on http://localhost:${PORT}`);
});

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
