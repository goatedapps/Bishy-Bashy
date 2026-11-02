import QRCode from 'qrcode';

const $ = id => document.getElementById(id);

export async function prepareInvite({ room, lanUrls, serverUrl, defaultServer }) {
  const url = new URL(location.href);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && lanUrls.length && serverUrl === defaultServer) url.host = new URL(lanUrls[0]).host;
  url.search = ''; url.searchParams.set('room', room.code);
  const address = new URL(serverUrl);
  if (address.host !== url.host || address.protocol !== (location.protocol === 'https:' ? 'wss:' : 'ws:')) url.searchParams.set('server', serverUrl);
  const inviteUrl = url.href;
  $('invite-link').value = inviteUrl;
  $('copy-link').textContent = 'Copy link';
  $('invite-note').textContent = ['localhost', '127.0.0.1'].includes(url.hostname) ? 'Open this computer’s Wi-Fi address to invite phones on the same network.' : location.protocol === 'https:' ? 'Scan on a phone or share this link. Up to four players.' : 'Connect phones to the same Wi-Fi, then scan or share this link.';
  try { await QRCode.toCanvas($('qr'), inviteUrl, { width: 176, margin: 2, color: { dark: '#3b214d', light: '#fffdf5' } }); }
  catch { $('invite-note').textContent = 'Share the invitation link or enter the room code.'; }
}
