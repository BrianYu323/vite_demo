import './style.css';
import { GENERATIONS } from 'pokenode-ts';
import { openPokemonDetail } from './detail';
import { loadGamesPage } from './games';
import { initMenu, renderMenuTemplate } from './menu';
import { loadPokedex } from './pokedex';

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

// Open the Pokémon detail page when a card is clicked
document.getElementById('pokedex')!.addEventListener('click', (e) => {
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
