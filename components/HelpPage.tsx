import React from 'react';

interface HelpPageProps {
  onBack: () => void;
}

const SECTIONS = [
  { id: 'ecrire', label: '1 · Écrire une chanson' },
  { id: 'transposer', label: '2 · Transposition et degrés' },
  { id: 'setlists', label: '3 · Setlists' },
  { id: 'scene', label: '4 · Mode scène et défilement' },
  { id: 'groupes', label: '5 · Groupes' }
];

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="font-mono bg-[#E6E8E2] dark:bg-slate-800 px-1 rounded">{children}</code>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>{children}</span>
);

const Seg: React.FC<{ c: string; l: string }> = ({ c, l }) => (
  <span className="inline-flex flex-col">
    <b className="font-mono font-bold text-cyan-600 dark:text-cyan-400 pr-2">{c}</b>
    <span className="whitespace-pre">{l}</span>
  </span>
);

const HelpPage: React.FC<HelpPageProps> = () => {
  const [active, setActive] = React.useState('ecrire');

  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-wrap gap-12 items-start text-ink dark:text-slate-100">
      <nav aria-label="Sommaire" className="flex-[1_1_200px] flex flex-col gap-0.5 md:sticky md:top-6">
        <p className="m-0 mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>Sommaire</p>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(s.id)}
            className={`text-left py-1.5 ${active === s.id ? 'font-semibold text-ink dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100'}`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <article className="flex-[999_1_560px] min-w-0 flex flex-col gap-11">
        <header>
          <h1 className="m-0 font-display font-extrabold text-4xl" style={{ letterSpacing: '-0.025em' }}>Aide</h1>
          <p className="mt-1.5 mb-0 text-slate-600 dark:text-slate-400">Tout ce qu'il faut pour écrire, transposer et jouer avec Unison.</p>
        </header>

        <section id="ecrire" className="flex flex-col gap-3.5 scroll-mt-6">
          <h2 className="m-0 font-display font-bold text-[28px]">1 · Écrire une chanson</h2>
          <p className="m-0 text-slate-600 dark:text-slate-400 max-w-[40em]">
            Les accords s'écrivent entre crochets, soit dans le texte (<Code>[G]Au clair</Code>), soit sur la ligne au-dessus des paroles, alignés avec des espaces.
            Une ligne seule entre crochets comme <Code>[Refrain]</Code> devient un titre de section.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-1.5">
              <Label>Ce que vous tapez</Label>
              <pre className="m-0 p-4 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md font-mono text-sm leading-[1.7] overflow-x-auto">{`[Refrain]
[G]Au clair de la [D]lune
[G]Mon ami [D]Pier[G]rot`}</pre>
            </div>
            <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-1.5">
              <Label>Ce qui s'affiche</Label>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-md flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-[22px] h-[22px] border-[1.5px] border-ink dark:border-slate-200 rounded font-display font-extrabold text-sm">A</span>
                  <Label>Refrain</Label>
                </div>
                <div className="flex flex-wrap items-end text-lg"><Seg c="G" l="Au clair de la " /><Seg c="D" l="lune" /></div>
                <div className="flex flex-wrap items-end text-lg"><Seg c="G" l="Mon ami " /><Seg c="D" l="Pier" /><Seg c="G" l="rot" /></div>
              </div>
            </div>
          </div>
          <p className="m-0 text-slate-600 dark:text-slate-400">
            Accords reconnus : <Code>[Am7]</Code> <Code>[C/G]</Code> <Code>[D#dim]</Code>, basse après la barre oblique.
            Sections reconnues : Intro, Couplet, Refrain, Pont, Solo, Outro (et leurs équivalents anglais).
          </p>
        </section>

        <section id="transposer" className="flex flex-col gap-3.5 scroll-mt-6">
          <h2 className="m-0 font-display font-bold text-[28px]">2 · Transposition et degrés</h2>
          <p className="m-0 text-slate-600 dark:text-slate-400 max-w-[40em]">
            Les boutons − et + déplacent toute la grille d'un demi-ton ; un clic sur le ton revient à l'original. En mode Degrés, les accords sont notés
            par leur fonction dans la tonalité : la même grille se lit dans n'importe quel ton.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex-[1_1_240px] flex flex-col gap-1.5 p-4 border border-slate-200 dark:border-slate-800 rounded-md">
              <Label>Lettres, ton de C</Label>
              <span className="font-mono font-bold text-xl text-cyan-600 dark:text-cyan-400 whitespace-pre">C   Am   F   G</span>
            </div>
            <div className="flex-[1_1_240px] flex flex-col gap-1.5 p-4 border border-slate-200 dark:border-slate-800 rounded-md">
              <Label>Degrés, valable partout</Label>
              <span className="font-mono font-bold text-xl text-violet-600 dark:text-violet-400 whitespace-pre">1   6m   4   5</span>
            </div>
          </div>
        </section>

        <section id="setlists" className="flex flex-col gap-3.5 scroll-mt-6">
          <h2 className="m-0 font-display font-bold text-[28px]">3 · Setlists</h2>
          <p className="m-0 text-slate-600 dark:text-slate-400 max-w-[40em]">
            Ajoutez des chansons depuis la bibliothèque, réordonnez-les et insérez des notes entre les morceaux (pause, changement d'instrument).
            Chaque morceau garde sa propre transposition. L'export PDF reprend l'ordre et les tonalités.
          </p>
        </section>

        <section id="scene" className="flex flex-col gap-3.5 scroll-mt-6">
          <h2 className="m-0 font-display font-bold text-[28px]">4 · Mode scène et défilement</h2>
          <ul className="m-0 pl-5 list-disc text-slate-600 dark:text-slate-400 flex flex-col gap-1">
            <li>Depuis une setlist, « Mode scène » enchaîne les morceaux dans l'ordre.</li>
            <li>Sur une chanson, « Défilement » fait monter la grille tout seul ; réglez la vitesse de 1 à 7.</li>
            <li>Agrandissez le texte avec les loupes, ou en pinçant l'écran sur mobile et tablette.</li>
            <li>« Paroles seules » masque les accords pour les chanteurs.</li>
          </ul>
        </section>

        <section id="groupes" className="flex flex-col gap-3.5 scroll-mt-6">
          <h2 className="m-0 font-display font-bold text-[28px]">5 · Groupes</h2>
          <p className="m-0 text-slate-600 dark:text-slate-400 max-w-[40em]">
            Une chanson rattachée à un groupe est visible par tous ses membres. Avec « Modifiable par le groupe », chacun peut corriger paroles et accords.
            Invitez un membre par son nom d'utilisateur depuis la page Groupes.
          </p>
        </section>
      </article>
    </div>
  );
};

export default HelpPage;
