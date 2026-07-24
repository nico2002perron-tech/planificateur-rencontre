import { describe, it, expect } from "vitest";
import { parseCroesusActivity, buildPortfolioActivitySummary, detectTradeKind } from "../year-activity";
import { buildDeploymentSummary, canonKey, type DeploymentPosition } from "../deployment";

// ── Fixture déterministe (fenêtre year_to_date close au 23 juillet 2026) ──
// Chiffres ronds, chaque total recalculable à la main.
const T = "\t";
const ROWS: string[][] = [
  ["Nom", "Note", "Date de transaction", "Type", "Symbole", "Quantité", "Prix", "Devise", "Total", "Commission", "Gains/Pertes"],
  // hors fenêtre (2025) — doit être ignoré partout
  ["Vieux Titre", "", "2025-12-01", "Achat", "OLD", "10", "100", "CAD", "1000", "9.99", ""],
  ["Cotisation REER", "", "2026-01-15", "Cotisation", "", "", "", "CAD", "-10000", "", ""],
  ["Banque Royale", "", "2026-02-01", "Achat", "RY", "100", "150", "CAD", "15000", "9.99", ""],
  ["FNB tout en actions", "", "2026-02-15", "Achat", "XEQT", "200", "30", "CAD", "6000", "", ""],
  ["Banque Royale", "", "2026-03-01", "Achat", "RY", "50", "160", "CAD", "8000", "9.99", ""],
  ["Banque TD", "", "2026-03-10", "Achat", "TD", "40", "80", "CAD", "3200", "", ""],
  ["Apple Inc.", "", "2026-04-01", "Achat", "AAPL", "10", "200", "USD", "2000", "", ""],
  ["FNB tout en actions", "", "2026-05-01", "Vente", "XEQT", "50", "36", "CAD", "1800", "", "250"],
  ["Banque TD", "", "2026-05-20", "Vente", "TD", "40", "90", "CAD", "3600", "", "400"],
  ["Titre mystère", "", "2026-06-01", "Achat", "MYST", "", "", "CAD", "5000", "", ""],
  ["Frais de gestion", "", "2026-06-15", "Frais de gestion", "", "", "", "CAD", "-50", "", ""],
];
const PASTE = ROWS.map(r => r.join(T)).join("\n");
const END = new Date(2026, 6, 23);

const POSITIONS: DeploymentPosition[] = [
  // RY réparti sur DEUX comptes : l'agrégation multi-comptes doit précéder la comparaison
  { symbol: "RY.TO", name: "Banque Royale du Canada", quantity: 100, marketValue: 16000, currentPrice: 160 },
  { symbol: "RY.TO", name: "Banque Royale du Canada", quantity: 50, marketValue: 8000, currentPrice: 160 },
  { symbol: "XEQT.TO", name: "iShares XEQT", quantity: 150, marketValue: 4800, currentPrice: 32 },
  { symbol: "AAPL", name: "Apple Inc.", quantity: 10, marketValue: 3000, currentPrice: 300 },
  // TD absent (revendu) ; MYST absent (sans quantité d'achat)
];

function resume() {
  const tx = parseCroesusActivity(PASTE);
  return buildDeploymentSummary(tx, "year_to_date", POSITIONS, { usdCadRate: 1.35, endDate: END });
}

describe("detectTradeKind — mots-clés Croesus", () => {
  it("« Rachat » → sell (testé AVANT « achat »)", () => {
    expect(detectTradeKind("Rachat")).toBe("sell");
  });
  it("« Vente à découvert » → sell ; « Souscription » → buy", () => {
    expect(detectTradeKind("Vente à découvert")).toBe("sell");
    expect(detectTradeKind("Souscription")).toBe("buy");
  });
  it("un réinvestissement de dividende reste un revenu, jamais un achat", () => {
    const tx = parseCroesusActivity(
      ["Nom\tDate de transaction\tType\tSymbole\tDevise\tTotal",
       "RY\t2026-03-01\tRéinvestissement de dividende\tRY\tCAD\t500"].join("\n"),
    );
    expect(tx[0].category).toBe("income");
    expect(tx[0].tradeKind).toBeNull();
  });
});

