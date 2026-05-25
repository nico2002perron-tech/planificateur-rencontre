<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>

<div align="center">

<h1>Planificateur de Rencontre</h1>
<p><strong>Plateforme interne de gestion de portefeuilles, clients et rapports financiers</strong></p>

<p>
<img src="https://img.shields.io/badge/Next.js-16.1-black?logo=nextdotjs" alt="Next.js 16">
<img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react" alt="React 19">
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript 5">
<img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind 4">
<img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase" alt="Supabase">
<img src="https://img.shields.io/badge/NextAuth-v4-9333EA" alt="NextAuth v4">
</p>

</div>

<hr>

<h2>Table des matieres</h2>
<ul>
<li><a href="#apercu">Apercu</a></li>
<li><a href="#stack-technique">Stack technique</a></li>
<li><a href="#architecture">Architecture du projet</a></li>
<li><a href="#pages">Pages (45)</a></li>
<li><a href="#api">Routes API (107)</a></li>
<li><a href="#composants">Composants</a></li>
<li><a href="#analytics">Moteur analytique</a></li>
<li><a href="#pdf">Systeme de rapports PDF</a></li>
<li><a href="#ia">Intelligence artificielle</a></li>
<li><a href="#valuation">Valorisation</a></li>
<li><a href="#donnees">Sources de donnees</a></li>
<li><a href="#base-de-donnees">Base de donnees</a></li>
<li><a href="#installation">Installation</a></li>
<li><a href="#variables-env">Variables d'environnement</a></li>
<li><a href="#scripts">Scripts</a></li>
</ul>

<hr>

<h2 id="apercu">Apercu</h2>
<p>
Application web interne destinee aux conseillers financiers du <strong>Groupe Financier Ste-Foy</strong>.
Elle centralise la gestion de clients, portefeuilles, modeles d'investissement, rapports PDF avances,
notes de rencontres, prospection, evenements et analyse de marche au sein d'un tableau de bord unifie.
</p>

<h3>Design</h3>
<table>
<tr>
<td><strong>Typographie</strong></td>
<td>Montserrat (titres) + Open Sans (corps)</td>
</tr>
<tr>
<td><strong>Couleur primaire</strong></td>
<td><code>#00b4d8</code></td>
</tr>
<tr>
<td><strong>Couleur sombre</strong></td>
<td><code>#03045e</code></td>
</tr>
</table>

<hr>

<h2 id="stack-technique">Stack technique</h2>
<table>
<thead>
<tr><th>Categorie</th><th>Technologies</th></tr>
</thead>
<tbody>
<tr><td>Framework</td><td>Next.js 16.1 (App Router)</td></tr>
<tr><td>UI</td><td>React 19, Tailwind CSS 4, Lucide React, Recharts 3</td></tr>
<tr><td>Auth</td><td>NextAuth v4 (credentials provider, JWT, middleware)</td></tr>
<tr><td>Base de donnees</td><td>Supabase PostgreSQL (13+ tables)</td></tr>
<tr><td>PDF</td><td>@react-pdf/renderer (rapport 18+ pages), pdf-lib</td></tr>
<tr><td>IA</td><td>Groq SDK (LLaMA 3.3 70B), Gemini</td></tr>
<tr><td>Donnees marche</td><td>EODHD (fondamentaux + recherche), Yahoo Finance (prix/historique), TradingView (widgets)</td></tr>
<tr><td>Email</td><td>Resend</td></tr>
<tr><td>Validation</td><td>Zod</td></tr>
<tr><td>Fetching</td><td>SWR</td></tr>
<tr><td>Parsers</td><td>xlsx (Excel), Croesus, smart-parser</td></tr>
<tr><td>Utilitaires</td><td>clsx, tailwind-merge, bcryptjs</td></tr>
</tbody>
</table>

<hr>

