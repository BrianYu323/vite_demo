import './style.css';
import { GENERATIONS } from 'pokenode-ts';
import { initPokedexBackground3D } from './bgThreeStage';
import { openPokemonDetail } from './detail';
import { loadGamesPage } from './games';
import { initMenu, renderMenuTemplate } from './menu';
import { loadPokedex } from './pokedex';

initPokedexBackground3D();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderMenuTemplate()}

  <!-- Page / Region header on top of the main content -->
  <section id="generation-header" class="generation-header"></section>

  <!-- Pokémon Grid -->
  <main id="pokedex" class="pokedex-grid"></main>

  <!-- Games & Versions Table Page -->
  <section id="games-view" class="games-view" style="display: none;"></section>
`;

initMenu({
  onGenerationSelect: (genId) => {
    loadPokedex(genId);
  },
  onItemClick: (filter) => {
    if (filter === 'games') {
      loadGamesPage();
    }
  },
});

const pokedexEl = document.getElementById('pokedex')!;

// Interactive 3D tilt & specular glare on Liquid Glass Pokémon cards
pokedexEl.addEventListener('pointermove', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.pokemon-card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  const tiltY = (x - 0.5) * 16;
  const tiltX = (0.5 - y) * 16;
  card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
  card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
  card.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
  card.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
});

pokedexEl.addEventListener('pointerout', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.pokemon-card');
  if (!card || card.contains(e.relatedTarget as Node | null)) return;
  card.style.removeProperty('--tilt-x');
  card.style.removeProperty('--tilt-y');
});

// Open the Pokémon detail page when a card is clicked
pokedexEl.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.pokemon-card');
  if (!card) return;

  const id = Number(card.dataset.pokemonId);
  const ids = Array.from(document.querySelectorAll<HTMLElement>('#pokedex .pokemon-card')).map(
    (el) => Number(el.dataset.pokemonId)
  );
  openPokemonDetail(id, ids);
});

// Default: show the Pokémon from "kanto" (Generation I)
loadPokedex(GENERATIONS.GENERATION_I);
