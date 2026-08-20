// FALSIFICATION du correctif bloquant : un collage décalé (nom + compte dans la
// colonne type) ne doit JAMAIS sortir du diagnostic de la timeline.
import { describe, it, expect } from 'vitest';
import { construireLigneDuTemps } from '@/lib/profils/ligne-du-temps';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

const l = (type: string): LigneTransaction => ({
  date: '2026-03-15', dateReglement: '2026-03-15', nom: 'SECRET, CLIENT', note: '',
  type, symbole: '1CAD', quantite: null, prix: null, devise: 'CAD', total: 100,
  gainsPertes: null, solde: null, noCompte: '37-SECR-W', description: '',
});

describe('fuite par les libellés inconnus', () => {
  it('nom, compte, montant dans la colonne type → une seule clé repliée', () => {
    const t = construireLigneDuTemps([
      l('37-SECR-W Tremblay-Fictif, Jean'),
      l('VIRE DE 37SECR2 PERRON-FICTIF'),
      l('4 508,22'),
    ]);
    const texte = JSON.stringify(t.diagnostics);
    expect(texte).not.toMatch(/SECR|Tremblay|PERRON|508/i);
    expect(t.diagnostics.libellesInconnus).toEqual({ '(libellé non textuel)': 3 });
  });
});
