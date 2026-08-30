import { Resend } from 'resend';

interface EmailParams {
  to: string;
  clientName: string;
  serviceName: string;
  date: string;
  startTime: string;
}

export async function sendBookingConfirmation({
  to,
  clientName,
  serviceName,
  date,
  startTime,
}: EmailParams) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('[EMAIL ERROR] Brak RESEND_API_KEY w pliku .env.local!');
    return;
  }

  const resend = new Resend(apiKey);
  console.log(`[EMAIL] Rozpoczynam wysyłkę do: ${to}`);

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [to],
      subject: `Powiadomienie: ${serviceName}`,
      html: `
        <h2>Witaj ${clientName},</h2>
        <p>Szczegóły wizyty: <strong>${serviceName}</strong></p>
        <p>Data: <strong>${date} ${startTime}</strong></p>
      `,
    });

    if (error) {
      console.error('[EMAIL ERROR] Resend odrzucił e-mail:', error);
    } else {
      console.log('[EMAIL SUCCESS] Mail wysłany! ID:', data?.id);
    }
  } catch (err) {
    console.error('[EMAIL CRASH] Wyjątek podczas wysyłki:', err);
  }
}