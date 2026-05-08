import { getCandidates, findNextMove, isInConflict, isSolved } from './solver.js';

/**
 * Sudoku - Core domain object representing the puzzle state
 * Responsible for:
 * - Managing the 9x9 grid
 * - Handling moves (guesses)
 * - Providing puzzle queries  * - Cloning for independent copies
 * - Serialization
 * - Providing hints
 */
export class Sudoku {
  constructor(grid) {
    // Defensive copy: ensure input grid doesn't influence internal state
    this.grid = structuredClone(grid);
  }

  /**
   * Get the current grid
   * Returns a defensive copy to prevent external modification
   */
  getGrid() {
    return structuredClone(this.grid);
  }

  /**
   * Apply a guess to the puzzle
   * @param {Object} move - {row, col, value}
   */
  guess(move) {
    const { row, col, value } = move;
    this.grid[row][col] = value;
  }

  /**
   * Create an independent deep copy of this Sudoku
   */
  clone() {
    return new Sudoku(this.grid);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      grid: this.getGrid(),
    };
  }

  /**
   * Human-readable string representation
   */
  toString() {
    const lines = this.grid.map(row => row.join(' '));
    return lines.join('\n');
  }

  /**
   * Get candidate hints for a specific cell
   * Returns array of numbers that could go in this cell
   */
  getCandidateHint(row, col) {
    return getCandidates(this.grid, row, col);
  }

  /**
   * Get the next deducible move (hint)
   * Returns {row, col, value, reason} or null if no deduction possible
   */
  getNextHint() {
    return findNextMove(this.grid);
  }

  /**
   * Check if the current state is in conflict
   */
  isInConflict() {
    return isInConflict(this.grid);
  }

  /**
   * Check if the puzzle is solved
   */
  isSolved() {
    return isSolved(this.grid);
  }
}
