import { Resend } from 'resend';

interface EmailParams {
  to: string;
  clientName: string;
  serviceName: string;
  date: string;
  startTime: string;
  type?: 'confirmation' | 'cancellation';
  salonName?: string;
}

export async function sendBookingConfirmation({
  to,
  clientName,
  serviceName,
  date,
  startTime,
  type = 'confirmation',
  salonName = 'Salon',
}: EmailParams) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('[EMAIL ERROR] Brak RESEND_API_KEY!');
    return;
  }

  const resend = new Resend(apiKey);

  const isCancel = type === 'cancellation' || serviceName.includes('ANULOWAN') || serviceName.includes('ODWOŁAN');

  const subject = isCancel
    ? `❌ Wizyta odwołana — ${salonName}`
    : `✅ Potwierdzenie rezerwacji — ${salonName}`;

  const html = isCancel
    ? `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; padding: 24px; border-radius: 12px;">
        <h2 style="color: #ef4444; margin-top: 0;">Wizyta odwołana ❌</h2>
        <p style="color: #e5e7eb;">Witaj <strong style="color: #fff;">${clientName}</strong>,</p>
        <p style="color: #e5e7eb;">Twoja wizyta w salonie <strong style="color: #f59e0b;">${salonName}</strong> została odwołana.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="color: #9ca3af; padding: 8px 0; border-bottom: 1px solid #333;">Usługa</td>
            <td style="color: #f3f4f6; padding: 8px 0; border-bottom: 1px solid #333;">${serviceName.replace('[ANULOWANO WIZYTĘ]','').replace('[ODWOŁANO WIZYTĘ]','').trim()}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 8px 0; border-bottom: 1px solid #333;">Data</td>
            <td style="color: #f3f4f6; padding: 8px 0; border-bottom: 1px solid #333;">${date}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 8px 0;">Godzina</td>
            <td style="color: #f3f4f6; padding: 8px 0;">${startTime}</td>
          </tr>
        </table>
        <p style="color: #6b7280; font-size: 12px;">W razie pytań skontaktuj się z salonem.</p>
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; padding: 24px; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-top: 0;">Rezerwacja potwierdzona ✅</h2>
        <p style="color: #e5e7eb;">Witaj <strong style="color: #fff;">${clientName}</strong>,</p>
        <p style="color: #e5e7eb;">Twoja wizyta w salonie <strong style="color: #f59e0b;">${salonName}</strong> została potwierdzona.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="color: #9ca3af; padding: 8px 0; border-bottom: 1px solid #333;">Usługa</td>
            <td style="color: #f3f4f6; font-weight: bold; padding: 8px 0; border-bottom: 1px solid #333;">${serviceName}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 8px 0; border-bottom: 1px solid #333;">Data</td>
            <td style="color: #f3f4f6; font-weight: bold; padding: 8px 0; border-bottom: 1px solid #333;">${date}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 8px 0;">Godzina</td>
            <td style="color: #f59e0b; font-weight: bold; font-size: 18px; padding: 8px 0;">${startTime}</td>
          </tr>
        </table>
        <p style="color: #6b7280; font-size: 12px;">Do zobaczenia! 💇</p>
      </div>
    `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('[EMAIL ERROR]', error);
    } else {
      console.log('[EMAIL OK] ID:', data?.id, '→', to);
    }
  } catch (err) {
    console.error('[EMAIL CRASH]', err);
  }
}