describe("buildDeploymentSummary — totaux et fenêtre", () => {
  const d = resume()!;

  it("existe et exclut l'achat hors fenêtre (2025)", () => {
    expect(d).not.toBeNull();
    // 6 achats dans la fenêtre : RY×2, XEQT, TD, AAPL, MYST (OLD est hors fenêtre)
    expect(d.buyCount).toBe(6);
    expect(d.sellCount).toBe(2);
    expect(d.distinctSymbols).toBe(5);
  });

  it("totalBuys = 39 900 (AAPL 2000 USD × 1,35 = 2 700) ; totalSells = 5 400", () => {
    expect(d.totalBuys).toBeCloseTo(39900, 6);
    expect(d.totalSells).toBeCloseTo(5400, 6);
  });

  it("dépôts de la même fenêtre : 10 000 (1 dépôt), sans override", () => {
    expect(d.contributions).toBe(10000);
    expect(d.contributionCount).toBe(1);
    expect(d.contributionsOverridden).toBe(false);
  });

  it("premier et dernier achat", () => {
    expect(d.firstBuyDate).toBe("2026-02-01");
    expect(d.lastBuyDate).toBe("2026-06-01");
  });

  it("Σ weightPct = 100 et Σ coûts des lignes = totalBuys", () => {
    expect(d.lines.reduce((s, l) => s + l.weightPct, 0)).toBeCloseTo(100, 1);
    expect(d.lines.reduce((s, l) => s + l.totalCostCad, 0)).toBeCloseTo(d.totalBuys, 6);
  });
});

describe("buildDeploymentSummary — statuts (la garde d'honnêteté)", () => {
  const d = resume()!;
  const ligne = (s: string) => d.lines.find(l => l.symbol === s)!;

  it("RY : multi-comptes agrégés (100+50 ≥ 150 achetées) → held, coût moyen pondéré", () => {
    const ry = ligne("RY");
    expect(ry.status).toBe("held");
    expect(ry.boughtQty).toBe(150);
    expect(ry.totalCostCad).toBe(23000);
    // coût moyen PONDÉRÉ : 23000/150 = 153,33 — pas la moyenne des prix (155)
    expect(ry.avgUnitCost).toBeCloseTo(153.3333, 3);
    expect(ry.currentValue).toBeCloseTo(150 * 160, 6);
    expect(ry.deltaAbs).toBeCloseTo(1000, 6);
  });

  it("XEQT : 150 détenues < 200 achetées → partial, AUCUN écart affiché", () => {
    const x = ligne("XEQT");
    expect(x.status).toBe("partial");
    expect(x.currentValue).toBeNull();
    expect(x.deltaAbs).toBeNull();
  });

  it("TD : absent du portefeuille + ventes → closed, réalisé = FAIT Croesus (400)", () => {
    const td = ligne("TD");
    expect(td.status).toBe("closed");
    expect(td.currentValue).toBeNull();
    expect(td.realizedFromCroesus).toBe(400);
  });

  it("MYST : achat sans quantité → unpriceable, compté dans totalBuys quand même", () => {
    const m = ligne("MYST");
    expect(m.status).toBe("unpriceable");
    expect(m.totalCostCad).toBe(5000);
    expect(m.currentValue).toBeNull();
  });

  it("USD : deltaAbs AAPL = qté × (prix actuel − coût moyen converti) = 300", () => {
    const a = ligne("AAPL");
    expect(a.status).toBe("held");
    expect(a.totalCostCad).toBeCloseTo(2700, 6);
    expect(a.deltaAbs).toBeCloseTo(10 * (300 - 270), 6);
  });

  it("totaux d'écart = lignes held SEULEMENT ; couverture cohérente", () => {
    // held = RY (23 000) + AAPL (2 700) = 25 700 ; valeur = 24 000 + 3 000 = 27 000
    expect(d.costEvaluated).toBeCloseTo(25700, 6);
    expect(d.valueEvaluated).toBeCloseTo(27000, 6);
    expect(d.deltaAbs).toBeCloseTo(1300, 6);
    expect(d.coveragePct).toBeCloseTo((25700 / 39900) * 100, 4);
    // costEvaluated + coûts non-held = totalBuys
    const nonHeld = d.lines.filter(l => l.status !== "held").reduce((s, l) => s + l.totalCostCad, 0);
    expect(d.costEvaluated + nonHeld).toBeCloseTo(d.totalBuys, 6);
  });
});