<h2 id="architecture">Architecture du projet</h2>
<pre>
planificateur-rencontre/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Pages login, change-password
│   │   ├── (dashboard)/         # 43 pages protegees
│   │   │   ├── admin/           # Settings, team, users
│   │   │   ├── clients/         # CRUD clients
│   │   │   ├── events/          # Evenements
│   │   │   ├── fund-reports/    # Rapports de fonds
│   │   │   ├── markets/         # Vue marche (TradingView)
│   │   │   ├── meeting-notes/   # Notes de rencontres
│   │   │   ├── models/          # 13 sous-pages (backtest, scoring, simulation...)
│   │   │   ├── portfolios/      # Portefeuilles + comparaison + simulation
│   │   │   ├── profile/         # Profil utilisateur
│   │   │   ├── prospection/     # CRM prospection + stats
│   │   │   ├── reports/         # Rapports PDF
│   │   │   ├── strategies/      # Strategies d'investissement
│   │   │   └── valuation/       # Valorisation d'actions
│   │   ├── api/                 # 107 routes API
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── auth/                # LoginForm, RegisterForm, SessionProvider
│   │   ├── dashboard/           # 12 widgets (briefing, fear-greed, heatmap...)
│   │   ├── layout/              # Header, Sidebar, Breadcrumbs, PageHeader
│   │   ├── meeting-notes/       # AudioWaveform
│   │   ├── models/              # Simulation components, StepNav
│   │   ├── performance/         # Charts (allocation, drawdown, performance)
│   │   ├── portfolios/          # SymbolSearch, NewsBadge, NewsModal
│   │   ├── prospection/         # CallModal, ImportModal, LeadCard, LeadDetailModal
│   │   ├── reports/             # PretAColler, ProspectReport
│   │   ├── strategies/          # ImportModal, PortfolioAnalysis, PortfolioBuilder
│   │   ├── tradingview/         # 10 widgets TradingView
│   │   └── ui/                  # 15 composants generiques (Button, Card, Modal, Table...)
│   ├── features/
│   │   ├── auth/                # Config + types NextAuth
│   │   └── benchmarks/          # Constantes benchmarks
│   └── lib/
│       ├── ai/                  # Groq/Gemini clients, prompts V1 + V2, cache
│       ├── analytics/           # 13 fichiers (pipeline, risk, monte-carlo, correlation...)
│       ├── hooks/               # 13 hooks SWR (useClients, usePortfolio, useQuotes...)
│       ├── models/              # Backtester, portfolio-generator, stock-scorer
│       ├── parsers/             # Croesus, bonds-excel, smart-parser
│       ├── pdf/                 # Rapport V2 (19 pages, 9 charts SVG, styles)
│       ├── portfolio/           # Statistiques de portefeuille
│       ├── prospection/         # Scraper + types
│       ├── providers/           # Fund document fetcher + registry
│       ├── supabase/            # Client, server, admin
│       ├── utils/               # cn, format, constants
│       ├── valuation/           # DCF, scoring, safety-score, fixed-income, benchmarks
│       └── yahoo/               # Client Yahoo Finance + types
├── supabase/
│   ├── schema.sql               # Schema complet (28k+ lignes)
│   ├── models-only.sql
│   ├── migration_teams.sql
│   └── setup-complete.sql
├── middleware.ts                 # Protection des routes (NextAuth)
├── scripts/
├── public/
├── package.json
├── tsconfig.json
├── next.config.ts
├── vercel.json
└── postcss.config.mjs
</pre>

<p><strong>342 fichiers source</strong> au total dans <code>src/</code>.</p>

<hr>

<h2 id="pages">Pages (45)</h2>

<h3>Authentification</h3>
<table>
<thead><tr><th>Route</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>/login</code></td><td>Connexion (credentials)</td></tr>
<tr><td><code>/change-password</code></td><td>Changement de mot de passe</td></tr>
</tbody>
</table>

<h3>Tableau de bord</h3>
<table>
<thead><tr><th>Route</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>/</code></td><td>Dashboard principal (briefing, marches, news, fear-greed, yield curve, heatmap)</td></tr>
<tr><td><code>/profile</code></td><td>Profil utilisateur</td></tr>
</tbody>
</table>

<h3>Administration</h3>
<table>
<thead><tr><th>Route</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>/admin</code></td><td>Panel admin</td></tr>
<tr><td><code>/admin/settings</code></td><td>Parametres</td></tr>
<tr><td><code>/admin/team</code></td><td>Gestion de l'equipe</td></tr>
<tr><td><code>/admin/users</code></td><td>Gestion des utilisateurs</td></tr>
</tbody>
</table>

<h3>Clients</h3>
<table>
<thead><tr><th>Route</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>/clients</code></td><td>Liste des clients</td></tr>
<tr><td><code>/clients/new</code></td><td>Nouveau client</td></tr>
<tr><td><code>/clients/[id]</code></td><td>Detail client</td></tr>
<tr><td><code>/clients/[id]/edit</code></td><td>Modifier client</td></tr>
</tbody>
</table>

