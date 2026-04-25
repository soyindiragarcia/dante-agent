import express from 'express';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { handleTelegramMessage } from './src/telegram.js';
import { initSupabase } from './src/supabase.js';
import { getAuthUrl, handleGoogleCallback, saveGoogleAccount, listGoogleAccounts } from './src/google-calendar.js';
import { checkAndSendReminders, checkAndSendRecurringReminders } from './src/reminders.js';

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
    const { tokens, email } = await handleGoogleCallback(code);
    const account = state || 'personal';

    if (!tokens.refresh_token) {
      return res.send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:700px;background:#fff3cd">
          <h1>⚠️ No se recibió refresh_token</h1>
          <p>Google solo entrega el refresh_token la primera vez. Si ya autorizaste esta cuenta antes, revoca el acceso y vuelve a autorizar:</p>
          <p>1. Ve a <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a></p>
          <p>2. Busca "DANTE Agent" y revoca el acceso</p>
          <p>3. Vuelve a <a href="/auth/google?account=${account}">autorizar la cuenta</a></p>
        </body></html>
      `);
    }

    // Guardar en Supabase
    await saveGoogleAccount(account, email, tokens.refresh_token);
    const accounts = await listGoogleAccounts();

    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:700px">
        <h1>✅ Cuenta autorizada</h1>
        <p><strong>Cuenta:</strong> ${account}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>El token fue guardado automáticamente en Supabase. ¡No necesitas hacer nada más!</p>
        <hr>
        <h2>Cuentas autorizadas (${accounts.length})</h2>
        <ul>${accounts.map(a => `<li>✅ <strong>${a.name}</strong> — ${a.email}</li>`).join('')}</ul>
        <hr>
        <h2>Autorizar otra cuenta</h2>
        <p>Escribe el nombre de la nueva cuenta y abre el link:</p>
        <ul>
          <li><a href="/auth/google?account=clientes">Cuenta: clientes</a></li>
          <li><a href="/auth/google?account=personal">Cuenta: personal</a></li>
          <li><a href="/auth/google?account=empresa">Cuenta: empresa</a></li>
        </ul>
        <p>O agrega una personalizada: <code>/auth/google?account=NOMBRE</code></p>
      </body></html>
    `);
  } catch (error) {
    res.status(500).send(`<pre>Error: ${error.message}\n${error.stack}</pre>`);
  }
});

// Ver cuentas autorizadas
app.get('/auth/google/accounts', async (req, res) => {
  try {
    const accounts = await listGoogleAccounts();
    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:700px">
        <h1>🔑 Cuentas Google autorizadas</h1>
        ${accounts.length === 0
          ? '<p>No hay cuentas autorizadas aún.</p>'
          : `<ul>${accounts.map(a => `<li>✅ <strong>${a.name}</strong> — ${a.email}</li>`).join('')}</ul>`}
        <hr>
        <h2>Autorizar nueva cuenta</h2>
        <ul>
          <li><a href="/auth/google?account=clientes">Cuenta: clientes</a></li>
          <li><a href="/auth/google?account=personal">Cuenta: personal</a></li>
          <li><a href="/auth/google?account=empresa">Cuenta: empresa</a></li>
        </ul>
        <p>Personalizada: <code>/auth/google?account=NOMBRE</code></p>
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

// Cron job: revisa recordatorios cada minuto (puntuales + recurrentes)
cron.schedule('* * * * *', async () => {
  try {
    await checkAndSendReminders();
    await checkAndSendRecurringReminders();
  } catch (err) {
    console.error('Reminders cron error:', err.message);
  }
});

app.listen(port, () => {
  console.log(`🧠 DANTE running on port ${port}`);
  console.log(`⏰ Recordatorios activos (revisión cada minuto)`);
});