describe("buildDeploymentSummary — réconciliation et cohérence croisée", () => {
  const tx = parseCroesusActivity(PASTE);
  const d = buildDeploymentSummary(tx, "year_to_date", POSITIONS, { usdCadRate: 1.35, endDate: END })!;
  const sommaire = buildPortfolioActivitySummary(tx, "year_to_date", {
    currentPortfolioValue: 100000,
    usdCadRate: 1.35,
  }, END);

  it("la réconciliation boucle : chaque transaction comptée UNE fois", () => {
    const r = d.reconciliation;
    expect(r.incomeCount + r.contributionCount + r.withdrawalCount + r.buyCount + r.sellCount + r.otherCount)
      .toBe(r.windowTransactionCount);
    expect(r.windowTransactionCount).toBe(10); // 11 lignes − OLD hors fenêtre
    expect(r.otherCount).toBe(1); // les frais de gestion
  });

  it("cohérence avec la page Activité : mêmes comptes d'achats/ventes", () => {
    expect(sommaire.buyCount).toBe(d.buyCount);
    expect(sommaire.sellCount).toBe(d.sellCount);
    expect(sommaire.buyTotal).toBeCloseTo(d.totalBuys, 6);
    expect((sommaire.buyCount ?? 0) + (sommaire.sellCount ?? 0)).toBeLessThanOrEqual(sommaire.ignoredTransactionCount);
  });

  it("dates d'axe : Σ buyDates = totalBuys et Σ sellDates = totalSells", () => {
    expect(d.buyDates.reduce((s, x) => s + x.totalCad, 0)).toBeCloseTo(d.totalBuys, 6);
    expect(d.sellDates.reduce((s, x) => s + x.totalCad, 0)).toBeCloseTo(d.totalSells, 6);
    expect(d.sellDates.map(x => x.date)).toEqual(["2026-05-01", "2026-05-20"]);
  });

  it("frise mensuelle : Σ des mois = totalBuys, fenêtre janvier→juillet", () => {
    expect(d.monthlyBuys.reduce((s, m) => s + m.amount, 0)).toBeCloseTo(d.totalBuys, 6);
    expect(d.monthlyBuys).toHaveLength(7);
  });

  it("aucun achat dans la fenêtre → null", () => {
    const sansAchat = parseCroesusActivity(
      ["Nom\tDate de transaction\tType\tSymbole\tDevise\tTotal",
       "Cotisation\t2026-02-01\tCotisation\t\tCAD\t5000"].join("\n"),
    );
    expect(buildDeploymentSummary(sansAchat, "year_to_date", POSITIONS, { endDate: END })).toBeNull();
  });
});

describe("buildDeploymentSummary — gardes d'honnêteté supplémentaires", () => {
  it("position à zéro SANS vente dans la fenêtre → unmatched (jamais « Revendu »)", () => {
    const tx = parseCroesusActivity(
      ["Nom\tDate de transaction\tType\tSymbole\tQuantité\tDevise\tTotal",
       "VFV\t2026-02-01\tAchat\tVFV\t10\tCAD\t1000"].join("\n"),
    );
    const d = buildDeploymentSummary(tx, "year_to_date",
      [{ symbol: "VFV", quantity: 0, marketValue: 0, currentPrice: 100 }],
      { endDate: END })!;
    expect(d.lines[0].status).toBe("unmatched");
  });

  it("vente à quantité inconnue → held dégradé en partial (écart invérifiable)", () => {
    const tx = parseCroesusActivity(
      ["Nom\tDate de transaction\tType\tSymbole\tQuantité\tDevise\tTotal",
       "GOO\t2026-02-01\tAchat\tGOO\t10\tCAD\t1000",
       "GOO\t2026-03-01\tVente\tGOO\t\tCAD\t300"].join("\n"),
    );
    const d = buildDeploymentSummary(tx, "year_to_date",
      [{ symbol: "GOO", quantity: 10, marketValue: 1200, currentPrice: 120 }],
      { endDate: END })!;
    expect(d.lines[0].status).toBe("partial");
    expect(d.lines[0].deltaAbs).toBeNull();
  });
});

