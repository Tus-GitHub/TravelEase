import net from 'node:net';
import assert from 'node:assert/strict';

// A receiving sink only: no delivery/relay code and no external listener.
export async function localMailSink(recipients) {
  const messages = [], rejected = [], sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {}); socket.setTimeout(30000, () => socket.destroy());
    let buffer = '', data = false, content = [], to = [];
    const reply = line => socket.write(line + '\r\n');
    reply('220 localhost booking test sink');
    socket.on('data', chunk => {
      buffer += chunk.toString();
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n'), line = buffer.slice(0, end).replace(/\r$/, ''); buffer = buffer.slice(end + 1);
        if (data) {
          if (line === '.') { messages.push({ to: [...to], content: content.join('\n') }); data = false; content = []; to = []; reply('250 captured locally'); }
          else content.push(line.replace(/^\.\./, '.'));
        } else if (/^EHLO|^HELO/i.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH PLAIN/i.test(line)) reply('235 test authentication');
        else if (/^MAIL FROM:/i.test(line)) { to = []; reply('250 sender accepted'); }
        else if (/^RCPT TO:/i.test(line)) {
          const address = line.match(/<([^>]+)>/)?.[1];
          if (!recipients.includes(address)) { rejected.push(address); reply('550 only this test run recipients allowed'); }
          else { to.push(address); reply('250 recipient accepted'); }
        } else if (/^DATA$/i.test(line)) { assert(to.length); data = true; reply('354 end with dot'); }
        else if (/^QUIT$/i.test(line)) { reply('221 bye'); socket.end(); }
        else if (/^RSET|^NOOP/i.test(line)) { to = []; reply('250 ok'); }
        else reply('500 unsupported test command');
      }
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { messages, rejected, port: server.address().port,
    async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