<h3>Portefeuilles</h3>
<table>
<thead><tr><th>Route</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>/portfolios</code></td><td>Liste des portefeuilles</td></tr>
<tr><td><code>/portfolios/new</code></td><td>Nouveau portefeuille</td></tr>
<tr><td><code>/portfolios/[id]</code></td><td>Detail portefeuille</td></tr>
<tr><td><code>/portfolios/[id]/compare</code></td><td>Comparaison</td></tr>
<tr><td><code>/portfolios/[id]/simulation</code></td><td>Simulation</td></tr>
</tbody>
</table>

<h3>Modeles d'investissement</h3>
<table>
<thead><tr><th>Route</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>/models</code></td><td>Liste des modeles</td></tr>
<tr><td><code>/models/new</code></td><td>Nouveau modele</td></tr>
<tr><td><code>/models/[id]</code></td><td>Detail modele</td></tr>
<tr><td><code>/models/[id]/apply</code></td><td>Appliquer a un client</td></tr>
<tr><td><code>/models/[id]/simulation</code></td><td>Simulation modele</td></tr>
<tr><td><code>/models/backtest</code></td><td>Backtesting</td></tr>
<tr><td><code>/models/compare</code></td><td>Comparaison de modeles</td></tr>
<tr><td><code>/models/email</code></td><td>Envoi par email</td></tr>
<tr><td><code>/models/generate</code></td><td>Generation automatique (IA)</td></tr>
<tr><td><code>/models/profiles</code></td><td>Profils d'investisseur</td></tr>
<tr><td><code>/models/rebalance</code></td><td>Reequilibrage</td></tr>
<tr><td><code>/models/scoring</code></td><td>Scoring de titres</td></tr>
<tr><td><code>/models/simulation</code></td><td>Simulation globale</td></tr>
<tr><td><code>/models/transition</code></td><td>Plan de transition</td></tr>
<tr><td><code>/models/universe</code></td><td>Univers d'investissement</td></tr>
</tbody>
</table>

<h3>Autres sections</h3>
<table>
<thead><tr><th>Route</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>/reports</code></td><td>Liste des rapports PDF</td></tr>
<tr><td><code>/reports/new</code></td><td>Generer un rapport</td></tr>
<tr><td><code>/meeting-notes</code></td><td>Notes de rencontres</td></tr>
<tr><td><code>/meeting-notes/new</code></td><td>Nouvelle note (transcription audio)</td></tr>
<tr><td><code>/meeting-notes/[id]</code></td><td>Detail d'une note</td></tr>
<tr><td><code>/markets</code></td><td>Vue marche (TradingView)</td></tr>
<tr><td><code>/valuation</code></td><td>Valorisation d'actions (DCF, P/E, P/S)</td></tr>
<tr><td><code>/strategies</code></td><td>Strategies d'investissement</td></tr>
<tr><td><code>/events</code></td><td>Evenements</td></tr>
<tr><td><code>/fund-reports</code></td><td>Rapports de fonds</td></tr>
<tr><td><code>/prospection</code></td><td>CRM de prospection</td></tr>
<tr><td><code>/prospection/search</code></td><td>Recherche de prospects</td></tr>
<tr><td><code>/prospection/stats</code></td><td>Statistiques prospection</td></tr>
</tbody>
</table>

<hr>

<h2 id="api">Routes API (107)</h2>
<p>Organisees par domaine :</p>

