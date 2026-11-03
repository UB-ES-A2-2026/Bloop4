import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createMailer } from '../src/mail/mailer.js';

const EMAIL = { to: 'laura@example.com', name: 'Laura', link: 'https://example.com/verificar?token=x' };

// Servidor SMTP mínim: accepta qualsevol correu i desa les ordres que rep.
let commands = [];
const server = createServer((socket) => {
  let inData = false;
  socket.setEncoding('utf8');
  socket.write('220 test\r\n');
  socket.on('data', (chunk) => {
    for (const line of chunk.split('\r\n').filter(Boolean)) {
      if (inData) {
        if (line === '.') {
          inData = false;
          socket.write('250 ok\r\n');
        }
        continue;
      }
      commands.push(line);
      if (line.startsWith('EHLO')) socket.write('250-test\r\n250 AUTH PLAIN\r\n');
      else if (line.startsWith('AUTH')) socket.write('235 ok\r\n');
      else if (line === 'DATA') {
        inData = true;
        socket.write('354 endavant\r\n');
      } else if (line === 'QUIT') socket.end('221 adeu\r\n');
      else socket.write('250 ok\r\n');
    }
  });
});

describe('createMailer', () => {
  let port;

  before(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });
  after(() => server.close());
  beforeEach(() => {
    commands = [];
  });

  it("s'autentica amb l'usuari i la contrasenya (Gmail)", async () => {
    const mailer = createMailer({ host: '127.0.0.1', port, user: 'bloop', pass: 'secret' });
    await mailer.sendVerificationEmail(EMAIL);

    const credentials = Buffer.from('\0bloop\0secret').toString('base64');
    assert.ok(commands.includes(`AUTH PLAIN ${credentials}`), commands.join(' | '));
  });

  it("no s'autentica sense usuari (Mailpit)", async () => {
    const mailer = createMailer({ host: '127.0.0.1', port, user: '', pass: '' });
    await mailer.sendVerificationEmail(EMAIL);

    assert.ok(commands.some((c) => c.startsWith('MAIL FROM')), commands.join(' | '));
    assert.ok(!commands.some((c) => c.startsWith('AUTH')), commands.join(' | '));
  });
});
