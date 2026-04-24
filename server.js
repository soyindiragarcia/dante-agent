import express from 'express';
import dotenv from 'dotenv';
import { handleTelegramMessage } from './src/telegram.js';
import { initSupabase } from './src/supabase.js';
import { getAuthUrl, handleGoogleCallback } from './src/google-calendar.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const supabase = initSupabase();

app.get('/health', (req, res) => {
  res.json({ status: 'DANTE is alive', timestamp: new Date() });
});

// Google OAuth — iniciar autorización
app.get('/auth/google', (req, res) => {
  const account = req.query.account || 'personal';
  const url = getAuthUrl(account);
  res.redirect(url);
});

// Google OAuth — callback con el código
app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('No se recibió código de autorización.');
  try {
    const tokens = await handleGoogleCallback(code);
    const account = state || 'personal';
    const envKey = `GOOGLE_REFRESH_TOKEN_${account.toUpperCase()}`;
    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:700px">
        <h1>✅ Google Calendar autorizado</h1>
        <p><strong>Cuenta:</strong> ${account}</p>
        <p>Agrega esta variable a Railway (en Variables de entorno):</p>
        <p><strong>Nombre:</strong> <code>${envKey}</code></p>
        <p><strong>Valor:</strong></p>
        <textarea style="width:100%;height:80px;font-family:monospace">${tokens.refresh_token}</textarea>
        <br><br>
        <p>Repite el proceso para las otras cuentas:</p>
        <ul>
          <li><a href="/auth/google?account=clientes">Autorizar cuenta CLIENTES</a></li>
          <li><a href="/auth/google?account=personal">Autorizar cuenta PERSONAL</a></li>
          <li><a href="/auth/google?account=empresa">Autorizar cuenta EMPRESA</a></li>
        </ul>
      </body></html>
    `);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.post(`/webhook/telegram`, async (req, res) => {
  try {
    const update = req.body;
    if (update.message) {
      await handleTelegramMessage(update.message, supabase);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🧠 DANTE running on port ${port}`);
});