// ── Fixture TIMELINE : cotisations COMPTANT (jambes négatives, format Croesus)
//    avec comptes, achats avant/entre/même-jour ──
const TL_ROWS: string[][] = [
  ["Nom", "Date de transaction", "Type", "Symbole", "Quantité", "Code de CP", "Devise", "Total"],
  ["Pré-période", "2026-01-05", "Achat", "PRE", "10", "S", "CAD", "1000"],   // AVANT le 1er dépôt
  ["Dépôt REER", "2026-01-15", "Cotisation", "", "", "S", "CAD", "-10000"],
  ["Dépôt CELI", "2026-01-15", "Cotisation", "", "", "W", "CAD", "-2000"],   // même jour → UN chapitre
  ["Titre AAA", "2026-02-01", "Achat", "AAA", "10", "S", "CAD", "3000"],
  ["Titre BBB", "2026-02-20", "Achat", "BBB", "5", "S", "CAD", "2000"],
  ["Dépôt mystère", "2026-04-10", "Cotisation", "", "", "Z", "CAD", "-5000"], // code non mappé
  ["Titre CCC", "2026-04-10", "Achat", "CCC", "8", "S", "CAD", "4000"],       // MÊME JOUR que le dépôt
  ["Dépôt sans code", "2026-06-01", "Cotisation", "", "", "", "CAD", "-1000"],// aucun achat ne suivra
];
const TL_PASTE = TL_ROWS.map(r => r.join(T)).join("\n");

describe("buildDeploymentSummary — timeline « dépôt → ce qui a suivi »", () => {
  const tx = parseCroesusActivity(TL_PASTE);
  const d = buildDeploymentSummary(tx, "year_to_date", [], { endDate: END })!;
  const ch = d.depositChapters!;

  it("fusionne les dépôts du même jour en UN chapitre, avec ventilation par compte", () => {
    expect(ch).toHaveLength(3);
    expect(ch[0].date).toBe("2026-01-15");
    expect(ch[0].amountCad).toBe(12000);
    expect(ch[0].accounts).toHaveLength(2);
    expect(ch[0].accounts[0]).toEqual({ label: "REER", amountCad: 10000 });
    expect(ch[0].accounts[1]).toEqual({ label: "CELI", amountCad: 2000 });
  });

  it("partition stricte : chapitre 1 = achats jusqu'au dépôt suivant exclu, délai 17 jours", () => {
    expect(ch[0].buys.map(b => b.symbol)).toEqual(["AAA", "BBB"]);
    expect(ch[0].totalFollowedCad).toBe(5000);
    expect(ch[0].daysToFirstBuy).toBe(17); // 15 janv. → 1er févr.
  });

  it("l'achat du MÊME JOUR que le dépôt 2 tombe au chapitre 2 (même-jour inclus), délai 0", () => {
    expect(ch[1].buys.map(b => b.symbol)).toEqual(["CCC"]);
    expect(ch[1].daysToFirstBuy).toBe(0);
  });

  it("dépôt sans achat suivant : chapitre présent, buys vide, compté", () => {
    expect(ch[2].buys).toEqual([]);
    expect(ch[2].daysToFirstBuy).toBeNull();
    expect(d.depositsWithoutFollowingBuy).toBe(1);
  });

  it("achats AVANT le premier dépôt : preDepositBuys, jamais perdus", () => {
    expect(d.preDepositBuys).toEqual({ totalCad: 1000, buyCount: 1, topSymbols: ["PRE"] });
  });

  it("INVARIANT partition : Σ chapitres + pré-période = totalBuys, et les comptes bouclent", () => {
    const somme = ch.reduce((s, c) => s + c.totalFollowedCad, 0) + (d.preDepositBuys?.totalCad ?? 0);
    expect(somme).toBeCloseTo(d.totalBuys, 6);
    const nAchats = ch.reduce((s, c) => s + c.buyCount, 0) + (d.preDepositBuys?.buyCount ?? 0);
    expect(nAchats).toBe(d.reconciliation.buyCount);
  });

  it("dépôts par compte : libellés mappés, non-mappés regroupés sous « Autre compte », somme exacte", () => {
    const parCompte = d.contributionsByAccount!;
    expect(parCompte.map(a => a.label)).toEqual(["REER", "Autre compte", "CELI"]);
    expect(parCompte.find(a => a.label === "Autre compte")).toEqual({ label: "Autre compte", amountCad: 6000, count: 2 });
    expect(parCompte.reduce((s, a) => s + a.amountCad, 0)).toBe(18000);
  });

  it("délai médian (17 et 0 → 8,5) ; cadence irrégulière (85 vs 52 jours) → false", () => {
    expect(d.medianDaysDepositToNextBuy).toBe(8.5);
    expect(d.depositCadenceRegular).toBe(false);
  });

  it("override de cotisations ⇒ timeline null (pas de faits de dates), plancher survit", () => {
    const o = buildDeploymentSummary(tx, "year_to_date", [], {
      endDate: END, contributionsOverride: 999,
      portfolioValues: { starting: 100000, current: 130000 },
    })!;
    expect(o.depositChapters).toBeNull();
    expect(o.preDepositBuys).toBeNull();
    expect(o.contributionsByAccount).toBeNull();
    expect(o.growthFloor).not.toBeNull();
    expect(o.growthFloor!.netDeposits).toBe(999);
  });
});