<table>
<thead><tr><th>Domaine</th><th>Endpoints</th><th>Description</th></tr></thead>
<tbody>
<tr><td><strong>admin</strong></td><td>team-logos, team-profiles (CRUD + photo), users (CRUD + reset-password + available-profiles)</td><td>Gestion equipe et utilisateurs</td></tr>
<tr><td><strong>ai</strong></td><td>classify-holdings, extract-maturities, meeting-summary, parse-portfolio, transcribe</td><td>5 endpoints IA (Groq/Gemini)</td></tr>
<tr><td><strong>auth</strong></td><td>[...nextauth], register, change-password, check-status</td><td>Authentification NextAuth</td></tr>
<tr><td><strong>clients</strong></td><td>CRUD + [id]</td><td>Gestion clients</td></tr>
<tr><td><strong>cron</strong></td><td>refresh-prices, refresh-yields, refresh-fund-docs</td><td>Taches planifiees (Vercel cron)</td></tr>
<tr><td><strong>dashboard</strong></td><td>briefing, economic-calendar, fear-greed, news</td><td>Widgets tableau de bord</td></tr>
<tr><td><strong>events</strong></td><td>CRUD, images, teams (manage/[token], [code]), [id] (register, registrations)</td><td>Evenements + inscriptions</td></tr>
<tr><td><strong>fmp</strong></td><td>search, quote, profile, historical, price-target, price-target-consensus, sector-performance</td><td>Donnees de marche (via EODHD/Yahoo)</td></tr>
<tr><td><strong>fund-reports</strong></td><td>CRUD, auto-fetch, check, [id]/download</td><td>Documents de fonds</td></tr>
<tr><td><strong>models</strong></td><td>CRUD, backtest, bonds (import), email, etf-sectors, generate, profiles, scoring, score-universe, stock-sector, universe (import), [id] (apply, simulation, simulation/export)</td><td>Modeles d'investissement complets</td></tr>
<tr><td><strong>portfolio</strong></td><td>analyze, pdf</td><td>Analyse + generation PDF</td></tr>
<tr><td><strong>portfolios</strong></td><td>CRUD</td><td>Gestion portefeuilles</td></tr>
<tr><td><strong>meeting-notes</strong></td><td>CRUD + [id]</td><td>Notes de rencontres</td></tr>
<tr><td><strong>autres</strong></td><td>exchange-rate, exports/price-targets, logos, news, portfolio-history</td><td>Utilitaires divers</td></tr>
</tbody>
</table>

<hr>

<h2 id="composants">Composants</h2>

<h3>UI generique (15)</h3>
<p>
<code>Badge</code> <code>Button</code> <code>Card</code> <code>CurrencyToggle</code> <code>DataTable</code>
<code>Input</code> <code>Modal</code> <code>SearchInput</code> <code>Select</code> <code>Skeleton</code>
<code>Spinner</code> <code>Table</code> <code>Tabs</code> <code>Toast</code>
</p>

<h3>Dashboard (12 widgets)</h3>
<p>
<code>GreetingHeader</code> <code>MorningBriefing</code> <code>MarketQuickStats</code> <code>NewsTicker</code>
<code>NewsRadar</code> <code>FearGreedGauge</code> <code>YieldCurveWidget</code> <code>SectorHeatmap</code>
<code>EconomicCalendar</code> <code>RateIntelligence</code>
</p>

<h3>TradingView (10 widgets)</h3>
<p>
<code>AdvancedChart</code> <code>CompanyProfile</code> <code>EconomicCalendar</code> <code>FundamentalData</code>
<code>MiniChart</code> <code>StockScreener</code> <code>SymbolInfo</code> <code>TechnicalAnalysis</code>
<code>TickerTape</code> <code>TradingViewWidget</code>
</p>

<h3>Layout</h3>
<p><code>Header</code> <code>Sidebar</code> <code>Breadcrumbs</code> <code>PageHeader</code></p>

<h3>Hooks SWR (13)</h3>
<p>
<code>useClients</code> <code>useEvents</code> <code>useFundReports</code> <code>useLogos</code>
<code>useMeetingNotes</code> <code>useModels</code> <code>useNews</code> <code>usePerformance</code>
<code>usePortfolio</code> <code>usePriceTargets</code> <code>useQuotes</code> <code>useReports</code>
<code>useSimulation</code> <code>useStockScores</code> <code>useStockUniverse</code> <code>useYieldCurve</code>
</p>

<hr>

<h2 id="analytics">Moteur analytique</h2>
<p>
Pipeline unifie dans <code>src/lib/analytics/</code> — 13 fichiers.
</p>

<pre>
computePortfolioAnalysis(RawPortfolioInput) → PortfolioAnalysisResult
  Stage 1: Data preparation
  Stage 2: Parallel engines (risk, monte-carlo, correlation, DNA, stress, behavioral, bonds)
  Stage 3: Dependent analytics (portfolio-intelligence)
  Stage 4: Derived metrics
</pre>

