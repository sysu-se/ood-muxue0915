import { Sudoku } from './Sudoku.js';
import { Game } from './Game.js';

/**
 * Factory function to create a Sudoku
 */
export function createSudoku(grid) {
  return new Sudoku(grid);
}

/**
 * Factory function to create a Sudoku from JSON
 */
export function createSudokuFromJSON(json) {
  const sudoku = new Sudoku(json.grid);
  return sudoku;
}

/**
 * Factory function to create a Game
 */
export function createGame(options) {
  return new Game(options);
}

/**
 * Factory function to create a Game from JSON
 */
export function createGameFromJSON(json) {
  const sudoku = createSudokuFromJSON(json.sudoku);
  const game = new Game({ sudoku });
  
  // Restore history
  game.history = json.history.map(grid => structuredClone(grid));
  game.historyIndex = json.historyIndex;
  game.sudoku = new Sudoku(game.history[game.historyIndex]);
  
  return game;
}

export { Sudoku, Game };
