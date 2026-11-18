import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../serve.mjs';

test('audioState clear() and stopMic() terminate without mutual recursion and reflect live mic state', async () => {
  const { audio, audioStore } = await import('../src/audio/audioState.js');

  let stoppedTracks = 0;
  let disconnected = 0;
  audio.buffer = null;
  audio.micActive = true;
  audio.name = 'LIVE MICROPHONE / LINE-IN';
  audio.micStream = { getTracks: () => [{ stop: () => { stoppedTracks++; } }] };
  audio.micSource = { disconnect: () => { disconnected++; } };

  assert.equal(audio.loaded, true);
  assert.equal(audio.duration, 9999);

  audio.clear();
  assert.equal(stoppedTracks, 1);
  assert.equal(disconnected, 1);
  assert.equal(audio.micActive, false);
  assert.equal(audio.loaded, false);
  assert.equal(audio.duration, 0);
  assert.equal(audioStore.get().micActive, false);

  audio.micActive = true;
  audio.name = 'LIVE MICROPHONE / LINE-IN';
  audio.micStream = { getTracks: () => [{ stop: () => { stoppedTracks++; } }] };
  audio.micSource = { disconnect: () => { disconnected++; } };

  audio.stopMic();
  assert.equal(stoppedTracks, 2);
  assert.equal(disconnected, 2);
  assert.equal(audio.micActive, false);
  assert.equal(audio.name, '');
});

test('serve.mjs serves dist files safely and blocks path traversal and sibling prefixes', async (t) => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'react-serve-test-'));
  const distDir = path.join(tmpBase, 'dist');
  const siblingDir = path.join(tmpBase, 'dist-secret');
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(siblingDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'index.html'), '<h1>REACT OK</h1>');
  fs.writeFileSync(path.join(siblingDir, 'secret.txt'), 'TOP_SECRET');
  fs.writeFileSync(path.join(tmpBase, 'package.json'), '{}');

  const srv = createAppServer({ root: distDir });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address();
  t.after(async () => {
    await new Promise((resolve) => srv.close(resolve));
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  const okRes = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(okRes.status, 200);
  assert.match(await okRes.text(), /REACT OK/);

  const badUriRes = await fetch(`http://127.0.0.1:${port}/%E0%A4%A`);
  assert.equal(badUriRes.status, 400);

  const traversalRes = await fetch(`http://127.0.0.1:${port}/..%2fpackage.json`);
  assert.equal(traversalRes.status, 403);

  const siblingRes = await fetch(`http://127.0.0.1:${port}/..%2fdist-secret/secret.txt`);
  assert.equal(siblingRes.status, 403);
});
