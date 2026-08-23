import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { Document, Page, View, Text, Font, renderToBuffer } from '@react-pdf/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { DiagrammeAvantStrategieApres } from '../diagramme-avant-strategie-apres';
import { PageStrategieCristallisationPertes } from '../page-cristallisation-pertes';
import { ParcoursGainCristallise } from '../parcours-gain-cristallise';
import { PageStrategieCristallisationGains } from '../page-cristallisation-gains';
import { textesDe } from './_texte-rendu';
import { PRESENTATION_CALCULEE, PRESENTATION_DEGRADEE } from '../__fixtures__/cristallisation-pertes';
import {
  PRESENTATION_GAINS_CALCULEE, PRESENTATION_GAINS_DEGRADEE,
} from '../__fixtures__/cristallisation-gains';

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

const plat = (p: React.ComponentProps<typeof DiagrammeAvantStrategieApres>) =>
  textesDe(<DiagrammeAvantStrategieApres {...p} />).join(' ').replace(/[\s   ]+/g, ' ');

describe('le diagramme dit les trois grandeurs, sans en fabriquer', () => {
  it('reprend avant, stratégie et après tels quels', () => {
    const t = plat(PRESENTATION_CALCULEE.etape4);
    expect(t).toMatch(/8 997,81/);
    expect(t).toMatch(/9 031,60/);
    expect(t).toMatch(/0,00/);
    expect(t).toMatch(/Objectif atteint/);
  });

  it('l’écart de +33,79 $ vit dans sa pastille, pas dans la géométrie', () => {
    // Les deux premières bandes ne diffèrent que de 0,4 % : elles DOIVENT
    // paraître identiques. C'est la pastille qui porte le dépassement.
    expect(plat(PRESENTATION_CALCULEE.etape4)).toMatch(/Écart estimé.*33,79/);
  });

  it('un après INCONNU ne fabrique aucun zéro — il dit pourquoi', () => {
    // ⚠ VU AU PREMIER RENDU : la carte était un trou blanc. Le refus était
    // juste, le silence ne l'était pas.
    const t = plat(PRESENTATION_DEGRADEE.etape4);
    expect(t).toMatch(/ne peut pas être illustré/);
    expect(t).not.toMatch(/0,00/);
    expect(t).not.toMatch(/Objectif atteint/);
  });
});

describe('apercu', () => {
  it('ecrit le PDF du diagramme', async () => {
    const carte = (titre: string, e4: React.ComponentProps<typeof DiagrammeAvantStrategieApres>) => (
      <View style={{ marginBottom: 24, padding: 16, borderRadius: 14, backgroundColor: '#ffffff',
        borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' }}>
        <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>{titre}</Text>
        <DiagrammeAvantStrategieApres {...e4} />
      </View>
    );
    const buf = await renderToBuffer(
      <Document>
        <Page size="LETTER" style={{ padding: 44, fontFamily: 'Open Sans', backgroundColor: '#f8fafc' }}>
          <Text style={{ fontSize: 13, fontFamily: 'Montserrat', fontWeight: 800, marginBottom: 18 }}>
            Essai — diagramme avant / stratégie / après
          </Text>
          {carte('CAS CALCULÉ  (après = 0 $)', PRESENTATION_CALCULEE.etape4)}
          {carte('CAS DÉGRADÉ  (après inconnu)', PRESENTATION_DEGRADEE.etape4)}
        </Page>
      </Document>
    );
    fs.mkdirSync('C:/tmp/apercu', { recursive: true });
    fs.writeFileSync('C:/tmp/apercu/diagramme.pdf', buf);
    expect(buf.length).toBeGreaterThan(1000);
  }, 60000);

  it('ecrit le PDF de la PAGE GAINS, calculee et degradee', async () => {
    // ⚠ LES MÊMES OBJETS QUE LA BATTERIE DE TESTS. L'aperçu que j'inspecte à
    // l'œil et la page mise sous test décrivent alors exactement la même chose.
    // ⚠ LE HARNAIS NE POSE PLUS DE TITRE. La page complète le porte elle-même
    // depuis `langage-fiscal` : c'est ce qui empêche un assembleur réel de la
    // sortir anonyme, et ce qui interdit deux titres concurrents.
    const page = (pr: typeof PRESENTATION_GAINS_CALCULEE) => (
      <PageStrategieCristallisationGains presentation={pr} />
    );
    const buf = await renderToBuffer(
      <Document>{page(PRESENTATION_GAINS_CALCULEE)}{page(PRESENTATION_GAINS_DEGRADEE)}</Document>
    );
    fs.writeFileSync('C:/tmp/apercu/page-gains.pdf', buf);
    expect(buf.length).toBeGreaterThan(1000);
  }, 90000);

  it('ecrit le PDF du parcours de GAIN (etape 4, modele visuel neuf)', async () => {
    const carte = (titre: string, p: React.ComponentProps<typeof ParcoursGainCristallise>) => (
      <View style={{ marginBottom: 20, padding: 14, borderRadius: 14, backgroundColor: '#ffffff',
        borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' }}>
        <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800,
          color: '#1e293b', marginBottom: 10 }}>{titre}</Text>
        <ParcoursGainCristallise {...p} />
      </View>
    );
    const buf = await renderToBuffer(
      <Document><Page size="LETTER" style={{ padding: 40, fontFamily: 'Open Sans', backgroundColor: '#f8fafc' }}>
        <Text style={{ fontSize: 13, fontFamily: 'Montserrat', fontWeight: 800, marginBottom: 16 }}>
          Essai — parcours du gain cristallisé (étape 4)
        </Text>
        {carte('CAS CALCULÉ', {
          gainRealiseEstimeCad: 11985, pertesDisponiblesCad: 12000, cibleRestanteCad: 15 })}
        {carte('CAS DÉGRADÉ', {
          gainRealiseEstimeCad: null, pertesDisponiblesCad: null, cibleRestanteCad: null })}
      </Page></Document>
    );
    fs.writeFileSync('C:/tmp/apercu/parcours-gain.pdf', buf);
    expect(buf.length).toBeGreaterThan(1000);
  }, 90000);

  it('ecrit le PDF de la PAGE complete, calculee et degradee', async () => {
    // ⚠ MÊME CHOSE ICI : le titre vient de la page, plus du harnais.
    const page = (p: typeof PRESENTATION_CALCULEE) => (
      <PageStrategieCristallisationPertes presentation={p} />
    );
    const buf = await renderToBuffer(
      <Document>{page(PRESENTATION_CALCULEE)}{page(PRESENTATION_DEGRADEE)}</Document>
    );
    fs.writeFileSync('C:/tmp/apercu/page.pdf', buf);
    expect(buf.length).toBeGreaterThan(1000);
  }, 90000);
});