describe("buildDeploymentSummary — plancher de croissance (4 quadrants)", () => {
  const tx = parseCroesusActivity(TL_PASTE);
  const build = (portfolioValues?: { starting: number; current: number }, withdrawalsOverride?: number) =>
    buildDeploymentSummary(tx, "year_to_date", [], { endDate: END, portfolioValues, withdrawalsOverride })!;

  it("Q1 : dépôts nets (18 000) ≤ variation (30 000) → residual 12 000", () => {
    const g = build({ starting: 100000, current: 130000 }).growthFloor!;
    expect(g.quadrant).toBe(1);
    expect(g.netDeposits).toBe(18000);
    expect(g.residual).toBe(12000);
  });

  it("Q2 : variation positive (5 000) mais < dépôts nets → residual négatif", () => {
    const g = build({ starting: 100000, current: 105000 }).growthFloor!;
    expect(g.quadrant).toBe(2);
    expect(g.residual).toBe(-13000);
  });

  it("Q3 : variation négative malgré dépôts positifs", () => {
    expect(build({ starting: 100000, current: 95000 }).growthFloor!.quadrant).toBe(3);
  });

  it("Q4 : dépôts nets ≤ 0 (retraits saisis 20 000 > dépôts)", () => {
    const g = build({ starting: 100000, current: 130000 }, 20000).growthFloor!;
    expect(g.quadrant).toBe(4);
    expect(g.netDeposits).toBe(-2000);
  });

  it("sans portfolioValues → null", () => {
    expect(build(undefined).growthFloor).toBeNull();
  });

  it("TEST CROISÉ inter-moteurs : residual === investmentGrowth + income de la page Activité", () => {
    const activite = buildPortfolioActivitySummary(tx, "year_to_date", {
      currentPortfolioValue: 130000,
      startingPortfolioValue: 100000,
    }, END);
    const g = build({ starting: 100000, current: 130000 }).growthFloor!;
    expect(g.residual).toBe((activite.investmentGrowth ?? 0) + activite.income);
  });
});

// ── Fixture RÉELLE (Nicolas) : partie double Croesus, 18 colonnes sans en-têtes ──
// 3 événements de cotisation : 9 000 comptant (CELI), 5 900 TRI (conjoint),
// 4 035,20 FIRM CAP en nature (CELI) — + un dépôt de 43 500 et des achats.
const REEL: string[][] = [
  // [Nom, Note, Trait, Txn, CodeCP, Type, Sym, Qté, Prix, Dev, Total, Comm, G/P, Int, Frais, PBR, Solde, NoCompte]
  ['SOLDE DU COMPTE CAD','COTISATION','2026/07/17','2026/07/17','SA1H','Cotisation','1CAD','0','0','CAD','9 000,00','0','0','0','0','0','0','37-3B8V-W'],
  ['SOLDE DU COMPTE CAD','COTIS AU CELI 37-3B8V-W','2026/07/17','2026/07/17','SA1H','Cotisation','1CAD','0','0','CAD','(9 000,00)','0','0','0','0','0','0','37-3B8V-A'],
  ['THOMSON REUTERS CORP','COTISATION-CONJOINT','2026/07/17','2026/07/17','SA1H','Cotisation','TRI','43','137,209','CAD','(5 900,00)','0','0','0','0','0','0','37-3B8V-R'],
  ['SOLDE DU COMPTE CAD','THOMSON REUTERS CORP COTISATION-CONJOINT','2026/07/17','2026/07/17','SA1H','Cotisation','1CAD','0','137','CAD','5 900,00','0','0','0','0','0','0','37-3B8V-R'],
  ['FIRM CAP C28','COTISATION','2026/01/20','2026/01/19','SA1H','Cotisation','FC.DB.M','4 000','100,88','CAD','(4 035,20)','0','0','0','0','0','0','37-3B8V-W'],
  ['SOLDE DU COMPTE CAD','FIRM CAP C28 COTISATION','2026/01/20','2026/01/19','SA1H','Cotisation','1CAD','0','100','CAD','4 035,20','0','0','0','0','0','0','37-3B8V-W'],
  ['SOLDE DU COMPTE CAD','FIRM CAP C28 CONT AU CELI 37-3B8V-W','2026/01/20','2026/01/19','SA1H','Cotisation','1CAD','0','100','CAD','(4 035,20)','0','0','0','0','0','0','37-3B8V-A'],
  ['SOLDE DU COMPTE CAD','BNC INTERNET PMT','2026/06/29','2026/06/26','SA1H','Dépôt','1CAD','0','0','CAD','43 500,00','0','0','0','0','0','0','37-3B8V-A'],
  ['MICROSOFT CORP CDR','HSW1','2026/07/15','2026/07/15','SA1H','Achat','MSFT','325','27,81','CAD','(9 188,25)','0','0','0','0','0','0','37-3B8V-A'],
];

