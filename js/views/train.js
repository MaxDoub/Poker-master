import { el, go, mount } from '../ui.js';
import { listRanges } from '../ranges.js';
import { allAttempts, summarize } from '../stats.js';

const EXERCISES = [
  {
    route: '#/lookup',
    icon: '?',
    title: 'Que faire ?',
    tag: 'Consultation',
    body: "Tu donnes ta position, ton stack et tes deux cartes, l'app répond ce que "
      + "disent tes ranges, et pourquoi. Ce n'est pas un exercice : c'est une réponse.",
  },
  {
    route: '#/drill',
    icon: '♠',
    title: 'Drill préflop',
    tag: 'Le socle',
    body: "Une main, une position, un stack : tu décides, l'app compare à TES ranges. "
      + "C'est là que se jouent la majorité des erreurs.",
  },
  {
    route: '#/drill?timer=8',
    icon: '⏱',
    title: 'Drill chronométré',
    tag: 'Pression',
    body: '8 secondes par main. Savoir la bonne réponse et la trouver en direct sont deux '
      + 'compétences différentes ; celle-ci se travaille.',
  },
  {
    route: '#/drill?revision=1',
    icon: '↻',
    title: 'Révision ciblée',
    tag: 'Tes fuites',
    body: 'Répétition espacée sur les spots où tu te trompes. Corriger 3 erreurs récurrentes '
      + 'rapporte plus que réviser ce que tu sais déjà.',
  },
  {
    route: '#/odds',
    icon: '⚖',
    title: 'Cotes & équité',
    tag: 'Les maths',
    body: "Face à un all-in : call ou fold ? La réponse est calculée contre la vraie range "
      + "de shove de l'adversaire, pas à l'instinct.",
  },
  {
    route: '#/combos',
    icon: '▦',
    title: 'Combos & blockers',
    tag: 'Le comptage',
    body: 'Compter les combinaisons est ce qui rend le hand-reading possible. '
      + 'Questions rapides, réponses factuelles.',
  },
];

export async function renderTrain(root) {
  const [ranges, attempts] = await Promise.all([listRanges(), allAttempts()]);
  const s = summarize(attempts);

  mount(root,
    el('h1.page-title', null, "S'entraîner"),
    el('p.hint', null, s.total
      ? `${s.total} mains jouées au total. Chaque exercice travaille une compétence différente.`
      : 'Chaque exercice travaille une compétence différente.'),
    !ranges.length
      ? el('div.card.card--warn', null,
        el('p', null, "Aucune range chargée : les exercices ont besoin de tes données."),
        el('button.btn.btn--primary', { onclick: () => go('#/import') }, 'Importer mes ranges'))
      : null,
    el('div.stack', null, EXERCISES.map((x) => el('button.exercise', {
      onclick: () => go(x.route),
      disabled: !ranges.length,
    },
    el('span.exercise__icon', null, x.icon),
    el('span.exercise__body', null,
      el('span.exercise__head', null,
        el('strong', null, x.title),
        el('span.exercise__tag', null, x.tag)),
      el('span.exercise__text', null, x.body))))),
  );
}
