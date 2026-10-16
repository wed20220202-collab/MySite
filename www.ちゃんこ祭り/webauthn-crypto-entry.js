/*! @license
 * WebAuthnCrypto.gs includes @noble/curves and @noble/hashes by Paul Miller.
 * The MIT License (MIT)
 * Copyright (c) 2022 Paul Miller (https://paulmillr.com)
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
// Source for the GAS-compatible verifier in WebAuthnCrypto.gs.
// Rebuild from pinned @noble/curves@2.2.0 with esbuild; no runtime imports in GAS.
import { p256 } from '@noble/curves/nist.js';

export function validateP256PublicKey(publicKey) {
  try {
    if (!(publicKey instanceof Uint8Array) || publicKey.length !== 65 || publicKey[0] !== 4) return false;
    p256.Point.fromBytes(publicKey).assertValidity();
    return true;
  } catch (error) {
    return false;
  }
}

export function verifyP256DerDigest(signature, digest, publicKey) {
  if (!(signature instanceof Uint8Array) || !(digest instanceof Uint8Array) || digest.length !== 32 ||
      !validateP256PublicKey(publicKey)) return false;
  return p256.verify(signature, digest, publicKey, { format: 'der', prehash: false, lowS: false });
}
