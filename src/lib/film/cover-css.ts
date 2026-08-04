/**
 * Le CSS de la couverture du « Rapport vivant ».
 *
 * ⚠️ RÈGLE ABSOLUE : aucun accent grave et aucune interpolation dans ce littéral de
 * gabarit — ils termineraient la chaîne au milieu du CSS (piège déjà vécu, deux fois :
 * la seconde en écrivant un nom de fichier entre accents graves dans un commentaire).
 * Le garde-fou `check-literals.js` du bac à sable le vérifie.
 *
 * Autre piège documenté : ne JAMAIS mettre une animation propre sur un élément qui
 * porte déjà .rise (sa spécificité écrase celle de .rise et l'opacity:0 initiale
 * n'est jamais annulée → élément invisible), et ne jamais animer « transform » sur
 * une carte [data-tilt] (l'état final d'une animation forwards écrase l'inclinaison).
 */
export const coverCss = `
/* ══════════ Décor : aurore de couleurs vives en mouvement ══════════ */
.aurora{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
/* Opacités volontairement retenues + gros flou : l'aurore doit COLORER l'ambiance,
   pas tacher les cartes de verre. Au-delà de ~.35 le blanc des cartes vire au vert
   ou au rose par plaques et le document perd son sérieux. */
.aurora i{position:absolute;display:block;border-radius:50%;filter:blur(96px)}
.aurora .o1{width:48vw;height:48vw;left:-10vw;top:-14vw;background:radial-gradient(circle,rgba(0,180,216,.34),transparent 70%);animation:dr1 30s ease-in-out infinite alternate}
.aurora .o2{width:42vw;height:42vw;right:-8vw;top:4vh;background:radial-gradient(circle,rgba(99,102,241,.26),transparent 70%);animation:dr2 36s ease-in-out infinite alternate}
.aurora .o3{width:40vw;height:40vw;left:16vw;bottom:-16vw;background:radial-gradient(circle,rgba(16,217,138,.22),transparent 70%);animation:dr3 34s ease-in-out infinite alternate}
.aurora .o4{width:32vw;height:32vw;right:12vw;bottom:0;background:radial-gradient(circle,rgba(168,85,247,.18),transparent 72%);animation:dr4 40s ease-in-out infinite alternate}
@keyframes dr1{to{transform:translate(7vw,9vh) scale(1.15)}}
@keyframes dr2{to{transform:translate(-8vw,7vh) scale(1.2)}}
@keyframes dr3{to{transform:translate(9vw,-8vh) scale(1.12)}}
@keyframes dr4{to{transform:translate(-6vw,-7vh) scale(1.25)}}

.page{max-width:1080px;margin:0 auto;padding:clamp(16px,3vw,40px) clamp(14px,3vw,36px) 64px}

/* ══════════ Verre dépoli + relief 3D ══════════ */
.glass{position:relative;border-radius:18px;
  background:linear-gradient(140deg,rgba(255,255,255,.74),rgba(255,255,255,.44));
  -webkit-backdrop-filter:blur(20px) saturate(185%); backdrop-filter:blur(20px) saturate(185%);
  border:1px solid rgba(255,255,255,.7);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(3,4,94,.045),
    0 18px 40px -18px rgba(3,4,94,.28), 0 4px 12px -6px rgba(3,4,94,.12)}
[data-tilt]{transform-style:preserve-3d;will-change:transform;
  transform:perspective(1200px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
  transition:transform .55s var(--e), box-shadow .4s var(--e)}
[data-tilt].live{transition:transform .1s linear;
  box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 30px 60px -22px rgba(3,4,94,.34),0 8px 20px -10px rgba(3,4,94,.16)}
[data-tilt]>.sheen{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;
  transition:opacity .35s;mix-blend-mode:screen;
  background:radial-gradient(460px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.6),transparent 46%)}
[data-tilt].live>.sheen{opacity:1}
.lift{transform:translateZ(30px)}
.lift-sm{transform:translateZ(16px)}

/* ══════════ Chiffres à rouleaux d'odomètre ══════════
   ⚠️ Un odomètre ne peut PAS porter de texte en dégradé : ses colonnes sont en
   overflow:hidden, et un « background-clip:text » posé sur l'ancêtre ne peint pas
   à l'intérieur → les chiffres deviennent invisibles (piège vécu). Les rouleaux
   utilisent donc une couleur PLEINE ; le miroitement reste sur le titre. */
.odo{display:inline-flex;align-items:baseline;line-height:1;transition:opacity .45s var(--e)}
.odo-col{display:inline-block;height:1em;overflow:hidden}
.odo-strip{display:block;will-change:transform;transition:filter .3s linear}
/* Flou de mouvement pendant le trajet des rouleaux : les chiffres intermediaires
   se lisent comme du mouvement, jamais comme un montant. */
.odo.spin .odo-strip{filter:blur(.6px)}
.odo-d{display:block;height:1em;line-height:1;text-align:center}
.odo-sep{display:inline-block;white-space:pre}
.h-val.odo,.inc-v.odo{background:none;-webkit-background-clip:border-box;background-clip:border-box;
  -webkit-text-fill-color:currentColor;animation:none;color:var(--navy)}
.h-val.up.odo{color:#059669}
.inc-v.odo{color:#047857}

/* ══════════ 1 · Bandeau ══════════ */
.hdr{overflow:hidden;margin-bottom:16px;
  background:linear-gradient(140deg,rgba(219,234,254,.82),rgba(240,249,255,.6) 45%,rgba(255,255,255,.5))}
.hdr .accent{position:absolute;top:0;left:0;height:3px;width:0;z-index:2;
  background:linear-gradient(90deg,#00d4ff,#38bdf8,#6366f1,#00d4ff);background-size:300% 100%;
  animation:w100 1.3s .1s var(--e) forwards, slide 6s 1.4s linear infinite}
@keyframes w100{to{width:100%}}
@keyframes slide{to{background-position:300% 0}}
.hdr-in{position:relative;padding:clamp(18px,2.6vw,30px) clamp(18px,2.6vw,32px)}
.hdr .date{position:absolute;top:clamp(18px,2.6vw,30px);right:clamp(18px,2.6vw,32px);
  font-size:11px;font-weight:600;color:#7e9fbb}
.hdr img{height:34px;width:auto;display:block;margin-bottom:13px}
.hdr h1{font-family:'Montserrat';font-weight:800;font-size:clamp(25px,4vw,42px);line-height:1.05;margin:0 0 5px;letter-spacing:-.018em;color:var(--navy)}
/* Dégradé miroitant sur un span INTERNE — jamais sur le h1 (voir en-tête). */
.hdr h1 .grad{display:inline-block;
  background:linear-gradient(100deg,#03045e 0%,#0077b6 38%,#00d4ff 52%,#03045e 72%);background-size:250% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:shim 9s linear infinite}
@keyframes shim{to{background-position:-250% 0}}
.hdr h2{font-family:'Montserrat';font-weight:700;font-size:clamp(15px,2.1vw,22px);color:#334155;margin:0}
.hdr .div{height:1px;background:linear-gradient(90deg,rgba(0,180,216,.5),rgba(199,221,240,.25),transparent);margin:15px 0 14px}
.pills{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:12px;
  background:rgba(255,255,255,.72);border:1px solid rgba(255,255,255,.9);
  box-shadow:0 3px 10px -5px rgba(3,4,94,.22);
  font-size:11.5px;font-weight:600;color:#334155;white-space:nowrap;
  transition:transform .25s var(--e),box-shadow .25s}
.pill:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 8px 18px -8px rgba(3,4,94,.3)}
.pill i{width:7px;height:7px;border-radius:50%;flex:none}
/* La pastille « on se vérifie » : c'est un bouton, ça doit se voir */
button.pill{cursor:pointer;font-family:inherit;
  background:linear-gradient(140deg,rgba(255,251,235,.95),rgba(254,243,199,.7));
  border-color:rgba(197,163,101,.6);color:#7c5e18}
button.pill:hover{box-shadow:0 8px 20px -8px rgba(197,163,101,.55)}
button.pill .chev{transition:transform .25s var(--e);font-family:'Montserrat'}
button.pill.open .chev{transform:rotate(90deg)}

/* Panneau de transparence */
.trust{margin-top:12px;border-radius:14px;padding:14px 16px;
  background:linear-gradient(140deg,rgba(255,251,235,.8),rgba(255,255,255,.5));
  border:1px solid rgba(197,163,101,.35)}
.trust h4{font-family:'Montserrat';font-weight:800;font-size:12px;color:#7c5e18;margin:0 0 3px;letter-spacing:.04em;text-transform:uppercase}
.trust .sub{font-size:11px;color:#8a7a5c;margin:0 0 12px;line-height:1.5}
.trust-row{display:grid;grid-template-columns:64px 1fr auto;gap:10px;align-items:center;
  padding:6px 0;border-top:1px solid rgba(197,163,101,.18);font-size:11.5px}
.trust-row:first-of-type{border-top:0}
.trust-sym{font-family:'Montserrat';font-weight:800;color:var(--navy);font-size:11.5px}
.trust-path{display:flex;align-items:center;gap:6px;color:#64748b;flex-wrap:wrap;font-variant-numeric:tabular-nums}
.trust-path b{color:#334155;font-weight:600}
.trust-verdict{display:inline-flex;align-items:center;gap:5px;font-weight:700;white-space:nowrap;font-size:11px}
.trust-verdict.ok{color:#047857}
.trust-verdict.no{color:#9a3412}
.trust-verdict i{width:8px;height:8px;border-radius:50%;flex:none}
.trust-verdict.ok i{background:#10b981}
.trust-verdict.no i{background:#cbd5e1}
.trust .foot{font-size:9.5px;color:#8a7a5c;margin:12px 0 0;line-height:1.5}

/* ══════════ 2 · Aujourd'hui → projeté ══════════ */
.hero{display:grid;grid-template-columns:1fr 58px 1.1fr;border-radius:18px;overflow:hidden;margin-bottom:14px;padding:0}
@media(max-width:820px){.hero{grid-template-columns:1fr}.hero .arrow{flex-direction:row;padding:10px 0}}
/* Les deux volets s'alignent EN HAUT : leurs libellés doivent être sur la même
   ligne, comme dans le PDF. (Centrer le volet gauche décalait son libellé d'une
   centaine de pixels sous celui de droite — ça se voyait tout de suite.) */
.hero .today{padding:clamp(16px,2.3vw,24px);background:linear-gradient(140deg,rgba(224,238,251,.75),rgba(248,251,255,.45))}
.hero .arrow{background:linear-gradient(180deg,#0b1263,#03045e);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 30px -6px rgba(3,4,94,.5)}
.hero .arrow svg{opacity:0;animation:fin .6s 1.1s forwards}
.hero .arrow span{font-size:9px;color:#94a3b8;letter-spacing:.05em}
.hero .proj{position:relative;padding:clamp(16px,2.3vw,24px);
  background:linear-gradient(140deg,rgba(190,242,220,.72),rgba(245,253,248,.45));--tint:.5}
/* La teinte suit le curseur : plus on va vers l'optimiste, plus le vert est franc. */
.hero .proj::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(140deg,rgba(16,185,129,calc((var(--tint) - .5) * .34)),transparent 62%);
  transition:background .12s linear}
.h-lbl{font-size:9.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8ba0b5;margin:0 0 9px;line-height:1.4}
.h-val{font-family:'Montserrat';font-weight:800;font-size:clamp(29px,4.8vw,46px);line-height:1;margin:0;
  background:linear-gradient(100deg,#03045e,#0077b6 42%,#00d4ff 56%,#03045e 76%);background-size:250% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:shim 9s linear infinite}
.h-val.up{background:linear-gradient(100deg,#047857,#059669 40%,#34d399 56%,#047857 76%);background-size:250% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent}
.h-sub{display:flex;flex-wrap:wrap;gap:15px;margin-top:13px;font-size:11px;color:#64748b}
.h-sub b{font-weight:600;color:#40536b}
.h-top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.badge{background:linear-gradient(135deg,#a7f3d0,#6ee7b7);color:#065f46;font-size:12px;font-weight:800;
  padding:4px 10px;border-radius:7px;box-shadow:0 4px 12px -5px rgba(5,150,105,.6);font-variant-numeric:tabular-nums;
  opacity:0;animation:pop .55s 1.9s var(--e) forwards}
@keyframes pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}

/* Bouton « Pourquoi ce chiffre ? » */
.why{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 11px;border-radius:999px;cursor:pointer;
  font-family:inherit;font-size:11px;font-weight:700;color:#047857;
  background:rgba(255,255,255,.66);border:1px solid rgba(5,150,105,.3);
  transition:transform .22s var(--e),box-shadow .22s,background .22s}
.why:hover{transform:translateY(-2px);box-shadow:0 8px 18px -8px rgba(5,150,105,.45);background:rgba(255,255,255,.85)}
.why .chev{transition:transform .25s var(--e);font-family:'Montserrat'}
.why.open .chev{transform:rotate(90deg)}

/* Jauge : la poignée doit INVITER au geste */
.gauge{position:relative;height:26px;margin:16px 0 4px;cursor:grab;touch-action:none}
.gauge.grabbing{cursor:grabbing}
.gauge .track{position:absolute;top:11px;left:0;right:0;height:5px;border-radius:3px;background:rgba(148,163,184,.3)}
.gauge .span{position:absolute;top:10px;height:7px;border-radius:4px;width:0;
  background:linear-gradient(90deg,#a7f3d0,#6ee7b7,#34d399);animation:gspan 1s 1.6s var(--e) forwards}
.gauge .end{position:absolute;top:11px;width:5px;height:5px;border-radius:50%;background:#94a3b8;opacity:0;animation:fin .4s 2.1s forwards}
.gauge .mid{position:absolute;top:6px;width:2px;height:15px;border-radius:1px;background:rgba(5,150,105,.5);left:50%}
.gauge .knob{position:absolute;top:4px;width:19px;height:19px;border-radius:50%;left:50%;cursor:grab;
  background:radial-gradient(circle at 34% 30%,#8df3cd,#059669);
  border:2.5px solid #fff;box-shadow:0 3px 12px -2px rgba(5,150,105,.75),0 0 0 0 rgba(5,150,105,.22);
  transition:box-shadow .25s,transform .18s var(--e);z-index:3}
.gauge .knob::after{content:'';position:absolute;inset:4px;border-radius:50%;
  background:linear-gradient(180deg,rgba(255,255,255,.85),transparent 60%)}
.gauge:hover .knob{transform:scale(1.14);box-shadow:0 5px 16px -2px rgba(5,150,105,.8),0 0 0 9px rgba(5,150,105,.12)}
.gauge.grabbing .knob{transform:scale(1.2);cursor:grabbing}
.gauge .knob:focus-visible{outline:none;box-shadow:0 3px 12px -2px rgba(5,150,105,.8),0 0 0 5px rgba(0,180,216,.45)}
.g-hint{font-size:9.5px;color:#8ba0b5;margin:0 0 2px;transition:color .2s}
.g-hint.manual{color:#b45309;font-weight:600}
.scen{display:flex;margin-top:6px;gap:6px}
.scen>div{flex:1;opacity:0;animation:up .7s var(--e) forwards;border-radius:10px;padding:6px 8px;cursor:pointer;
  transition:background .22s,transform .22s,box-shadow .22s}
.scen>div:hover{background:rgba(255,255,255,.7);transform:translateY(-2px);box-shadow:0 8px 16px -10px rgba(3,4,94,.3)}
.scen>div.active{background:rgba(255,255,255,.85);box-shadow:inset 0 0 0 1px rgba(5,150,105,.3)}
.scen .l{font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8}
.scen .v{font-family:'Montserrat';font-weight:800;font-size:13.5px;color:#7d8fa3;font-variant-numeric:tabular-nums;line-height:1.25}
.scen .p{font-size:9.5px;font-weight:700;color:#94a3b8}
.scen .is-mid{text-align:center}
.scen .is-mid .l{color:#059669}
.scen .is-mid .v{font-size:18px;color:#047857}
.scen .is-mid .p{color:#059669}
.scen .is-hi{text-align:right}
.note{font-size:9px;color:#94a3b8;margin:9px 0 0;line-height:1.45}

/* ══════════ Carrousel Sommaire ⁄ Trajectoire ══════════ */
.proj-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.car-tabs{display:inline-flex;padding:3px;border-radius:999px;background:rgba(255,255,255,.55);
  border:1px solid rgba(255,255,255,.85);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
.car-tab{border:0;background:none;font-family:inherit;cursor:pointer;padding:5px 13px;border-radius:999px;
  font-size:10.5px;font-weight:700;letter-spacing:.03em;color:#5d7d99;transition:color .2s,background .25s var(--e),box-shadow .25s}
.car-tab.is-on{color:#03045e;background:#fff;box-shadow:0 3px 10px -5px rgba(3,4,94,.35)}
.car-tab:not(.is-on):hover{color:#03045e}
/* Miroitement d'invitation : joué une seule fois, après l'atterrissage du montant. */
.car-tab.invite{animation:invite 1.5s 2s ease-in-out 2}
@keyframes invite{0%,100%{box-shadow:0 0 0 0 rgba(0,180,216,0)}50%{box-shadow:0 0 0 5px rgba(0,180,216,.22)}}
.car{overflow:hidden;margin-top:2px}
.car-track{display:flex;width:200%;transition:transform .55s var(--e)}
.car-track.to-traj{transform:translateX(-50%)}
.car-view{width:50%;flex:none;min-width:0}
/* Une seule vue est atteignable au clavier à la fois. */
.car-view[aria-hidden="true"]{visibility:hidden}

/* ══════════ La trajectoire (graphique en éventail) ══════════ */
.traj{padding-top:4px}
/* Le SVG s'étire (preserveAspectRatio="none"), donc le repère 0→320 se mappe
   linéairement sur la hauteur du cadre : les étiquettes placées en POURCENTAGE
   restent exactes à n'importe quel rapport. On garde le même rapport que le
   viewBox par lisibilité, et on l'allonge sur écran étroit pour respirer. */
.traj-box{position:relative;width:100%;aspect-ratio:760/320}
@media(max-width:900px){.traj-box{aspect-ratio:760/400}}
@media(max-width:620px){.traj-box{aspect-ratio:760/470}}
.traj-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
/* Le cône se déploie de gauche à droite, la ligne se trace. */
.traj-cone{clip-path:inset(0 100% 0 0);animation:cone 1.5s .25s var(--e) forwards}
@keyframes cone{to{clip-path:inset(0 0 0 0)}}
.traj-mid,.traj-floor,.traj-edge{stroke-dasharray:1400;stroke-dashoffset:1400;animation:draw 1.7s .3s var(--e) forwards}
.traj-floor{animation-delay:.9s}
@keyframes draw{to{stroke-dashoffset:0}}
.traj-now-halo{animation:pulseHalo 2.6s 1.6s ease-in-out infinite}
@keyframes pulseHalo{50%{r:15;opacity:.07}}
.traj-now,.traj-end{opacity:0;animation:fin .5s forwards}
.traj-now{animation-delay:.5s}
.traj-end{animation-delay:1.7s}
/* Étiquettes et repères en HTML : texte net même si le SVG s'étire. */
.tj-grid,.tj-labels{position:absolute;inset:0;pointer-events:none}
.tj-g{position:absolute;left:0;transform:translateY(-50%);text-align:right;padding-right:8px;
  font-size:9.5px;font-weight:600;color:#a3b4c6;white-space:nowrap;font-variant-numeric:tabular-nums}
.tj-lbl{position:absolute;transform:translateY(-50%);white-space:nowrap;
  opacity:0;animation:fin .6s 1.85s forwards}
/* Ancrées au bord droit : impossible de se faire couper (piège vécu). */
.tj-lbl.end{right:1.5%;text-align:right}
.tj-lbl b{display:block;font-family:'Montserrat';font-weight:800;font-size:12px;line-height:1.1;font-variant-numeric:tabular-nums}
.tj-lbl span{display:block;font-size:8px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#a3b4c6;margin-top:1px}
.tj-lbl.hi b{color:#059669}
.tj-lbl.mid b{color:#047857;font-size:14px}
.tj-lbl.lo b{color:#0284c7}
.tj-lbl.fl b{color:#b08b45}
.tj-lbl.now{transform:translate(-4px,0);animation-delay:.7s}
.tj-lbl.now b{color:#0891b2;font-size:11.5px}
.traj-axis{position:relative;height:16px;margin-top:2px}
.tj-m{position:absolute;transform:translateX(-50%);font-size:9px;font-weight:600;color:#a3b4c6;white-space:nowrap}
.tj-m:first-child{transform:none}
.tj-m:last-child{transform:translateX(-100%)}
/* Infobulle de survol */
.tj-tip{position:absolute;z-index:4;pointer-events:none;transform:translate(-50%,-100%);
  padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.96);
  border:1px solid rgba(3,4,94,.1);box-shadow:0 12px 26px -12px rgba(3,4,94,.4);white-space:nowrap}
.tj-tip .m{font-size:8.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a3b4c6}
.tj-tip .v{font-family:'Montserrat';font-weight:800;font-size:14px;color:#047857;font-variant-numeric:tabular-nums;margin-top:2px}
.tj-tip .r{font-size:9.5px;color:#64748b;margin-top:3px;font-variant-numeric:tabular-nums}
.tj-tip .r b{color:#334155;font-weight:600}
.traj-cap{font-size:11.5px;color:#475569;margin:10px 0 0;line-height:1.5}
.traj-cap b{font-family:'Montserrat';font-weight:800;color:var(--navy);font-variant-numeric:tabular-nums}
.traj-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:9px;font-size:9.5px;color:#7d8fa3}
.traj-legend span{display:inline-flex;align-items:center;gap:5px}
.traj-legend i{width:14px;height:3px;border-radius:2px;flex:none}
.traj-legend .sw-mid{background:linear-gradient(90deg,#0891b2,#059669);height:3px}
.traj-legend .sw-cone{background:rgba(52,211,153,.35);height:9px;border-radius:3px}
.traj-legend .sw-floor{background:repeating-linear-gradient(90deg,#c5a365 0 4px,transparent 4px 7px)}

/* ══════════ Cascade « Pourquoi ce chiffre ? » ══════════ */
.cascade{margin-bottom:22px;padding:clamp(15px,2.1vw,22px)}
.cascade h4{font-family:'Montserrat';font-weight:800;font-size:12.5px;color:var(--navy);margin:0 0 3px;letter-spacing:.03em;text-transform:uppercase}
.cascade .sub{font-size:11px;color:#8ba0b5;margin:0 0 14px;line-height:1.5}
.cas-row{display:grid;grid-template-columns:76px 1fr 96px;gap:12px;align-items:center;padding:4px 0;
  opacity:0;transform:translateX(-10px);animation:slidein .5s var(--e) forwards}
@keyframes slidein{to{opacity:1;transform:none}}
.cas-sym{font-family:'Montserrat';font-weight:800;font-size:11.5px;color:var(--navy);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cas-bar{position:relative;height:11px;border-radius:6px;background:rgba(148,163,184,.16);overflow:hidden}
.cas-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;width:0;
  background:linear-gradient(90deg,#34d399,#6ee7b7);transition:width .35s var(--e)}
.cas-row.neg .cas-bar i{background:linear-gradient(90deg,#f87171,#fca5a5)}
.cas-val{text-align:right;font-family:'Montserrat';font-weight:800;font-size:12px;color:#047857;font-variant-numeric:tabular-nums}
.cas-row.neg .cas-val{color:#b91c1c}
.cas-total{display:grid;grid-template-columns:76px 1fr 96px;gap:12px;align-items:center;
  margin-top:10px;padding-top:11px;border-top:1.5px solid rgba(3,4,94,.12);font-family:'Montserrat';font-weight:800;font-size:13px;color:var(--navy)}
.cas-total span:last-child{text-align:right;color:#047857;font-variant-numeric:tabular-nums}

/* ══════════ 3 · Sections ══════════ */
.sec{display:flex;align-items:center;gap:10px;margin:0 0 12px;flex-wrap:wrap}
.sec i{width:4px;height:16px;border-radius:3px;flex:none;background:linear-gradient(180deg,#00d4ff,#0077b6);
  box-shadow:0 0 12px -2px rgba(0,212,255,.8)}
.sec i.g{background:linear-gradient(180deg,#34d399,#059669);box-shadow:0 0 12px -2px rgba(52,211,153,.8)}
.sec h3{font-family:'Montserrat';font-weight:800;font-size:clamp(12px,1.6vw,15.5px);letter-spacing:.07em;
  text-transform:uppercase;color:var(--navy);margin:0}
.sec small{font-size:10.5px;font-weight:400;color:#8ba0b5;text-transform:none;letter-spacing:0}
.card{padding:clamp(16px,2.2vw,24px);margin-bottom:24px}

/* Répartition */
.two{display:grid;grid-template-columns:1fr 1px 1.28fr;gap:clamp(16px,2.6vw,30px)}
@media(max-width:820px){.two{grid-template-columns:1fr;gap:24px}.two .vr{display:none}}
.vr{background:linear-gradient(180deg,transparent,rgba(3,4,94,.1),transparent)}
.blk-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 14px;min-height:20px}
.blk-lbl{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8ba0b5;margin:0}
.drill-back{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;cursor:pointer;
  font-family:inherit;font-size:10px;font-weight:700;color:#0369a1;
  background:rgba(255,255,255,.7);border:1px solid rgba(0,180,216,.35);transition:transform .2s var(--e)}
.drill-back:hover{transform:translateX(-2px)}
.dl{display:flex;align-items:center;gap:clamp(14px,2.2vw,26px)}
.dn{position:relative;flex:none}
.dn .donut{width:100%;height:100%;overflow:visible}
.dn-mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;pointer-events:none;opacity:0;transition:opacity .22s;padding:0 15%}
.dn-mid b{font-family:'Montserrat';font-weight:800;font-size:15px;color:var(--navy);line-height:1;font-variant-numeric:tabular-nums}
.dn-mid span{font-size:7.5px;font-weight:600;color:#7d8fa3;line-height:1.2;margin-top:3px;
  overflow:hidden;text-overflow:ellipsis;display:block;max-width:100%}
.dl.focus .dn-mid{opacity:1}
.arc{transform-box:fill-box;transform-origin:center;transform:rotate(var(--rot));
  stroke-dashoffset:var(--len);animation:arc 1.1s var(--e) forwards;
  transition:opacity .2s,stroke-width .2s,filter .2s}
@keyframes arc{to{stroke-dashoffset:0}}
.dl.focus .arc{opacity:.2}
.dl.focus .arc.on{opacity:1;stroke-width:19;filter:drop-shadow(0 3px 7px rgba(3,4,94,.3))}
.dl[data-donut="sec"] .arc{cursor:pointer}
.lg{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.lg-row{display:flex;align-items:center;gap:9px;width:100%;padding:5px 8px;border-radius:9px;font-size:12.5px;color:#334155;
  background:none;border:0;font-family:inherit;text-align:left;cursor:pointer;
  opacity:0;animation:up .6s var(--e) forwards;animation-delay:calc(.5s + var(--i) * .06s);
  transition:background .18s,transform .18s}
.lg-row:hover,.lg-row:focus-visible{background:rgba(255,255,255,.75);transform:translateX(3px);outline:none}
.lg-row .sw{width:10px;height:10px;border-radius:3px;flex:none;transition:box-shadow .2s,transform .2s}
.lg-row:hover .sw{transform:scale(1.25)}
.lg-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-pct{font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums}

/* ══════════ 4 · Calendrier des revenus ══════════ */
.inc{display:grid;grid-template-columns:auto 1px 1fr;gap:clamp(16px,2.6vw,28px);align-items:end}
@media(max-width:820px){.inc{grid-template-columns:1fr;gap:20px}.inc .vr{display:none}}
.inc-v{font-family:'Montserrat';font-weight:800;font-size:clamp(25px,3.8vw,38px);font-variant-numeric:tabular-nums;line-height:1;margin:0;
  background:linear-gradient(100deg,#047857,#059669 40%,#34d399 56%,#047857 76%);background-size:250% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:shim 9s linear infinite}
.inc-m{font-size:11.5px;color:#64748b;margin:8px 0 0}
.inc-m b{color:#334155;font-weight:600}
.yld{display:inline-flex;align-items:center;gap:8px;margin-top:12px}
.yld em{font-style:normal;background:linear-gradient(135deg,#a7f3d0,#6ee7b7);color:#065f46;font-size:11.5px;font-weight:800;
  padding:4px 9px;border-radius:7px;box-shadow:0 4px 12px -6px rgba(5,150,105,.6)}
.yld span{font-size:10.5px;color:#8ba0b5}
.bars{display:flex;align-items:flex-end;gap:clamp(3px,.7vw,7px);height:112px}
.bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;
  background:none;border:0;padding:0;font-family:inherit;transition:transform .22s var(--e)}
.bar:hover{transform:translateY(-4px)}
.bar .n{font-size:8.5px;color:#94a3b8;font-variant-numeric:tabular-nums;white-space:nowrap;transition:color .2s}
.bar:hover .n{color:#047857;font-weight:700}
.bar .col{width:100%;border-radius:6px 6px 0 0;transform-origin:bottom;transform:scaleY(0);
  background:linear-gradient(180deg,#86efac,#bbf7d0);box-shadow:inset 0 1px 0 rgba(255,255,255,.7);
  animation:grow .75s var(--e) forwards;transition:background .2s,box-shadow .2s}
.bar:hover .col{background:linear-gradient(180deg,#34d399,#6ee7b7);box-shadow:0 8px 18px -8px rgba(5,150,105,.7),inset 0 1px 0 rgba(255,255,255,.8)}
.bar.now .col{background:linear-gradient(180deg,#10b981,#34d399);box-shadow:0 6px 16px -8px rgba(5,150,105,.75),inset 0 1px 0 rgba(255,255,255,.7)}
.bar .m{font-size:9px;color:#94a3b8}
.bar.now .m{color:#047857;font-weight:700;border-bottom:2px solid #34d399;padding-bottom:1px}
@keyframes grow{to{transform:scaleY(1)}}
.boxes{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
@media(max-width:620px){.boxes{grid-template-columns:1fr}}
.box{border-radius:13px;padding:13px 15px;border:1px solid rgba(255,255,255,.8);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 6px 16px -10px rgba(3,4,94,.2);
  transition:transform .25s var(--e),box-shadow .25s}
.box:hover{transform:translateY(-3px);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 14px 26px -12px rgba(3,4,94,.3)}
.box.d{background:linear-gradient(140deg,rgba(209,250,229,.8),rgba(240,253,244,.5))}
.box.f{background:linear-gradient(140deg,rgba(207,238,255,.8),rgba(240,249,255,.5))}
.box .r1{display:flex;align-items:center;justify-content:space-between;gap:10px}
.box .nm{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;color:#334155}
.box .nm i{width:9px;height:9px;border-radius:3px;flex:none}
.box .amt{font-family:'Montserrat';font-weight:800;font-size:15px;font-variant-numeric:tabular-nums}
.box.d .amt{color:#047857}.box.f .amt{color:#0369a1}
.box .r2{display:flex;justify-content:space-between;font-size:9.5px;color:#8ba0b5;margin-top:7px}
.box .r2 b{font-weight:700;color:#475569}
.box .pb{height:6px;border-radius:4px;background:rgba(148,163,184,.22);margin-top:8px;overflow:hidden}
.box .pb i{display:block;height:100%;width:0;border-radius:4px}
.box.d .pb i{background:linear-gradient(90deg,#34d399,#6ee7b7)}
.box.f .pb i{background:linear-gradient(90deg,#38bdf8,#7dd3fc)}
.inc-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:14px;font-size:9.5px;color:#8ba0b5}
.inc-foot b{color:#475569;font-weight:700}

/* ══════════ 5 · Mentions + pied ══════════ */
.legal{font-size:9.5px;color:#94a3b8;line-height:1.55;margin:0 0 16px}
.pgfoot{display:flex;justify-content:space-between;align-items:center;gap:12px;
  padding-top:13px;border-top:1px solid rgba(3,4,94,.09);font-size:10px;color:#a9b8c8}

/* ══════════ Couverture de chapitre épinglée — vague 1 ══════════

   La piste fait deux hauteurs d'écran ; l'intérieur colle sur une hauteur. Le
   scroll-film écrit --p (0 à 1) sur la piste ; tout ce qui bouge ici s'en sert.
   Aucune animation pilotée par le temps : le client arrête de défiler, la
   couverture s'arrête. C'est la différence entre une télécommande et un film.

   ⚠️ La piste est FRÈRE de .page, enfant direct du corps : position:sticky meurt
   sous un ancêtre à transform, filter ou backdrop-filter, et les cartes du
   rapport portent les deux. Ne jamais déplacer une couverture dans une carte. */
.couv{position:relative;z-index:0;height:200vh;--p:0}
.couv-in{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;
  justify-content:center;
  /* Estompe et soulèvement pilotés par le défilement. L'opacité se borne toute
     seule à [0,1] : au-dessus de 1 le navigateur clampe, on n'a donc pas besoin
     d'un clamp() explicite. À p=0,55 la couverture est encore pleine ; à p=0,88
     elle a disparu, bien avant que le contenu n'arrive dessus. */
  opacity:calc((0.88 - var(--p)) * 3.1);
  transform:translateY(calc(var(--p) * -34px))}

.couv-grille{width:min(1200px,100% - 2 * clamp(28px,5vw,80px));margin-inline:auto;
  display:grid;grid-template-columns:92px minmax(0,1fr);gap:0 24px;align-items:start}

/* Le numéro décimal dans la marge. Pas de police à chasse fixe dans le fichier :
   on la SIMULE avec les chiffres tabulaires de Montserrat et un interlettrage
   large. Zéro kilo-octet ajouté. */
.couv-num{font-family:'Montserrat',sans-serif;font-weight:700;font-size:15px;
  font-variant-numeric:tabular-nums;letter-spacing:.14em;color:var(--acc-couv);
  padding-top:12px}

.couv-sur{margin:0 0 16px;font-family:'Open Sans','Montserrat',sans-serif;font-weight:600;
  font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--sub-couv)}
.couv-titre{margin:0;font-family:'Montserrat',sans-serif;font-weight:800;
  font-size:clamp(38px,6.4vw,84px);line-height:.98;letter-spacing:-.025em;
  color:var(--ink-couv);text-wrap:balance}
.couv-phrase{margin:22px 0 0;max-width:44ch;
  font-family:'Open Sans','Montserrat',sans-serif;font-size:clamp(15px,1.5vw,19px);
  line-height:1.62;color:var(--sub-couv)}
/* Le trait se trace sous le défilement, jamais tout seul.
   ⚠️ PAS un ::after positionné : la phrase passe à la ligne, et sur un élément
   EN LIGNE qui s'étend sur deux fragments, un pseudo-élément absolu ne dessine
   qu'un trait fantôme — vérifié, il ne s'affichait nulle part. On peint donc un
   fond en dégradé dont on fait croître la LARGEUR, avec box-decoration-break en
   « clone » pour que chaque fragment de ligne reçoive le sien. */
.couv-souligne{color:var(--ink-couv);font-weight:600;
  padding-bottom:3px;
  background-image:linear-gradient(90deg,#00b4d8,#0077b6);
  background-repeat:no-repeat;background-position:0 100%;
  background-size:calc(var(--p) * 340%) 2px;
  -webkit-box-decoration-break:clone;box-decoration-break:clone}

/* La paire de chiffres. POSÉE, pas comptée : les odomètres du héros gardent
   l'exclusivité du mouvement, dix centimètres plus bas. Jamais deux chiffres qui
   bougent sur le même écran. */
.couv-paire{display:flex;align-items:flex-end;gap:clamp(16px,3vw,42px);margin-top:clamp(26px,4vh,46px);flex-wrap:wrap}
.couv-ch b{display:block;font-family:'Montserrat',sans-serif;font-weight:800;
  font-size:clamp(30px,4.4vw,58px);line-height:1;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums;color:var(--ink-couv)}
.couv-ch span{display:block;margin-top:8px;font-family:'Open Sans','Montserrat',sans-serif;
  font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--sub-couv)}
.couv-ch.est-proj b{color:var(--acc-couv)}
.couv-fl{font-family:'Montserrat',sans-serif;font-style:normal;font-size:26px;
  color:var(--sub-couv);padding-bottom:14px;opacity:.6}

/* L'invite. Un client de 60 ans devant une page qui « ne bouge pas » croit son
   ordinateur gelé. Elle ne pulse pas — elle est là, puis elle s'efface au premier
   geste (le --p s'en charge, sans minuterie). */
.couv-suite{position:absolute;left:50%;bottom:clamp(26px,5vh,54px);transform:translateX(-50%);
  display:inline-flex;flex-direction:column;align-items:center;gap:7px;
  border:0;background:none;cursor:pointer;padding:8px 14px;border-radius:12px;
  font-family:'Open Sans','Montserrat',sans-serif;font-size:10.5px;font-weight:600;
  letter-spacing:.2em;text-transform:uppercase;color:var(--sub-couv);
  opacity:calc((0.22 - var(--p)) * 6)}
.couv-suite:hover{color:var(--ink-couv)}
.couv-suite:focus-visible{outline:2px solid var(--acc-couv);outline-offset:2px}
.couv-chev{font-family:'Montserrat',sans-serif;font-size:15px;line-height:1}

/* Toute la couverture est cliquable : « tourner la page » mène AU CONTENU, jamais
   devant une couverture vide à défiler. */
.couv-in{cursor:pointer}

/* ── Les deux papiers, à un clic l'un de l'autre ──
   Froid = l'identité actuelle du rapport. Chaud = le registre KEEL de la maquette
   de Nicolas. Le comparateur est un OUTIL DE PROTOTYPE : il disparaît avec la
   décision. */
:root{--ink-couv:#03045e;--sub-couv:#586e82;--acc-couv:#0077b6;--pap-couv:transparent}
html[data-papier="chaud"]{--ink-couv:#14140f;--sub-couv:#4a4844;--acc-couv:#0f5c8c;--pap-couv:#f6f5f2}
html[data-papier="chaud"] .couv-in{background:var(--pap-couv)}
html[data-papier="chaud"] .couv-souligne{background-image:linear-gradient(90deg,#0f5c8c,#14140f)}
html[data-papier="chaud"] .aurora{opacity:.25}

.papier-bascule{position:fixed;left:18px;bottom:18px;z-index:60;display:flex;align-items:center;gap:6px;
  padding:6px 8px;border-radius:999px;font-family:'Open Sans','Montserrat',sans-serif;
  background:rgba(255,255,255,.9);border:1px solid rgba(3,4,94,.12);
  box-shadow:0 8px 22px -12px rgba(3,4,94,.35)}
.papier-bascule>span{font-size:9.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:#8fa0b2;padding:0 4px}
.papier-bascule button{border:0;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;
  padding:5px 11px;border-radius:999px;background:none;color:#586e82}
.papier-bascule button.est-actif{background:linear-gradient(135deg,#0077b6,#0096c4);color:#fff}

@media (max-width:900px){
  .couv{height:180vh}
  .couv-grille{grid-template-columns:1fr;gap:10px}
  .couv-num{padding-top:0}
}

/* Mouvement réduit : la couverture reste, complète et immobile. On coupe
   l'estompe (elle dépend du défilement) pour qu'elle ne se fige pas à moitié
   effacée, et la piste retombe à une hauteur d'écran — sans mouvement, deux
   hauteurs ne seraient qu'un long vide à traverser. */
@media (prefers-reduced-motion:reduce){
  .couv{height:auto;min-height:100vh}
  .couv-in{position:static;height:auto;opacity:1;transform:none;padding:14vh 0}
  .couv-souligne{background-size:100% 2px}
  .couv-suite{display:none}
}

/* À l'impression, la couverture devient un bloc-titre : jamais une page à moitié
   tournée, jamais deux hauteurs d'écran de blanc. */
@media print{
  .couv{height:auto;page-break-after:avoid}
  .couv-in{position:static;height:auto;opacity:1!important;transform:none!important;padding:0 0 18px}
  .couv-souligne{background-size:100% 2px}
  .couv-suite,.papier-bascule{display:none!important}
  .couv-titre{font-size:30px}
  .couv-ch b{font-size:24px}
}

/* ══════════ Vos comptes — la lecture fiscale ══════════
   Trois familles, trois teintes, et jamais de rouge pour « imposable » : ce n'est
   pas une alerte, c'est un fait. Le rouge reste réservé aux pertes. */
.sec i.v{background:linear-gradient(180deg,#0077b6,#00b4d8)}
.sec i.b{background:linear-gradient(180deg,#0891b2,#7dd3fc)}

.cpt-grille{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.cpt{position:relative;border-radius:14px;padding:15px 16px 13px;
  background:linear-gradient(160deg,rgba(255,255,255,.9),rgba(255,255,255,.6));
  border:1px solid rgba(3,4,94,.07);
  box-shadow:0 10px 26px -18px rgba(3,4,94,.3)}
.cpt-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
.cpt-nom{font-family:'Montserrat';font-weight:800;font-size:13.5px;color:var(--navy);letter-spacing:.01em}
.cpt-tag{font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  padding:3px 8px;border-radius:999px;white-space:nowrap}
.t-ok{background:#ecfdf5;color:#047857}
.t-att{background:#eff6ff;color:#1d4ed8}
.t-imp{background:#fff7ed;color:#b45309}
.t-neutre{background:#f1f5f9;color:#475569}
.cpt-val{font-family:'Montserrat';font-weight:800;font-size:24px;color:var(--navy);line-height:1;margin-bottom:9px}
.cpt-part{height:4px;border-radius:2px;background:rgba(3,4,94,.08);overflow:hidden;margin-bottom:11px}
.cpt-part i{display:block;height:100%;width:0;border-radius:2px;
  background:linear-gradient(90deg,#0077b6,#00b4d8);animation:w 1.1s .6s var(--e) forwards}
.cpt-lignes{display:grid;grid-template-columns:1fr auto;gap:5px 10px;font-size:11.5px;color:#586e82;align-items:baseline}
.cpt-lignes b{font-weight:600;color:#1a2a3a;font-variant-numeric:tabular-nums}
.cpt-lignes b.up{color:#047857}
.cpt-lignes b.down{color:#b91c1c}
.cpt-lignes em{font-style:normal;font-size:10.5px;opacity:.75}
.cpt-fisc{margin:11px 0 0;padding-top:10px;border-top:1px solid rgba(3,4,94,.07);
  font-size:11.5px;line-height:1.5;color:#37485c}
.cpt-total{display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  margin-top:16px;padding-top:13px;border-top:1px solid rgba(3,4,94,.09);
  font-size:12.5px;color:#37485c}
.cpt-total b{font-family:'Montserrat';font-weight:800;font-size:19px}
.cpt-total b.up{color:#047857}
.cpt-total b.down{color:#b91c1c}
.cpt-note{margin:13px 0 0;font-size:10.5px;line-height:1.55;color:#7d8ea0}

/* ══════════ Vos obligations ══════════ */
.ob-chiffres{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:16px}
.ob-chiffres>div{padding:11px 13px;border-radius:12px;background:rgba(236,254,255,.6);
  border:1px solid rgba(8,145,178,.14)}
.ob-chiffres b{display:block;font-family:'Montserrat';font-weight:800;font-size:18px;color:var(--navy);line-height:1.1}
.ob-chiffres span{display:block;margin-top:3px;font-size:10.5px;color:#586e82;line-height:1.35}

.ob-ligne{border-top:1px solid rgba(3,4,94,.07)}
.ob-ligne:first-child{border-top:0}
.ob-tete{display:grid;grid-template-columns:16px minmax(0,2.4fr) repeat(3,minmax(0,.9fr)) minmax(0,1fr);
  gap:10px;align-items:center;width:100%;padding:11px 4px;border:0;background:none;cursor:pointer;
  font-family:inherit;text-align:left;transition:background .2s}
.ob-tete:hover{background:rgba(0,180,216,.05)}
.ob-tete:focus-visible{outline:2px solid #0077b6;outline-offset:-2px;border-radius:8px}
.ob-chev{font-family:'Montserrat';font-weight:700;color:#0077b6;transition:transform .25s var(--e)}
.ob-tete[aria-expanded="true"] .ob-chev{transform:rotate(90deg)}
.ob-nom{min-width:0}
.ob-nom b{display:block;font-size:12.5px;font-weight:600;color:#1a2a3a;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ob-nom em{font-style:normal;font-size:10px;color:#8fa0b2}
.ob-col{font-size:12px;color:#1a2a3a;font-variant-numeric:tabular-nums;text-align:right}
.ob-col i{display:block;font-style:normal;font-size:9.5px;color:#8fa0b2;letter-spacing:.04em}
.ob-val{font-weight:600;color:var(--navy)}

.ob-detail{padding:4px 4px 18px}
.ob-vide{margin:0;font-size:11.5px;color:#8fa0b2}

/* La frise. Chaque année est une colonne ; les versements y sont des barres dont
   la hauteur suit le montant. Le capital écrase les coupons, et c'est le propos
   du dessin : on récupère surtout du capital, à la toute fin. */
.ob-frise-cadre{position:relative;padding-bottom:6px}
.ob-frise{display:flex;align-items:flex-end;gap:2px;height:190px;overflow-x:auto;overflow-y:hidden}
.ob-an{flex:1 0 58px;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative}
.ob-an::after{content:'';position:absolute;left:0;right:0;bottom:24px;height:1px;background:rgba(3,4,94,.16)}
.ob-an::before{content:'';position:absolute;left:0;bottom:20px;width:1px;height:9px;background:rgba(3,4,94,.22)}
.ob-piles{display:flex;align-items:flex-end;justify-content:center;gap:5px;height:100%;padding-bottom:25px}
.ob-pile{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;min-width:26px}
.ob-b{position:relative;width:100%;display:flex;align-items:center;justify-content:center}
.ob-b em{font-style:normal;font-size:8.5px;font-weight:700;color:#fff;white-space:nowrap}
.ob-coup{background:linear-gradient(180deg,#38bdf8,#0891b2);min-height:17px;border-radius:3px 3px 0 0}
.ob-cap{background:linear-gradient(180deg,#bae6fd,#7dd3fc)}
.ob-cap em{color:#0c4a6e}
.ob-pile.est-passe .ob-coup{background:linear-gradient(180deg,#cbd5e1,#94a3b8)}
.ob-pile.est-passe .ob-cap{background:linear-gradient(180deg,#e2e8f0,#cbd5e1)}
.ob-lab{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:10px;color:#7d8ea0}
.ob-an.est-ici .ob-lab{color:var(--navy);font-weight:600}

/* Le repère « où on en est », en écho au point d'interrogation du schéma. */
.ob-marque{display:flex;align-items:center;gap:8px;margin-top:2px}
.ob-fleche{width:0;height:0;flex:none;
  border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:10px solid #dc2626}
.ob-marque-txt{font-size:11.5px;color:#586e82}
.ob-marque-txt b{color:var(--navy);font-weight:600}
.ob-lecture{margin:12px 0 0;font-size:12px;line-height:1.6;color:#37485c}
.ob-lecture b{color:var(--navy);font-weight:600}

/* ══════════ Le panneau d'un mois de revenu ══════════ */
.bar{border:0;background:none;font-family:inherit;cursor:pointer;padding:0}
.bar:focus-visible{outline:2px solid #0077b6;outline-offset:2px;border-radius:6px}
.bar[aria-expanded="true"] .col{filter:brightness(.92) saturate(1.3)}
.mois-p{position:relative;margin:14px 0 2px;padding:16px 18px 14px;border-radius:14px;
  background:linear-gradient(160deg,rgba(240,253,250,.9),rgba(255,255,255,.7));
  border:1px solid rgba(5,150,105,.16)}
.mois-x{position:absolute;top:8px;right:10px;border:0;background:none;cursor:pointer;
  font-size:20px;line-height:1;color:#8fa0b2;font-family:inherit;padding:2px 6px;border-radius:8px}
.mois-x:hover{color:#1a2a3a;background:rgba(3,4,94,.05)}
.mois-t{margin:0 0 4px;font-family:'Montserrat';font-weight:800;font-size:15px;color:var(--navy)}
.mois-chiffres{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:12px;font-size:12px;color:#586e82}
.mois-chiffres b{color:#047857;font-weight:600}
.mois-etapes{margin:0;padding:0 0 0 4px;list-style:none;counter-reset:e}
.mois-etapes li{counter-increment:e;position:relative;padding:0 0 12px 32px}
.mois-etapes li::before{content:counter(e);position:absolute;left:0;top:0;
  width:21px;height:21px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:'Montserrat';font-weight:700;font-size:10.5px;color:#fff;
  background:linear-gradient(160deg,#0077b6,#00b4d8)}
.mois-etapes li:not(:last-child)::after{content:'';position:absolute;left:10px;top:24px;bottom:2px;
  width:1px;background:rgba(0,119,182,.2)}
.mois-etapes b{display:block;font-size:12.5px;font-weight:600;color:#1a2a3a;margin-bottom:2px}
.mois-etapes span{display:block;font-size:11.5px;line-height:1.55;color:#586e82}

@media (max-width:760px){
  .ob-tete{grid-template-columns:16px minmax(0,1fr) minmax(0,.8fr);row-gap:4px}
  .ob-tete .ob-col:nth-of-type(2),.ob-tete .ob-col:nth-of-type(3){display:none}
  .cpt-grille{grid-template-columns:1fr}
}

/* ══════════ Générique nominatif — « L'ARÊTE VIVE » ══════════

   Le client ouvre le fichier et voit une plaque de verre presque blanche, posée
   sur un plateau de studio plus sourd, dont le seul contour — un filet d'un pixel —
   passe du blanc pur au coin haut-gauche, au cyan de la maison sur l'arête du haut,
   à l'acier sur le flanc droit, puis s'éteint en bas. La lumière ne gicle pas sur
   le contenu : elle souligne un bord. Toutes les neuf secondes une comète quitte ce
   coin, court le long de l'arête du haut, tombe le long du flanc droit et meurt ;
   entre deux passages, plus rien ne tourne. Le nom reste de l'encre marine, et le
   seul objet qui respire en permanence est le bouton.

   SEPT LOIS. Toute proposition future qui en viole une est écartée sans débat.
   1. L'identifiant reste #intro, le bouton reste #intro-skip : d'autres règles les
      ciblent nommément (impression) et le script cherche le bouton.
   2. AUCUN @property, AUCUN backdrop-filter, AUCUN filter:blur, AUCUN
      mask-composite. Ce générique doit rendre à l'identique sur un Firefox 115 et
      un Safari 16, et tenir 60 images/s sur le processeur graphique intégré d'un
      portable d'entreprise en partage d'écran Teams.
   3. Tout ce qui boucle est transform ou opacity. Rien d'autre. Jamais.
   4. AUCUN background-clip:text sur le nom. Encre pleine, noeud de texte entier.
   5. Toute animation RETARDÉE se déclare sous #intro.gen-pret : un animation-delay
      compte à partir de la création de l'élément, pas de la pose de la classe, et
      .gen-pret n'arrive qu'après document.fonts.ready (300 à 600 ms sur un portable
      froid). Un tir unique déclaré hors de .gen-pret joue avant le lever de rideau.
   6. Toute valeur qui oscille est DÉCLARÉE au milieu de son oscillation, jamais à
      un extrême : « moins d'animations » la fige exactement là.
   7. Le bloc de sortie vient APRÈS le bloc d'entrée. Même spécificité, c'est
      l'ordre du source qui tranche.

   MESURES DE LA BOUCLE DU 30 JUILLET 2026 (960x540, 18,75 s, aller-retour) :
   fond de studio 250 à 255 unités de gris ; sujet x 17,9 % à 74,6 %, y 1,5 % à 88,1 %.
   Les arrêts de l'ancienne vidéo (12,9-73,3 / 6,7-94,8) et ses valeurs de halo
   (222-236) sont MORTS avec elle : les réemployer, c'est peindre une plaque grise
   autour d'une image quasi blanche. */

/* ── 1 · LE PLATEAU ─────────────────────────────────────────────────────────
   Il descend de 230 à 221 unités de gris. C'est délibéré, et c'est la seule façon
   d'avoir du néon en mode clair : le néon n'est pas une couleur, c'est un ÉCART.
   Sur un pâle uniforme, un cyan à 60 % fait une tache ; sur un pâle structuré en
   deux valeurs — plateau 221, plaque 250 — il fait une arête.
   Ce n'est pas la page qui s'est assombrie : c'est le fond de la VIDÉO qui s'est
   éclairci de 224 à 252. Le point de comparaison a changé. */
#intro{position:fixed;inset:0;z-index:100;
  display:grid;align-content:safe center;
  overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;
  cursor:pointer;user-select:none;-webkit-user-select:none;
  opacity:0;pointer-events:none;
  --gm:clamp(40px,5vw,80px);
  --ge:cubic-bezier(.22,.61,.36,1);
  --gs:cubic-bezier(.4,0,.2,1);
  background-color:#d8e0ea;
  background-image:
    radial-gradient(64% 60% at 50% 44%,rgba(0,180,216,.20) 0%,rgba(0,180,216,0) 72%),
    radial-gradient(58% 54% at 12% 16%,rgba(255,255,255,.66) 0%,rgba(255,255,255,0) 70%),
    radial-gradient(46% 44% at 92% 90%,rgba(0,119,182,.16) 0%,rgba(0,119,182,0) 74%),
    linear-gradient(180deg,#dee5ee 0%,#d8e0ea 52%,#d1dae6 100%)}
/* Le calque n'intercepte le clic qu'une fois prêt : si le script ne tournait pas,
   un rectangle invisible et plein écran rendrait tout le rapport incliquable. */
#intro.gen-pret{opacity:1;pointer-events:auto}
#intro:focus{outline:none}

/* Grain de tramage : des aplats pâles séparés de quinze unités bandent sur une
   dalle 8 bits, et le partage d'écran Teams amplifie le phénomène. Le plateau
   couvre maintenant vingt unités : le grain monte de 3,2 à 3,6 %. */
#intro::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.036;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='1' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23g)'/></svg>");
  background-repeat:repeat;background-size:200px 200px}

/* ── 2 · LA PLAQUE ET SON ARÊTE ─────────────────────────────────────────────
   Le socle de toute la direction, et il coûte EXACTEMENT ZÉRO : aucun masque,
   aucune conique animée, aucun @property. La couche du BAS est peinte jusqu'au
   border-box (elle remplit donc la bordure de 1 px), les trois du HAUT jusqu'au
   padding-box (elles recouvrent l'intérieur). Il ne reste visible du dégradé
   d'arête que le liséré de 1 px. Pris en charge partout depuis 2015.

   >>> AUCUN background-color ici : la couleur de fond est découpée selon la
   DERNIÈRE valeur de background-clip (border-box) et mangerait l'arête d'un coup.
   C'est pour ça que la troisième couche (178deg) est OPAQUE : elle fait office de
   fond.
   >>> AUCUN overflow:hidden ici : le halo de la scène DOIT franchir le liséré.
   Avec un intérieur à 250 sur un plateau à 221, ce débordement se lit comme une
   lueur, pas comme une bavure. Le rognage le couperait net sur un arc de 27 px.
   >>> La largeur déménage de .gen-grille vers .gen-plaque. Le script mesure
   h1.parentNode.clientWidth, c'est-à-dire .gen-texte, qui reste sans rembourrage —
   c'est précisément pour ça que le rembourrage va sur la plaque. */
/* Le décalage du haut pour les sauts de chapitre. Il vit ici et non dans le
   script : le navigateur le réapplique à chaque défilement, même si la page a
   grandi entre-temps. */
[data-chap]{scroll-margin-top:26px}

.gen-plaque{position:relative;z-index:1;
  width:min(1200px,100% - 2 * var(--gm));margin-inline:auto;
  border:1px solid transparent;border-radius:22px;
  background-image:
    radial-gradient(122% 128% at 8% 0%,rgba(255,255,255,.92) 0%,rgba(255,255,255,0) 58%),
    radial-gradient(78% 68% at 79% 100%,rgba(0,168,204,.09) 0%,rgba(0,168,204,0) 70%),
    linear-gradient(178deg,#f6f8fb 0%,#f1f4f8 58%,#eef0f3 100%),
    linear-gradient(126deg,
      #ffffff 0%,
      rgba(214,240,255,.95) 12%,
      rgba(0,180,216,.70) 26%,
      rgba(0,119,182,.46) 44%,
      rgba(0,119,182,.26) 62%,
      rgba(3,4,94,.14) 82%,
      rgba(3,4,94,.08) 100%);
  background-clip:padding-box,padding-box,padding-box,border-box;
  background-origin:padding-box,padding-box,padding-box,border-box;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.85),
    inset 0 -1px 0 rgba(12,27,52,.05),
    0 2px 5px -2px rgba(12,27,52,.10),
    0 26px 56px -28px rgba(12,27,52,.32),
    0 64px 120px -64px rgba(0,119,182,.30)}

/* Rembourrage et gouttière FIXES, pas en vw : la plaque est plafonnée à 1200 px,
   donc des valeurs en vw continuaient de grandir avec la fenêtre alors que la boîte,
   elle, ne bougeait plus. Résultat : le nom du client rapetissait quand on
   agrandissait la fenêtre — 64 px à 1440, 60 px à 1920. Une boîte de largeur fixe
   veut un rembourrage de largeur fixe.
   58/42 et non 54/46 : sur un carton de titre, le sujet est le NOM. */
.gen-grille{position:relative;z-index:1;width:100%;margin-inline:0;
  padding-inline:40px;
  padding-block:clamp(44px,6.6vh,78px);
  display:grid;grid-template-columns:minmax(0,58fr) minmax(0,42fr);
  column-gap:64px;align-items:center}

/* ── 3 · LA COMÈTE ──────────────────────────────────────────────────────────
   DEUX segments, jamais quatre. La lumière quitte la source (le coin haut-gauche),
   longe l'arête du haut, tombe le long du flanc droit et meurt en bas à droite, là
   où l'arête statique est déjà éteinte. C'est une CHUTE de lumière.
   Un tour complet du périmètre aurait un trajet de RETOUR, et c'est le retour —
   pas la vitesse — qui fait lire « indicateur de chargement » sur un document
   financier. Rapport de service 54 % : 4,86 s de course, 4,14 s de silence.
   Les bandes sont à -1px : elles chevauchent la bordure et courent DANS leur rail.
   À top:0 elles formeraient un second filet collé sous l'arête, soit un trait sale
   de 2,8 px. Le retrait de 14 px les tient hors des coins arrondis. */
.gen-court{position:absolute;overflow:hidden;pointer-events:none;z-index:2;border-radius:2px}
.gen-court.h1{top:-1px;left:14px;right:14px;height:1.8px}
.gen-court.v1{right:-1px;top:14px;bottom:14px;width:1.8px}
.gen-court i{position:absolute;inset:0;display:block;background-repeat:no-repeat;will-change:transform}
.gen-court.h1 i{background-size:32% 100%;
  background-image:linear-gradient(90deg,
    rgba(0,180,216,0) 0%,rgba(0,180,216,.44) 24%,rgba(120,214,240,.90) 44%,
    rgba(255,255,255,.94) 50%,rgba(120,214,240,.82) 56%,rgba(0,180,216,.36) 74%,
    rgba(0,180,216,0) 100%)}
.gen-court.v1 i{background-size:100% 32%;
  background-image:linear-gradient(180deg,
    rgba(0,180,216,0) 0%,rgba(0,180,216,.44) 24%,rgba(120,214,240,.90) 44%,
    rgba(255,255,255,.94) 50%,rgba(120,214,240,.82) 56%,rgba(0,180,216,.36) 74%,
    rgba(0,180,216,0) 100%)}
/* 38 % / 16 % : sur une plaque de 1355 px, l'arête du haut vaut 70,8 % du trajet et
   le flanc droit de 560 px en vaut 29,2 %. La vitesse reste constante au tournant. */
@keyframes gen-comete-h{0%{transform:translateX(-40%)}38%,100%{transform:translateX(100%)}}
@keyframes gen-comete-v{0%,38%{transform:translateY(-40%)}54%,100%{transform:translateY(100%)}}

/* ── 4 · LE TEXTE ───────────────────────────────────────────────────────────
   Le texte passe AU-DESSUS de la scène : le halo de raccord déborde sur sa gauche
   et venait griser la fin du nom. */
.gen-texte{grid-column:1;text-align:left;position:relative;z-index:2}

/* Le balayage qui RÉVÈLE le nom : il passe DERRIÈRE le bloc de texte à 520 ms,
   pendant que le nom monte. Une seule fois. Au plus fort il vaut du blanc à .62 sur
   du 250 : le fond monte à 253, le contraste MONTE au lieu de descendre. Son repos
   est l'absence — en mouvement réduit il n'existe simplement pas, et rien ne manque. */
.gen-texte::before{content:'';position:absolute;z-index:-1;top:8%;bottom:14%;left:-8%;
  width:46%;pointer-events:none;opacity:0;
  background:linear-gradient(102deg,
    rgba(255,255,255,0) 0%,rgba(224,246,255,.34) 40%,rgba(255,255,255,.62) 52%,
    rgba(214,240,255,.30) 62%,rgba(255,255,255,0) 100%)}
@keyframes gen-eclair{
  0%{opacity:0;transform:translateX(-70%)}
  22%{opacity:1}
  78%{opacity:1}
  100%{opacity:0;transform:translateX(190%)}}

/* Le survitre reprend exactement celui du site : une pastille cyan, puis le nom
   de la firme en capitales espacées. Sur le site le texte est cyan sur fond sombre ;
   ici il est sur du presque blanc, donc il passe au bleu de marque #0077b6 —
   4,9:1, alors que le cyan n'y donnerait que 2,4:1. La pastille, elle, garde le
   cyan plein : elle est décorative, et c'est elle qui porte la lueur. */
/* Le logo ouvre la colonne — et c'est un LOGOTYPE : il porte le nom de la firme en
   toutes lettres. Deux conséquences. La première : le survitre n'a plus à répéter
   « Groupe Financier Ste-Foy », il dit maintenant ce que le document EST. La
   seconde : à 38 px de haut, les lettres du logo tombaient sous dix pixels et il se
   lisait comme une tache ; à 46 px elles sont franches, et l'actif a été regénéré à
   150 px de haut (tools/build-report-logo.mjs) pour tenir la double densité.
   C'est du texte, pas un pictogramme : il lui faut de la résolution. */
.gen-logo{display:block;height:46px;width:auto;margin:0 0 28px;
  filter:drop-shadow(0 6px 14px rgba(3,4,94,.10))}
.gen-marque{display:flex;align-items:center;gap:11px;margin:0;
  font-family:'Open Sans','Montserrat',sans-serif;font-weight:600;
  font-size:13px;line-height:1;letter-spacing:.2em;text-transform:uppercase;color:#0077b6}
.gen-marque span{margin-right:-.2em}
/* La lueur est le jeton --neon-glow du site, au pixel près. Elle ne pulse PAS :
   le bouton est la seule chose qui respire dans cette page. */
.gen-filet{flex:0 0 auto;width:9px;height:9px;border-radius:50%;transform-origin:center;
  background:radial-gradient(circle at 34% 32%,#7fe0f5 0%,#00b4d8 52%,#0090b4 100%);
  box-shadow:0 0 15px rgba(0,180,216,.4),0 0 4px rgba(0,180,216,.9)}

/* ── 5 · LE NOM ─────────────────────────────────────────────────────────────
   La lumière ne touche JAMAIS la lettre. Elle passe derrière, elle passe dessous,
   elle passe à côté. Le nom reste de l'encre pleine sur du papier clair : c'est ce
   qui le garde digne sur un relevé financier.
   La taille déclarée ici n'est qu'un repli : le script en écrit une, MESURÉE, en
   style en ligne. Compter les caractères serait un mauvais indicateur — en
   Montserrat 800, un patronyme riche en M et en W fait près du double d'un
   patronyme en i et en l. Aucune requête de média ne redéclare font-size ici :
   une seule source de vérité, sinon le style en ligne gagnerait de toute façon.
   AUCUNE animation n'est ajoutée sur .gen-nom : il porte déjà gen-monte-nom, et une
   animation propre sur un élément qui porte déjà une classe d'entrée écrase son
   opacité initiale. Le halo vit sur un pseudo-élément neuf.
   position:relative SANS z-index : aucun contexte d'empilement n'est créé, le
   pseudo à z-index:-1 se peint derrière le texte et devant le fond de la plaque. */
.gen-nom{position:relative;margin:20px 0 0;
  font-family:'Montserrat',sans-serif;font-weight:800;
  font-size:clamp(30px,5.4vw,96px);line-height:1.02;letter-spacing:-.03em;
  color:#03045e;
  text-shadow:
    0 1px 0 rgba(255,255,255,.85),
    0 16px 30px rgba(3,4,94,.11),
    0 34px 64px rgba(0,119,182,.12);
  text-wrap:balance;hyphens:manual;overflow-wrap:normal;word-break:normal;
  user-select:text;-webkit-user-select:text}
/* Le débordement à DROITE est volontairement nul : tout ce qui dépasse à droite
   gonfle le scrollWidth de son parent, et le nom se mesure là-dedans. Le halo est
   de toute façon centré à 22 % de la gauche : sa moitié droite est transparente. */
.gen-nom::before{content:'';position:absolute;z-index:-1;inset:-16% 0 -22% -5%;
  pointer-events:none;
  background:radial-gradient(58% 62% at 22% 46%,rgba(0,180,216,.16) 0%,rgba(0,180,216,0) 72%)}
@keyframes gen-floraison{from{opacity:0}}

/* ── 6 · LA TYPOGRAPHIE, RECALIBRÉE SUR L'INTÉRIEUR DE PLAQUE (250) ─────────
   Le point médian est décoratif, mais il ne doit pas disparaître pour un oeil de
   62 ans en partage Teams : #93a1af donnait 2,55:1, #6f8296 donne 3,82:1. */
.gen-sous{margin:20px 0 0;
  font-family:'Open Sans','Montserrat',sans-serif;font-weight:400;
  font-size:17px;line-height:1.5;color:#1a2a3a}   /* --text-main du site, 12,7:1 */
.gen-sous b{font-weight:600;color:#03045e}
.gen-pt{display:inline-block;padding:0 .6em;color:#8fa0b2}
.gen-action{margin:38px 0 0}
.gen-aide{margin:14px 0 0;
  font-family:'Open Sans','Montserrat',sans-serif;font-weight:400;
  font-size:15px;line-height:1.4;letter-spacing:.02em;color:#586e82}  /* --text-muted du site, 4,6:1 */

/* ── 7 · LE BOUTON ──────────────────────────────────────────────────────────
   C'EST LA PIÈCE. Trois décisions tranchées, contre le réflexe du moment :

   a) L'anneau conique NE TOURNE PAS EN BOUCLE. Un anneau qui tourne sans arrêt
      autour d'un bouton dit « patiente, je travaille » — le vocabulaire universel
      du chargement — sur le seul objet dont la fonction est de faire cliquer. Il
      fait UN tour à l'arrivée, se gare à 227deg, et repart pour UN tour au survol
      et au focus. Il s'allume quand on le touche.
   b) Il RESPIRE quand même, et sans souris : c'est la lueur extérieure qui oscille
      sur 5,6 s. Indispensable — en partage d'écran Teams, le client REGARDE, il ne
      survole rien, et le conseiller ne bouge pas la souris. Un bouton vivant
      uniquement au survol est un bouton mort pour le seul public qui compte.
   c) L'anneau visible fait 2 px, pas 1,4 : à 1,4 px un trait cyan se fait manger
      par le sous-échantillonnage de chrominance de Teams.

   isolation:isolate est OBLIGATOIRE, et pas pour la raison qu'on croit : ce n'est
   pas pour protéger le libellé (z-index:4 gagne déjà dans le même contexte), c'est
   pour empêcher la lueur et le halo d'aller s'intercaler avec les frères de
   .gen-action dans le contexte de .gen-texte.
   Le bouton n'a AUCUNE animation d'entrée — c'est .gen-action, son parent, qui
   monte. Ses transform de survol et d'appui sont donc libres. */
.gen-entrer{position:relative;isolation:isolate;
  display:inline-flex;align-items:center;justify-content:center;
  height:56px;padding:0 34px;border:0;border-radius:999px;background:none;cursor:pointer;
  font-family:'Montserrat',sans-serif;font-weight:700;font-size:19px;line-height:1;
  letter-spacing:.005em;color:#fff;
  box-shadow:
    0 4px 20px rgba(0,119,182,.28),
    0 16px 30px -16px rgba(3,4,94,.34),
    0 0 0 5px rgba(0,180,216,.08),
    0 14px 30px -14px rgba(0,180,216,.40);
  transition:transform .18s var(--ge),box-shadow .24s var(--ge)}
.gen-lbl{position:relative;z-index:4;display:inline-flex;align-items:center}

/* La lueur extérieure : le SEUL souffle permanent de la page. Opacité pure.
   Base à .78, milieu exact de l'oscillation .55 à 1 : figée, elle est juste. */
.gen-halo{position:absolute;inset:-16px -22px -20px;border-radius:999px;
  z-index:0;pointer-events:none;opacity:.78;will-change:opacity;
  background:radial-gradient(58% 120% at 50% 54%,
    rgba(0,180,216,.36) 0%,rgba(0,180,216,.14) 40%,rgba(0,180,216,0) 74%)}
@keyframes gen-souffle{from{opacity:.55}to{opacity:1}}

/* L'anneau. On ne fait JAMAIS tourner l'angle d'un dégradé conique — repeinture
   intégrale à chaque image, plus un repli @property à écrire. On fait tourner un
   CARRÉ au conique figé, en transform pur, et on le découpe au rayon de la pilule :
   même rendu, coût de compositeur seul, zéro @property.
   « from 227deg » place l'éclat blanc EN HAUT À GAUCHE, exactement d'où vient la
   lumière de la plaque : au repos, et en mouvement réduit, le bouton reste éclairé
   du bon côté. DEUX foyers d'intensités différentes — un indicateur de chargement
   n'en a jamais deux, et c'est ce détail, plus que la vitesse, qui empêche la
   lecture « ça charge ».
   360 px couvrent la diagonale dans tous les cas, y compris sous 700 px où la
   pilule passe à 320 px. Le linear-gradient est déclaré AVANT la conique : si
   conic-gradient est inconnu, la déclaration invalide tombe et le repli reste digne.
   PAS de will-change : la rotation ne joue que 1,4 s puis 1,6 s au survol. */
.gen-anneau{position:absolute;inset:0;border-radius:999px;overflow:hidden;
  z-index:1;pointer-events:none;opacity:.92;transition:opacity .22s var(--ge)}
.gen-anneau::before{content:'';position:absolute;top:50%;left:50%;
  width:360px;height:360px;margin:-180px 0 0 -180px;
  background:linear-gradient(135deg,#78d6f0,#0077b6 55%,#03045e);
  background:conic-gradient(from 227deg,
    rgba(0,180,216,0) 0deg,
    rgba(0,180,216,.12) 30deg,
    rgba(64,200,238,.86) 62deg,
    rgba(234,250,255,1) 84deg,
    #ffffff 90deg,
    rgba(120,214,240,.90) 98deg,
    rgba(0,180,216,.24) 132deg,
    rgba(0,180,216,0) 176deg,
    rgba(120,184,214,0) 224deg,
    rgba(150,205,238,.55) 262deg,
    rgba(120,184,214,.16) 300deg,
    rgba(0,180,216,0) 336deg,
    rgba(0,180,216,0) 360deg)}
@keyframes gen-tour{from{transform:rotate(0)}to{transform:rotate(360deg)}}
/* Deuxieme nom, images-cles IDENTIQUES. Ce n'est pas de la redondance : si le
   survol reutilisait « gen-tour », le navigateur ne relancerait RIEN — la liste des
   noms d'animation ne changeant pas, il se contente de mettre a jour la duree d'une
   animation deja terminee, et l'anneau reste immobile. Verifie au navigateur. */
@keyframes gen-tour-b{from{transform:rotate(0)}to{transform:rotate(360deg)}}

/* Le fond opaque, qui ne laisse voir que 2 px d'anneau. Au point le PLUS CLAIR du
   bouton, le blanc donne 5,87:1 ; à hauteur de capitale, 11,1:1. Le voile blanc à
   .12 n'est pas négociable : à .20 le pire cas descend à 4,85:1, et on ne joue pas
   avec un demi-point de marge sur l'action principale d'un document financier. */
/* Le dégradé du site — linear-gradient(135deg,#0077b6,#00a8cc) — avec son
   extrémité claire ramenée à #0096c4. Raison chiffrée : du blanc sur #00a8cc ne
   donne que 2,8:1, et sur #0096c4 il donne 3,4:1 ; à 19 px en graisse 700 le texte
   est « large » au sens de la norme, et le seuil tombe à 3:1. On garde donc la
   couleur de la maison ET un libellé lisible, ce qui n'était pas le cas du bouton
   du site. Le voile blanc du haut ajoute le galbe. */
.gen-fond{position:absolute;inset:2px;border-radius:999px;z-index:2;pointer-events:none;
  background-image:
    linear-gradient(180deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,0) 52%),
    linear-gradient(135deg,#0077b6 0%,#0086bd 52%,#0096c4 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.26),inset 0 -1px 0 rgba(0,0,0,.22)}

/* Le balayage spéculaire du survol. Le transform statique et l'image-clé à 0 %
   portent la MÊME valeur, et l'animation n'a PAS de fill-mode : elle prend la main
   780 ms puis rend l'élément à son repos. C'est le seul motif où un transform
   statique et une animation de transform cohabitent sans se battre. */
.gen-lueur{position:absolute;inset:2px;border-radius:999px;z-index:3;overflow:hidden;
  pointer-events:none;opacity:0;transition:opacity .2s var(--ge)}
.gen-lueur::before{content:'';position:absolute;top:-40%;bottom:-40%;left:0;width:46%;
  transform:translateX(-170%);
  background:linear-gradient(104deg,
    rgba(255,255,255,0) 0%,rgba(190,236,255,.40) 44%,rgba(255,255,255,.55) 52%,
    rgba(190,236,255,.28) 62%,rgba(255,255,255,0) 100%)}
@keyframes gen-balaye{from{transform:translateX(-170%)}to{transform:translateX(330%)}}

/* La flèche n'existe QUE dans Montserrat : la pile de polices reste déclarée ici.
   La transition couvre transform ET text-shadow, sinon la lueur claque au lieu de
   glisser. */
.gen-fleche{font-family:'Montserrat',sans-serif;font-weight:700;margin-left:10px;
  transform:translateY(.5px);
  transition:transform .18s var(--ge),text-shadow .2s var(--ge)}

/* Le survol du site : une élévation de 2 px et sa lueur cyan. */
.gen-entrer:hover{transform:translateY(-2px);
  box-shadow:
    0 6px 24px rgba(0,119,182,.35),
    0 22px 40px -18px rgba(3,4,94,.38),
    0 0 0 6px rgba(0,180,216,.14),
    0 0 28px -2px rgba(0,180,216,.50)}
.gen-entrer:hover .gen-anneau,.gen-entrer:focus-visible .gen-anneau{opacity:1}
.gen-entrer:hover .gen-lueur,.gen-entrer:focus-visible .gen-lueur{opacity:1}
.gen-entrer:hover .gen-lueur::before{will-change:transform;
  animation:gen-balaye .78s cubic-bezier(.22,.61,.36,1)}
.gen-entrer:hover .gen-fleche{transform:translate(4px,.5px);
  text-shadow:0 0 10px rgba(0,180,216,.6)}

/* L'appui : une SEULE déclaration transform, deux fonctions. Deux transform sur le
   même noeud se battent. L'anneau passe à pleine intensité au moment du clic : la
   dernière chose que le client voit avant que le rapport s'ouvre, c'est le contour
   qui s'allume. */
.gen-entrer:active{transform:translateY(0) scale(.985);transition-duration:.09s;
  box-shadow:
    0 1px 2px rgba(3,4,94,.16),
    0 6px 14px -8px rgba(3,4,94,.5),
    0 0 0 3px rgba(0,180,216,.20)}
.gen-entrer:active .gen-anneau{opacity:1}
.gen-entrer:active .gen-fond{
  box-shadow:inset 0 2px 7px rgba(0,0,0,.34),inset 0 -1px 0 rgba(255,255,255,.06)}

/* #0077b6 — le bleu d'accent de la marque — sur le plateau (#d8e0ea) : 4,0:1,
   au-dessus du 3:1 exigé pour un indicateur non textuel. Le cyan #00b4d8 n'y
   donnerait que 2,0:1 : il éclaire, il ne signale pas.
   :focus-visible et non :focus — le script donne le focus au CALQUE, jamais au
   bouton, précisément pour ne pas peindre l'anneau sans geste du client. */
.gen-entrer:focus-visible{outline:3px solid #0077b6;outline-offset:3px}

/* ── 8 · LA SCÈNE ET SON RACCORD, REMESURÉS ─────────────────────────────────
   Le halo ne rattrape plus de luminance : il n'y a plus rien à rattraper, la vidéo
   et l'intérieur de la plaque sont à deux unités l'un de l'autre. Son vrai travail
   devient la fuite BLEUE de la sculpture dans la plaque — d'où le gris qui monte
   presque au blanc et le bleu qui monte à .17.
   Les rayons du masque restent à EXACTEMENT 50 % : au-delà, le dégradé n'a pas fini
   de s'éteindre quand il rencontre le bord de sa propre boîte, et ce bord se voit —
   un liséré vertical de deux unités sur toute la hauteur de la page. */
.gen-scene{grid-column:2;position:relative;z-index:1;width:100%;aspect-ratio:4/3;
  margin-top:clamp(0px,2vh,22px)}
/* La nouvelle boucle a un fond #eeeeee IDENTIQUE sur ses quatre bords — mesuré,
   amplitude d'une unité sur toute la boucle. Il n'y a plus de chute de lumière à
   prolonger : le halo n'a plus qu'un seul travail, poser autour de la scène la
   valeur exacte de son fond, puis se dissoudre dans la plaque.
   ⚠️ Son masque doit rester OPAQUE sur toute la scène et ne fondre qu'au-delà. À
   45 % d'opacité sur le bord de l'image, il laissait passer le bleu de la plaque :
   l'écart de LUMINANCE était de deux unités seulement, mais l'écart de TEINTE —
   gris neutre contre bleuté — redessinait le rectangle. C'est la teinte, pas la
   clarté, qui trahit un raccord sur des valeurs aussi proches. */
.gen-scene::before{content:'';position:absolute;inset:-38% -28%;z-index:0;pointer-events:none;
  background:
    linear-gradient(180deg,rgba(238,238,238,.96) 0%,rgba(238,238,238,.94) 100%),
    radial-gradient(52% 48% at 54% 50%,rgba(0,119,182,.14) 0%,rgba(0,119,182,0) 74%);
  -webkit-mask-image:radial-gradient(50% 50% at 50% 50%,#000 0%,#000 60%,rgba(0,0,0,.5) 80%,transparent 100%);
  mask-image:radial-gradient(50% 50% at 50% 50%,#000 0%,#000 60%,rgba(0,0,0,.5) 80%,transparent 100%);
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-size:100% 100%;mask-size:100% 100%}

/* Masque HORIZONTAL, recalculé APRÈS le rognage 4/3 : le sujet mesuré à 16,3 %-
   73,8 % dans l'image occupe alors 6,7 % à 83,4 % de la boîte. Opaque de 3 % à
   87 %. Ces arrêts dépendent du cadrage ET du point de cadrage : changer l'un des
   deux sans refaire ce calcul rogne les personnages de premier plan. */
.gen-scene-h{position:absolute;inset:0;z-index:1;clip-path:inset(100% 0 0 0);
  -webkit-mask-image:linear-gradient(to right,rgba(0,0,0,0) 0%,rgba(0,0,0,.5) 1.2%,
    rgba(0,0,0,1) 3%,rgba(0,0,0,1) 87%,rgba(0,0,0,.45) 94%,rgba(0,0,0,0) 100%);
  mask-image:linear-gradient(to right,rgba(0,0,0,0) 0%,rgba(0,0,0,.5) 1.2%,
    rgba(0,0,0,1) 3%,rgba(0,0,0,1) 87%,rgba(0,0,0,.45) 94%,rgba(0,0,0,0) 100%);
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-size:100% 100%;mask-size:100% 100%}

/* Masque VERTICAL, sur un SECOND noeud : pas de mask-composite, dont l'absence de
   prise en charge fait réapparaître le rectangle en entier.
   Le sujet occupe 3,7 % à 96,3 % de la hauteur : il ne reste presque rien pour
   fondre. On ne fond donc quasiment plus — on part à .94 d'alpha sur 1,8 % en haut
   et on referme sur les deux derniers pour cent en bas. C'est assez pour tuer la
   ligne de pixels durs, et ça ne mange ni une couronne ni une paire de pieds.
   CELA NE TIENT QUE PARCE QUE LE FOND DE LA VIDÉO (#eeeeee, uniforme sur les quatre
   bords) ET L'INTÉRIEUR DE LA PLAQUE SONT À DEUX UNITÉS L'UN DE L'AUTRE. Assombrir
   la plaque ferait réapparaître la coupe d'un seul coup. */
.gen-scene-i{position:absolute;inset:0;
  -webkit-mask-image:linear-gradient(to bottom,rgba(0,0,0,.94) 0%,rgba(0,0,0,1) 1.8%,
    rgba(0,0,0,1) 97.4%,rgba(0,0,0,.5) 99%,rgba(0,0,0,0) 100%);
  mask-image:linear-gradient(to bottom,rgba(0,0,0,.94) 0%,rgba(0,0,0,1) 1.8%,
    rgba(0,0,0,1) 97.4%,rgba(0,0,0,.5) 99%,rgba(0,0,0,0) 100%);
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-size:100% 100%;mask-size:100% 100%}

/* L'affiche est une VRAIE image posée sous la vidéo, dans la même boîte masquée :
   couverture avant le premier décodage, repli si le Blob échoue, image fixe en
   mouvement réduit — en subissant exactement les mêmes masques, donc le raccord est
   identique dans les trois cas. */
/* Cadrage : la boîte est en 4/3 et l'image en 16/9, donc « cover » rogne un tiers
   de la largeur. Le sujet est centré à 46 % de l'image, pas à 50 % : le point de
   cadrage suit. Après rognage, le sujet occupe 8,5 % à 84,1 % de la boîte au lieu
   de 16,3 % à 73,8 % — il remplit enfin son cadre, et la plaque reprend de la
   hauteur au lieu de s'aplatir en bannière. */
.gen-fixe,.gen-video{position:absolute;inset:0;width:100%;height:100%;
  display:block;object-fit:cover;object-position:45% 50%}
.gen-fixe{z-index:0}
.gen-video{z-index:1;pointer-events:none;background:transparent}
.gen-scene[data-etat="fixe"] .gen-video{display:none}

/* ── 9 · ENTRÉE. Toutes les animations retardées sont ici, sous .gen-pret. ───
   État déclaré = état final, fill-mode backwards : aucune classe n'est posée en JS
   sur les enfants, et rien ne peut rester coincé à opacity:0. */
#intro .gen-logo,#intro .gen-marque,#intro .gen-nom,#intro .gen-sous,#intro .gen-action,#intro .gen-aide{opacity:0}
#intro.gen-pret{animation:fin .28s ease-out backwards}
#intro.gen-pret .gen-plaque{animation:gen-pose .72s cubic-bezier(.22,.61,.36,1) .06s backwards}
@keyframes gen-pose{from{opacity:0;transform:translateY(16px) scale(.988)}}
#intro.gen-pret .gen-scene-h{clip-path:inset(0 0 0 0);
  animation:gen-rideau .7s cubic-bezier(.16,.84,.36,1) .16s backwards}
#intro.gen-pret .gen-logo{opacity:1;animation:gen-monte .44s var(--ge) .2s backwards}
#intro.gen-pret .gen-marque{opacity:1;animation:gen-monte .4s var(--ge) .34s backwards}
#intro.gen-pret .gen-filet{animation:gen-charge .5s var(--ge) .4s backwards}
@keyframes gen-charge{from{opacity:0;transform:scale(0)}}
#intro.gen-pret .gen-nom{opacity:1;animation:gen-monte-nom .64s var(--ge) .46s backwards}
#intro.gen-pret .gen-nom::before{animation:gen-floraison .9s var(--ge) .62s backwards}
#intro.gen-pret .gen-texte::before{animation:gen-eclair .72s cubic-bezier(.33,0,.2,1) .62s backwards}
#intro.gen-pret .gen-sous{opacity:1;animation:gen-monte .4s var(--ge) .8s backwards}
#intro.gen-pret .gen-action{opacity:1;animation:gen-monte .42s var(--ge) .96s backwards}
#intro.gen-pret .gen-aide{opacity:1;animation:fin .36s ease-out 1.14s backwards}
#intro.gen-pret .gen-court.h1 i{animation:gen-comete-h 9s linear 1.6s infinite}
#intro.gen-pret .gen-court.v1 i{animation:gen-comete-v 9s linear 1.6s infinite}
#intro.gen-pret .gen-halo{animation:gen-souffle 5.6s cubic-bezier(.37,0,.63,1) 1.6s infinite alternate}
/* Le tour d'arrivée de l'anneau. Il DOIT être battu par le tour de survol, qui porte
   le même préfixe et une classe de plus : la spécificité tranche. On ne modifie
   JAMAIS animation-duration en vol — Chrome recalcule la progression et l'anneau
   saute visiblement. On relance une animation, on ne retouche pas celle qui court. */
#intro.gen-pret .gen-anneau::before{animation:gen-tour 1.4s linear .9s 1}
#intro.gen-pret .gen-entrer:hover .gen-anneau::before,
#intro.gen-pret .gen-entrer:focus-visible .gen-anneau::before{animation:gen-tour-b 1.6s linear 1}
/* Onglet en arrière-plan : on ne chauffe pas le processeur pour rien. Une pause
   n'est pas une coupure — au retour, tout reprend où c'en était, sans saut. */
#intro.gen-pause .gen-court i,#intro.gen-pause .gen-halo{animation-play-state:paused}
@keyframes gen-monte{from{opacity:0;transform:translateY(9px)}}
@keyframes gen-monte-nom{from{opacity:0;transform:translateY(16px)}}
/* Les deux images-clés portent la même forme inset() SANS « round » : sans ça
   l'interpolation n'est pas définie partout. */
@keyframes gen-rideau{from{clip-path:inset(100% 0 0 0)}}

/* ── 10 · SORTIE. Ce bloc vient APRÈS le bloc d'entrée. ─────────────────────
   Il faut écrire « #intro.gen-sort, #intro.gen-sort * » : le sélecteur avec
   l'astérisque seul ne matche pas #intro lui-même, et si le spectateur clique à
   100 ms l'animation d'entrée du calque tourne encore — or une animation bat une
   transition.
   AUCUNE opacité sur .gen-plaque en sortie : les opacités de #intro et de la plaque
   se MULTIPLIENT, et une plaque disparue à 460 ms sous un voile encore à 29 %
   laisserait voir un aplat nu pendant 190 ms — un lavis gris, d'autant plus visible
   que le plateau a foncé. Un seul objet gère l'opacité : le voile.
   La comète et l'anneau passent en display:none dès la première image : leurs
   animations sont coupées de toute façon, et le sous-arbre retombe à deux couches
   avant que le calque n'anime son opacité. */
#intro.gen-sort,#intro.gen-sort *,#intro.gen-sort *::before,#intro.gen-sort *::after{animation:none!important}
#intro.gen-sort{opacity:0;transition:opacity .65s var(--gs)}
#intro.gen-sort .gen-court,#intro.gen-sort .gen-anneau{display:none}
#intro.gen-sort .gen-plaque{transform:translateY(-10px) scale(.992);
  transition:transform .46s var(--gs)}
#intro.gen-sort .gen-texte{opacity:0;transform:translateY(-14px);
  transition:opacity .42s var(--gs),transform .48s var(--gs)}
#intro.gen-sort .gen-scene{opacity:0;transform:scale(.985);
  transition:opacity .5s var(--gs),transform .52s var(--gs)}
/* L'ONDE DE CLIC. Une TRANSITION, pas une animation : .gen-sort ne coupe que les
   animations. Le souffle meurt dans la même image, le halo retombe sur sa valeur
   déclarée et part aussitôt en se détendant. C'est la seule récompense du geste,
   elle dure un demi-tour de roue et elle suffit. */
#intro.gen-sort .gen-halo{opacity:0;transform:scale(1.55);
  transition:opacity .42s var(--gs),transform .5s cubic-bezier(.16,.84,.36,1)}

/* L'aurore du rapport ne tourne pas derrière le générique : quatre orbes en
   filter:blur(96px) animés en boucle infinie, en position fixe. Un calque composite
   ne cesse pas de coûter parce qu'un opaque le recouvre. Le fondu de 1,2 s règle du
   même coup le raccord entre le générique désaturé et l'aurore du rapport. */
.aurora{transition:opacity 1.2s ease}
body.waiting .aurora{opacity:0}
body.waiting .aurora i{animation-play-state:paused}

/* ── 11 · POINTS DE RUPTURE ────────────────────────────────────────────────── */
@media (max-width:1100px){
  #intro{--gm:clamp(28px,5vw,48px)}
  .gen-plaque{width:min(680px,100% - 2 * var(--gm));border-radius:18px}
  /* En colonne, la scène passe AU-DESSUS du texte : la carte gagne d'un coup la
     hauteur de l'image. Le rembourrage doit rendre ce qu'il peut, sinon le carton
     déborde de la fenêtre et se met à défiler — mesuré à 17 px près sur un 820x900. */
  .gen-grille{grid-template-columns:minmax(0,1fr);row-gap:28px;padding-inline:32px;
    padding-block:clamp(30px,4.2vh,54px)}
  .gen-court.h1{left:12px;right:12px}
  .gen-court.v1{top:12px;bottom:12px}
  /* Le périmètre parcouru est plus court : à 9 s la vitesse paraîtrait anormale. */
  #intro.gen-pret .gen-court.h1 i{animation-duration:7s}
  #intro.gen-pret .gen-court.v1 i{animation-duration:7s}
  /* On plafonne par la LARGEUR, jamais par max-height : une hauteur maximale sur une
     boîte qui garde sa largeur de piste rognerait le 16/9 et mangerait l'ombre au sol
     du socle et le haut des personnages. */
  .gen-scene{grid-column:1;grid-row:1;margin-top:0;justify-self:start;
    width:min(100%,calc(38vh * 4 / 3))}
  .gen-texte{grid-column:1;grid-row:2}
  .gen-nom{margin-top:22px}
}
@media (max-width:700px){
  #intro{--gm:24px}
  .gen-plaque{border-radius:14px}
  .gen-grille{padding-inline:20px;padding-block:30px;row-gap:26px}
  /* Le flanc droit n'a plus de sens quand la scène est au-dessus du texte. */
  .gen-court.v1{display:none}
  /* La scène ne déborde plus : elle est DEDANS, c'est une carte. */
  .gen-scene{width:100%;margin-inline:0}
  .gen-scene::before{opacity:.7}
  .gen-logo{height:38px;margin-bottom:22px}
  .gen-marque{font-size:12px;letter-spacing:.16em}
  .gen-sous{font-size:16px;margin-top:18px}
  .gen-action{margin-top:28px;width:100%}
  .gen-entrer{width:100%;max-width:320px;height:54px;font-size:16px;padding:0 24px}
  .gen-halo{inset:-12px -16px -14px}
}
/* Sur un 1366x768 avec la barre Teams et la barre de tâches, il reste 620 à 650 px
   de hauteur utile : le générique doit se resserrer avant d'être coupé. */
@media (max-height:820px){
  .gen-grille{padding-block:clamp(26px,3.6vh,44px)}
  .gen-nom{margin-top:20px}
  .gen-sous{margin-top:16px}
  .gen-action{margin-top:26px}
  .gen-aide{margin-top:12px}
}
/* En dernier : sur un écran très court, ce bloc doit gagner sur les précédents. */
@media (max-height:640px){
  .gen-grille{padding-block:26px;row-gap:24px}
  .gen-nom{margin-top:18px}
  .gen-sous{margin-top:16px}
  .gen-action{margin-top:24px}
  .gen-scene{width:min(100%,calc(32vh * 4 / 3));margin-inline:0;margin-top:0}
}

/* ── 12 · MOUVEMENT RÉDUIT ──────────────────────────────────────────────────
   Le rapport pose déjà « animation:none » et « transition:none » partout. Ce qui
   reste ici est une AFFICHE complète, pas un squelette : l'arête entière, les cinq
   ombres de la plaque, le halo cyan derrière le nom, le filet allumé à sa pleine
   longueur (l'état déclaré EST l'état final), le bouton avec son anneau figé à
   227deg — éclat blanc en haut à gauche, même direction que la plaque — et sa lueur
   au milieu de son oscillation.
   La comète disparaît : deux bandes figées au départ de leur course seraient deux
   taches sans raison. On rembourse en INTENSITÉ, l'arête gagne environ 30 %. */
@media (prefers-reduced-motion:reduce){
  #intro .gen-video{display:none}
  #intro .gen-court{display:none}
  #intro .gen-plaque{
    background-image:
      radial-gradient(122% 128% at 8% 0%,rgba(255,255,255,.96) 0%,rgba(255,255,255,0) 56%),
      radial-gradient(78% 68% at 79% 100%,rgba(0,168,204,.09) 0%,rgba(0,168,204,0) 70%),
      linear-gradient(178deg,#f6f8fb 0%,#f1f4f8 58%,#eef0f3 100%),
      linear-gradient(126deg,
        #ffffff 0%,
        rgba(224,246,255,1) 10%,
        rgba(0,180,216,.90) 24%,
        rgba(0,119,182,.58) 44%,
        rgba(0,119,182,.32) 64%,
        rgba(3,4,94,.16) 84%,
        rgba(3,4,94,.10) 100%)}
}

/* ── 13 · REPLI SANS mask-image ─────────────────────────────────────────────
   Sans masques, le halo et les deux boîtes de scène apparaîtraient en rectangles
   pleins : ce serait la catastrophe, pas la dégradation. On coupe net et on assume
   l'inverse de la direction — la vidéo redevient une image cadrée, proprement, dans
   la plaque. La plaque, l'arête, la comète et le bouton ne dépendent d'aucun
   masque : le générique reste complet. */
@supports not ((-webkit-mask-image:linear-gradient(#000,#000)) or (mask-image:linear-gradient(#000,#000))){
  .gen-scene::before{display:none}
  .gen-scene{border-radius:14px;overflow:hidden;
    box-shadow:0 24px 60px -30px rgba(9,23,43,.32)}
}

/* Tant que le générique joue, la chorégraphie attend son tour. */
body.waiting .rise,body.waiting .accent,body.waiting .arc,body.waiting .bar .col,
body.waiting .pb i,body.waiting .badge,body.waiting .scen>div,body.waiting .lg-row,
body.waiting .arrow svg,body.waiting .gauge .span,body.waiting .gauge .end{animation-play-state:paused}

/* ══════════ Révélation au défilement ══════════
   Deux variantes : une carte qui s'incline pilote sa propre transform, donc la
   révélation ne doit PAS animer transform sur ces cartes (l'état final d'une
   animation forwards gagnerait sur l'inclinaison).
   .reveal = glisse + fond (sans inclinaison) · .reveal-f = fond seul (avec [data-tilt]) */
.reveal{opacity:0;transform:translateY(26px);transition:opacity .8s var(--e),transform .8s var(--e)}
.reveal.in{opacity:1;transform:none}
.reveal-f{opacity:0;transition:opacity .9s var(--e)}
.reveal-f.in{opacity:1}
.fade{opacity:0;animation:fin .85s var(--e) forwards}
.reveal .arc,.reveal .bar .col,.reveal .pb i,.reveal .lg-row,
.reveal-f .arc,.reveal-f .bar .col,.reveal-f .pb i,.reveal-f .lg-row{animation-play-state:paused}
.reveal.in .arc,.reveal.in .bar .col,.reveal.in .pb i,.reveal.in .lg-row,
.reveal-f.in .arc,.reveal-f.in .bar .col,.reveal-f.in .pb i,.reveal-f.in .lg-row{animation-play-state:running}

/* Bouton « rejouer » */
.replay{position:fixed;right:18px;bottom:18px;z-index:50;display:inline-flex;align-items:center;gap:8px;
  padding:11px 17px;border-radius:999px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;color:#03045e;
  background:linear-gradient(140deg,rgba(255,255,255,.85),rgba(255,255,255,.6));
  -webkit-backdrop-filter:blur(14px) saturate(180%); backdrop-filter:blur(14px) saturate(180%);
  border:1px solid rgba(255,255,255,.9);box-shadow:0 12px 30px -12px rgba(3,4,94,.4);
  opacity:0;animation:fin .6s 3.4s forwards;transition:transform .25s var(--e),box-shadow .25s}
.replay:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 18px 38px -14px rgba(3,4,94,.5)}

/* ══════════ Scroll-film : progression, rail de chapitres, cartons ══════════
   Le rail n'est pas un décor : il dit où l'on est dans le document et permet d'y
   sauter. Il s'efface sous 1180 px (il volerait de la place au contenu) et à
   l'impression. La barre du haut, elle, reste utile partout. */
.prog{position:fixed;top:0;left:0;right:0;height:3px;z-index:40;pointer-events:none;background:rgba(3,4,94,.06)}
.prog i{display:block;height:100%;width:0;
  background:linear-gradient(90deg,#0891b2,#34d399 62%,#c5a365);
  box-shadow:0 0 12px rgba(8,145,178,.55)}

.rail{position:fixed;right:20px;top:50%;transform:translateY(-50%);z-index:40;
  display:flex;flex-direction:column;gap:20px;align-items:flex-end}
.rail-line{position:absolute;right:5px;top:5px;bottom:5px;width:2px;border-radius:2px;
  background:rgba(3,4,94,.11);overflow:hidden}
.rail-line i{position:absolute;left:0;top:0;width:100%;height:0;
  background:linear-gradient(180deg,#0891b2,#34d399)}
.rail-dot{position:relative;display:flex;align-items:center;gap:10px;
  background:none;border:0;padding:0;cursor:pointer;font-family:inherit}
.rail-dot>i{width:12px;height:12px;border-radius:50%;flex:none;
  background:rgba(255,255,255,.9);border:2px solid rgba(3,4,94,.24);
  transition:transform .3s var(--e),border-color .3s,background .3s,box-shadow .3s}
.rail-dot:hover>i{border-color:#0891b2;transform:scale(1.15)}
.rail-dot.is-on>i{border-color:#0891b2;background:#0891b2;transform:scale(1.22);
  box-shadow:0 0 0 5px rgba(8,145,178,.16)}
.rail-lbl{font-size:11.5px;font-weight:600;color:#334155;white-space:nowrap;
  padding:4px 10px;border-radius:10px;
  background:rgba(255,255,255,.88);border:1px solid rgba(255,255,255,.95);
  box-shadow:0 4px 12px -6px rgba(3,4,94,.28);
  opacity:0;transform:translateX(8px);
  transition:opacity .3s var(--e),transform .3s var(--e)}
.rail-dot:hover .rail-lbl,.rail-dot:focus-visible .rail-lbl,.rail-dot.is-on .rail-lbl{opacity:1;transform:none}
@media (max-width:1180px){.rail{display:none}}

/* Carton de chapitre : un titre qui passe, comme au cinéma. */
.chap-toast{position:fixed;left:50%;bottom:26px;z-index:41;pointer-events:none;
  opacity:0;transform:translate(-50%,14px);
  transition:opacity .4s var(--e),transform .4s var(--e)}
.chap-toast b{display:block;font-family:'Montserrat';font-weight:800;font-size:11.5px;
  letter-spacing:.16em;text-transform:uppercase;color:var(--navy);
  padding:9px 20px;border-radius:14px;
  background:rgba(255,255,255,.82);
  -webkit-backdrop-filter:blur(14px) saturate(180%); backdrop-filter:blur(14px) saturate(180%);
  border:1px solid rgba(255,255,255,.9);box-shadow:0 14px 34px -16px rgba(3,4,94,.42)}
.chap-toast.on{opacity:1;transform:translate(-50%,0)}
/* Sous 700 px le carton irait cogner le bouton « rejouer ». */
@media (max-width:700px){.chap-toast{display:none}}

/* Parallaxe : on décale le CALQUE d'aurore, jamais chaque orbe — les orbes ont
   déjà leur propre animation de transform et les deux se battraient. */
.aurora{transform:translate3d(0,var(--par,0px),0)}

/* Animations communes */
.rise{opacity:0;transform:translateY(16px);animation:up .75s var(--e) forwards}
@keyframes up{to{opacity:1;transform:none}}
@keyframes fin{to{opacity:1}}
`.trim();
