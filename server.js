import express from 'express';
import dotenv from 'dotenv';
import { handleTelegramMessage } from './src/telegram.js';
import { initSupabase } from './src/supabase.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const supabase = initSupabase();

app.get('/health', (req, res) => {
  res.json({ status: 'DANTE is alive', timestamp: new Date() });
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