<table>
<thead><tr><th>Module</th><th>Fonctionnalite</th></tr></thead>
<tbody>
<tr><td><code>pipeline.ts</code></td><td>Orchestrateur 4 etapes</td></tr>
<tr><td><code>types.ts</code></td><td>Interfaces (~350 lignes)</td></tr>
<tr><td><code>schemas.ts</code></td><td>Validation Zod aux frontieres</td></tr>
<tr><td><code>derived-metrics.ts</code></td><td>Transformations pures</td></tr>
<tr><td><code>risk-metrics.ts</code></td><td>Sharpe, Sortino, VaR, max drawdown</td></tr>
<tr><td><code>monte-carlo.ts</code></td><td>Simulations Monte Carlo</td></tr>
<tr><td><code>correlation.ts</code></td><td>Matrice de correlation</td></tr>
<tr><td><code>portfolio-dna.ts</code></td><td>ADN du portefeuille (style, facteurs)</td></tr>
<tr><td><code>stress-radar.ts</code></td><td>Scenarios de stress</td></tr>
<tr><td><code>behavioral.ts</code></td><td>Analyse comportementale</td></tr>
<tr><td><code>bond-analytics.ts</code></td><td>Analyse obligataire (duration, YTM)</td></tr>
<tr><td><code>portfolio-intelligence.ts</code></td><td>Recommandations intelligentes</td></tr>
</tbody>
</table>

<hr>

<h2 id="pdf">Systeme de rapports PDF (V2)</h2>
<p>
Orchestrateur : <code>src/lib/pdf/report-v2.tsx</code> — rapport modulaire de <strong>18+ pages</strong>.
</p>

<h3>Pages du rapport (19)</h3>
<table>
<thead><tr><th>#</th><th>Page</th><th>Contenu</th></tr></thead>
<tbody>
<tr><td>1</td><td>Cover</td><td>Page de couverture personnalisee</td></tr>
<tr><td>2</td><td>Table of Contents</td><td>Table des matieres auto-generee</td></tr>
<tr><td>3</td><td>Executive Summary</td><td>Resume executif</td></tr>
<tr><td>4</td><td>Portfolio DNA</td><td>ADN du portefeuille (radar chart)</td></tr>
<tr><td>5</td><td>Allocation</td><td>Repartition d'actifs</td></tr>
<tr><td>6</td><td>Projection</td><td>Projections (cone chart Monte Carlo)</td></tr>
<tr><td>7</td><td>Fundamentals</td><td>Analyse fondamentale</td></tr>
<tr><td>8</td><td>Valuation</td><td>Valorisation (DCF, multiples)</td></tr>
<tr><td>9</td><td>Income</td><td>Revenus et dividendes</td></tr>
<tr><td>10</td><td>Bonds</td><td>Analyse obligataire</td></tr>
<tr><td>11</td><td>Risk</td><td>Metriques de risque</td></tr>
<tr><td>12</td><td>Stress Radar</td><td>Scenarios de stress</td></tr>
<tr><td>13</td><td>Correlation</td><td>Matrice de correlation (heatmap)</td></tr>
<tr><td>14</td><td>Behavioral</td><td>Biais comportementaux</td></tr>
<tr><td>15</td><td>Market Intel</td><td>Intelligence de marche</td></tr>
<tr><td>16</td><td>Recommendations</td><td>Recommandations</td></tr>
<tr><td>17</td><td>Comparisons</td><td>Comparaison de periodes</td></tr>
<tr><td>18</td><td>Asset Sheets</td><td>Fiches par titre</td></tr>
<tr><td>19</td><td>Shared</td><td>Composants partages (header, footer)</td></tr>
</tbody>
</table>

<h3>Charts SVG (9)</h3>
<p>
<code>RadarChart</code> <code>Heatmap</code> <code>GaugeChart</code> <code>DrawdownChart</code>
<code>ScatterPlot</code> <code>ConeProjection</code> <code>WaterfallChart</code> <code>StackedBar</code>
<code>SvgText</code>
</p>

<h3>Autres templates PDF</h3>
<p>
<code>report-template.tsx</code> (V1),
<code>simulation-template.tsx</code>,
<code>strategy-template.tsx</code>,
<code>transition-template.tsx</code>,
<code>price-targets-template.tsx</code>
</p>

<hr>

<h2 id="ia">Intelligence artificielle</h2>
<table>
<thead><tr><th>Fichier</th><th>Role</th></tr></thead>
<tbody>
<tr><td><code>groq-client.ts</code></td><td>Client Groq V1</td></tr>
<tr><td><code>groq-client-v2.ts</code></td><td>Client Groq V2 — LLaMA 3.3 70B Versatile, 15 blocs narratifs</td></tr>
<tr><td><code>gemini-client.ts</code></td><td>Client Google Gemini</td></tr>
<tr><td><code>prompts.ts</code> / <code>prompts-v2.ts</code></td><td>Prompts V1 + V2 pour rapports</td></tr>
<tr><td><code>types.ts</code> / <code>types-v2.ts</code></td><td>Types IA V1 + V2</td></tr>
<tr><td><code>cache.ts</code></td><td>Cache Supabase 24h (<code>ai_content_cache</code>)</td></tr>
</tbody>
</table>

