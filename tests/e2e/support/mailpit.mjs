// Lectura dels correus que captura Mailpit (API REST: https://mailpit.axllent.org/docs/api-v1/).
import { expect } from '@playwright/test';
import { MAILPIT_URL } from './env.mjs';

/** Espera el correu de verificació adreçat a `email` i en retorna l'enllaç `/verificar?token=…`. */
export async function verificationLink(request, email) {
  const query = encodeURIComponent(`to:"${email}" subject:"Confirma tu correo"`);
  let messageId;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILPIT_URL}/api/v1/search?query=${query}`);
        messageId = (await response.json()).messages?.[0]?.ID;
        return messageId;
      },
      { message: `No ha arribat cap correu de verificació a ${email}`, timeout: 15_000 },
    )
    .toBeTruthy();
  const message = await (await request.get(`${MAILPIT_URL}/api/v1/message/${messageId}`)).json();
  const link = message.Text.match(/https?:\/\/\S+\/verificar\?token=[\w-]+/)?.[0];
  expect(link, 'El correu de verificació no porta l\'enllaç').toBeTruthy();
  return link;
}
