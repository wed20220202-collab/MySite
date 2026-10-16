/* WebAuthn runs in the first-party GitHub Pages document, never in the
 * cross-origin Apps Script iframe. The caller must authenticate the message
 * source, origin, and per-page nonce before calling handle(). */
(() => {
  'use strict';
  const MAX_B64URL = 4096;
  let busy = false;

  function bytes(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > MAX_B64URL) {
      throw new Error('セキュリティキーの要求が正しくありません。');
    }
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(decoded, character => character.charCodeAt(0));
  }

  function base64url(value) {
    const data = new Uint8Array(value);
    let binary = '';
    for (const byte of data) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function optionsFor(action, raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('セキュリティキーの要求が正しくありません。');
    if (action === 'create') {
      if (!raw.rp || raw.rp.id !== location.hostname || !raw.user || !Array.isArray(raw.pubKeyCredParams)) {
        throw new Error('セキュリティキーの登録先が正しくありません。');
      }
      return {
        ...raw,
        challenge: bytes(raw.challenge),
        user: { ...raw.user, id: bytes(raw.user.id) },
        excludeCredentials: (raw.excludeCredentials || []).map(item => ({ ...item, id: bytes(item.id) }))
      };
    }
    if (action === 'get') {
      if (raw.rpId !== location.hostname || !Array.isArray(raw.allowCredentials) || !raw.allowCredentials.length) {
        throw new Error('セキュリティキーの認証先が正しくありません。');
      }
      return {
        ...raw,
        challenge: bytes(raw.challenge),
        allowCredentials: raw.allowCredentials.map(item => ({ ...item, id: bytes(item.id) }))
      };
    }
    throw new Error('セキュリティキーの操作が正しくありません。');
  }

  function serialize(credential, action) {
    if (!credential || credential.type !== 'public-key' || !credential.response) {
      throw new Error('セキュリティキーから応答がありませんでした。');
    }
    const response = credential.response;
    const result = {
      id: credential.id,
      rawId: base64url(credential.rawId),
      type: credential.type,
      response: { clientDataJSON: base64url(response.clientDataJSON) }
    };
    if (action === 'create') {
      result.response.attestationObject = base64url(response.attestationObject);
      result.response.transports = typeof response.getTransports === 'function' ? response.getTransports() : [];
    } else {
      result.response.authenticatorData = base64url(response.authenticatorData);
      result.response.signature = base64url(response.signature);
      result.response.userHandle = response.userHandle ? base64url(response.userHandle) : null;
    }
    return result;
  }

  async function handle(request, reply) {
    const requestId = request && request.requestId;
    if (typeof requestId !== 'string' || !/^[a-f0-9]{32}$/i.test(requestId)) return;
    if (busy) {
      reply({ requestId, ok: false, message: 'セキュリティキーの操作中です。' });
      return;
    }
    busy = true;
    try {
      if (window.self !== window.top || !window.isSecureContext || !navigator.credentials || !window.PublicKeyCredential) {
        throw new Error('このブラウザではセキュリティキーを利用できません。SafariまたはChromeで直接開いてください。');
      }
      const action = request.action;
      const publicKey = optionsFor(action, request.publicKey);
      const credential = action === 'create'
        ? await navigator.credentials.create({ publicKey })
        : await navigator.credentials.get({ publicKey });
      reply({ requestId, ok: true, credential: serialize(credential, action) });
    } catch (error) {
      const cancelled = error && error.name === 'NotAllowedError';
      reply({
        requestId,
        ok: false,
        message: cancelled
          ? 'セキュリティキーの操作がキャンセルされたか、時間切れになりました。'
          : (error && error.message ? String(error.message).slice(0, 180) : 'セキュリティキーを利用できませんでした。')
      });
    } finally {
      busy = false;
    }
  }

  window.ChankoSecurityKey = Object.freeze({ handle });
})();
