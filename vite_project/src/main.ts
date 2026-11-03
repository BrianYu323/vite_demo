import './style.css';
import { GENERATIONS } from 'pokenode-ts';
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

// Default: show the Pokémon from "kanto" (Generation I)
loadPokedex(GENERATIONS.GENERATION_I);
