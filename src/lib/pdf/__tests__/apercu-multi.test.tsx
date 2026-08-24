// L'APERÇU DES HUIT CAS — pour être REGARDÉ, pas seulement asserté.
//
// ⚠ CE FICHIER EXISTE PARCE QUE TROIS DES QUATRE CONTRAINTES DE RENDU DU DÉPÔT
// n'étaient visibles QUE sur un PDF rendu : un `#ffffff55` qui sortait vert, une
// carte dégradée vide, un « ↓ » en petits guillemets. Une batterie de texte ne
// les aurait jamais vues.
//
// Écrit dans C:/tmp/multi, rastérisé par `scripts/_raster.mjs`, puis lu.
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { Document, Font, renderToBuffer } from '@react-pdf/renderer';
import { PageStrategieCristallisationPertes } from '../page-cristallisation-pertes';
import { PageStrategieCristallisationGains } from '../page-cristallisation-gains';
import { CAS_VISUELS, CAS_VISUELS_GAINS } from '../__fixtures__/multi-visuel';

beforeAll(() => {
  const F = path.join(process.cwd(), 'public', 'fonts');
  Font.register({ family: 'Montserrat', fonts: [
    { src: path.join(F, 'Montserrat-Bold.ttf'), fontWeight: 700 },
    { src: path.join(F, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 }] });
  Font.register({ family: 'Open Sans', fonts: [
    { src: path.join(F, 'OpenSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(F, 'OpenSans-SemiBold.ttf'), fontWeight: 600 }] });
  Font.registerHyphenationCallback((m) => [m]);
});

describe('apercu multi', () => {
  it('ecrit les huit cas, pertes puis gains', async () => {
    const buf = await renderToBuffer(
      <Document>
        {CAS_VISUELS.map((c) => (
          <PageStrategieCristallisationPertes key={c.nom} presentation={c.p} />
        ))}
        {CAS_VISUELS_GAINS.map((c) => (
          <PageStrategieCristallisationGains key={c.nom} presentation={c.p} />
        ))}
      </Document>
    );
    fs.mkdirSync('C:/tmp/multi', { recursive: true });
    fs.writeFileSync('C:/tmp/multi/cas.pdf', buf);
    expect(buf.length).toBeGreaterThan(1000);
  }, 120000);
});