<h3>Endpoints IA</h3>
<ul>
<li><strong>parse-portfolio</strong> — Extraction de portefeuille depuis texte/fichier</li>
<li><strong>classify-holdings</strong> — Classification automatique des titres</li>
<li><strong>extract-maturities</strong> — Extraction de maturites obligataires</li>
<li><strong>meeting-summary</strong> — Resume de notes de rencontre</li>
<li><strong>transcribe</strong> — Transcription audio</li>
</ul>

<hr>

<h2 id="valuation">Valorisation</h2>
<p>Module dans <code>src/lib/valuation/</code> :</p>
<ul>
<li><strong>DCF</strong> — Discounted Cash Flow + reverse DCF + matrice de sensibilite</li>
<li><strong>Multiples</strong> — P/E et P/S relatifs</li>
<li><strong>Scoring</strong> — Score composite de valorisation</li>
<li><strong>Safety Score</strong> — Score de securite du dividende</li>
<li><strong>Fixed Income</strong> — Analyse obligataire (YTM, duration, convexite)</li>
<li><strong>Benchmarks</strong> — Comparaison sectorielle</li>
</ul>

<hr>

<h2 id="donnees">Sources de donnees</h2>
<table>
<thead><tr><th>Source</th><th>Usage</th></tr></thead>
<tbody>
<tr><td><strong>EODHD</strong></td><td>Recherche de symboles, donnees fondamentales, profils d'entreprise, price targets</td></tr>
<tr><td><strong>Yahoo Finance</strong></td><td>Prix en temps reel, historique de prix, quotes</td></tr>
<tr><td><strong>TradingView</strong></td><td>Widgets integres (charts, screener, analyse technique)</td></tr>
<tr><td><strong>Supabase price_cache</strong></td><td>Cache de prix pour performance</td></tr>
</tbody>
</table>

<hr>

<h2 id="base-de-donnees">Base de donnees</h2>
<p>
Supabase PostgreSQL — schema complet dans <code>supabase/schema.sql</code>.
</p>
<p>Tables principales :</p>
<ul>
<li><code>users</code>, <code>team_profiles</code> — Utilisateurs et equipe</li>
<li><code>clients</code>, <code>portfolios</code>, <code>holdings</code> — Clients et portefeuilles</li>
<li><code>models</code>, <code>model_holdings</code>, <code>investor_profiles</code> — Modeles d'investissement</li>
<li><code>meeting_notes</code> — Notes de rencontres</li>
<li><code>events</code>, <code>event_registrations</code> — Evenements</li>
<li><code>reports</code> — Rapports generes</li>
<li><code>price_cache</code> — Cache de prix</li>
<li><code>ai_content_cache</code> — Cache IA (24h TTL)</li>
<li><code>fund_reports</code> — Documents de fonds</li>
<li><code>prospects</code>, <code>prospect_interactions</code> — CRM prospection</li>
</ul>

<hr>

<h2 id="installation">Installation</h2>

<pre>
# Cloner le projet
git clone &lt;repo-url&gt;
cd planificateur-rencontre

# Installer les dependances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Remplir les cles (voir section ci-dessous)

# Lancer en developpement
npm run dev
</pre>

<p>Ouvrir <a href="http://localhost:3000">http://localhost:3000</a>.</p>

<hr>

<h2 id="variables-env">Variables d'environnement</h2>
<pre>
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# Donnees de marche
EODHD_API_KEY=

# IA
GROQ_API_KEY=

# Email
RESEND_API_KEY=

# Cron
CRON_SECRET=
</pre>

<hr>

<h2 id="scripts">Scripts</h2>
<table>
<thead><tr><th>Commande</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>npm run dev</code></td><td>Serveur de developpement (Next.js)</td></tr>
<tr><td><code>npm run build</code></td><td>Build de production</td></tr>
<tr><td><code>npm run start</code></td><td>Serveur de production</td></tr>
<tr><td><code>npm run lint</code></td><td>Linting ESLint</td></tr>
</tbody>
</table>

<hr>

<div align="center">
<p><sub>Planificateur de Rencontre &mdash; Groupe Financier Ste-Foy &mdash; 2025</sub></p>
</div>

</body>
</html>