describe("buildDeploymentSummary — données réelles (partie double)", () => {
  const tx = parseCroesusActivity(REEL.map(r => r.join(T)).join("\n"));
  const d = buildDeploymentSummary(tx, "year_to_date",
    [{ symbol: "MSFT", quantity: 325, marketValue: 8710, currentPrice: 26.8 },
     { symbol: "TRI", quantity: 43, marketValue: 5190.96, currentPrice: 120.72 },
     { symbol: "FC.DB.M", quantity: 4000, marketValue: 4112, currentPrice: 1.028 }],
    { endDate: END, cashBalance: 17535.52 })!;

  it("cotisations : 9 000 en argent + 9 935,20 en titres = 18 935,20 (FIRM CAP dédupliqué)", () => {
    expect(d.contributionsCash).toBeCloseTo(9000, 2);       // −9000 (le miroir FIRM CAP −4035,20 est écarté)
    expect(d.contributionsSecurities).toBeCloseTo(9935.20, 2); // TRI 5900 + FC.DB.M 4035,20
    expect(d.contributions).toBeCloseTo(18935.20, 2);
  });

  it("apports EN TITRES = acquisitions (TRI, FC.DB.M dans le tableau)", () => {
    expect(d.inKindCount).toBe(2);
    expect(d.contributedSecurities.map(s => s.symbol).sort()).toEqual(["FC.DB.M", "TRI"]);
    expect(d.lines.map(l => l.symbol)).toEqual(expect.arrayContaining(["TRI", "FC.DB.M", "MSFT"]));
  });

  it("cotisations par compte : CELI 13 046,65 + REER conjoint 5 900 (destination via note)", () => {
    const byAcct = Object.fromEntries((d.contributionsByAccount ?? []).map(a => [a.label, a.amountCad]));
    expect(byAcct["CELI"]).toBeCloseTo(13035.20, 2);          // 9000 comptant + 4035,20 FC.DB.M
    expect(byAcct["REER conjoint"]).toBeCloseTo(5900, 2);
  });

  it("dépôt (43 500) et encaisse (17 535,52) distincts des cotisations", () => {
    expect(d.deposits).toBeCloseTo(43500, 2);
    expect(d.cashOnHand).toBeCloseTo(17535.52, 2);
  });

  it("garde-fou : 1 transfert en nature détecté et compté une seule fois", () => {
    expect(d.mirrorsDropped).toBe(1); // le miroir encaisse du FIRM CAP est écarté
  });

  it("obligation : FC.DB.M marquée isBond (cotée par 100 $ nominal)", () => {
    const fc = d.lines.find(l => l.symbol === "FC.DB.M")!;
    expect(fc.isBond).toBe(true);
    // avgUnitCost ≈ 1,009 (4035,20 / 4000 nominal) → l'affichage ×100 donne ~100,9
    expect(fc.avgUnitCost).toBeCloseTo(1.0088, 3);
  });
});

describe("canonKey — rapprochement de symboles", () => {
  it("retire les suffixes de bourse et unifie les séparateurs", () => {
    expect(canonKey("RY.TO")).toBe("RY");
    expect(canonKey("ry")).toBe("RY");
    expect(canonKey("AP.UN.TO")).toBe("AP-UN");
    expect(canonKey("ADBE.NE")).toBe("ADBE");
  });
});
