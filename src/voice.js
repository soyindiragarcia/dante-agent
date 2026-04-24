import axios from 'axios';
import FormData from 'form-data';

export async function transcribeVoiceMessage(fileId) {
  // 1. Obtener la ruta del archivo en Telegram
  const fileInfo = await axios.get(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile`,
    { params: { file_id: fileId } }
  );
  const filePath = fileInfo.data.result.file_path;

  // 2. Descargar el audio
  const audioResponse = await axios.get(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`,
    { responseType: 'arraybuffer' }
  );
  const audioBuffer = Buffer.from(audioResponse.data);

  // 3. Enviar a Groq Whisper para transcribir
  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: 'voice.ogg',
    contentType: 'audio/ogg',
  });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'es');
  form.append('response_format', 'text');

  const response = await axios.post(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
    }
  );

  console.log(`🎤 Transcripción: ${response.data}`);
  return response.data;
}
