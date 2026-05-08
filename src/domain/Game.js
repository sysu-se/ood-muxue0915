import { Sudoku } from './Sudoku.js';

/**
 * Game - Session management with history tracking and exploration
 * Responsible for:
 * - Wrapping Sudoku with undo/redo capability
 * - Managing move history
 * - Supporting exploration mode with backtracking
 * - Serializing game state including history
 */
export class Game {
  constructor(options) {
    const { sudoku } = options;
    this.sudoku = sudoku;
    // History chain: each entry is a snapshot of the sudoku grid
    this.history = [sudoku.getGrid()];
    // Current position in history (0 = initial state)
    this.historyIndex = 0;
    
    // Explore mode state
    this.exploreMode = null; // null or {grid, history, historyIndex, failedPaths}
    this.failedExplorationPaths = new Set(); // Hash of failed board states
  }

  /**
   * Get the current Sudoku instance
   */
  getSudoku() {
    return this.sudoku;
  }

  /**
   * Apply a guess move and record in history
   */
  guess(move) {
    this.sudoku.guess(move);
    
    // If we're not at the end of history (after undo), truncate redo chain
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    // Record this state in history
    this.history.push(this.sudoku.getGrid());
    this.historyIndex++;
  }

  /**
   * Check if undo is possible
   */
  canUndo() {
    return this.historyIndex > 0;
  }

  /**
   * Undo the last move
   */
  undo() {
    if (!this.canUndo()) return;
    
    this.historyIndex--;
    const previousGrid = this.history[this.historyIndex];
    this.sudoku = new Sudoku(previousGrid);
  }

  /**
   * Check if redo is possible
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Redo the last undone move
   */
  redo() {
    if (!this.canRedo()) return;
    
    this.historyIndex++;
    const nextGrid = this.history[this.historyIndex];
    this.sudoku = new Sudoku(nextGrid);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      sudoku: this.sudoku.toJSON(),
      history: this.history.map(grid => structuredClone(grid)),
      historyIndex: this.historyIndex,
      exploreMode: this.exploreMode ? {
        grid: structuredClone(this.exploreMode.grid),
        history: this.exploreMode.history.map(grid => structuredClone(grid)),
        historyIndex: this.exploreMode.historyIndex,
        failedPaths: Array.from(this.exploreMode.failedPaths),
      } : null,
      failedExplorationPaths: Array.from(this.failedExplorationPaths),
    };
  }

  // ==================== Explore Mode Methods ====================

  /**
   * Check if in explore mode
   */
  isExploring() {
    return this.exploreMode !== null;
  }

  /**
   * Enter explore mode
   * Saves the current state as a checkpoint for backtracking
   */
  enterExplore() {
    if (this.exploreMode !== null) {
      // Already in explore mode
      return;
    }

    this.exploreMode = {
      grid: this.sudoku.getGrid(),
      history: this.history.map(g => structuredClone(g)),
      historyIndex: this.historyIndex,
      startGrid: structuredClone(this.sudoku.getGrid()),
      failedPaths: new Set(this.failedExplorationPaths),
    };
  }

  /**
   * Make a guess in explore mode
   */
  guessExplore(move) {
    if (!this.isExploring()) {
      throw new Error('Not in explore mode');
    }

    this.sudoku.guess(move);
    
    // Check for conflict
    if (this.sudoku.isInConflict()) {
      return {
        success: false,
        conflict: true,
        message: 'Conflict detected - this path leads to invalid state',
      };
    }

    // Check if this state was already a failed path
    const stateHash = this._hashGrid(this.sudoku.getGrid());
    if (this.exploreMode.failedPaths.has(stateHash)) {
      return {
        success: true,
        wasFailed: true,
        message: 'You reached a previously failed exploration path',
      };
    }

    return { success: true, conflict: false };
  }

  /**
   * Undo in explore mode
   */
  undoExplore() {
    if (!this.isExploring()) {
      throw new Error('Not in explore mode');
    }

    if (this.historyIndex > 0) {
      this.historyIndex--;
      const previousGrid = this.history[this.historyIndex];
      this.sudoku = new Sudoku(previousGrid);
    }
  }

  /**
   * Go back to explore start point
   */
  resetExplore() {
    if (!this.isExploring()) {
      throw new Error('Not in explore mode');
    }

    this.sudoku = new Sudoku(this.exploreMode.startGrid);
    this.history = [structuredClone(this.exploreMode.startGrid)];
    this.historyIndex = 0;
  }

  /**
   * Mark current exploration as failed and reset
   */
  abandonExplore() {
    if (!this.isExploring()) {
      throw new Error('Not in explore mode');
    }

    // Record all states visited in this exploration as failed paths
    const stateHash = this._hashGrid(this.sudoku.getGrid());
    this.failedExplorationPaths.add(stateHash);

    // Restore main game state
    this.sudoku = new Sudoku(this.exploreMode.grid);
    this.history = this.exploreMode.history.map(g => structuredClone(g));
    this.historyIndex = this.exploreMode.historyIndex;
    
    this.exploreMode = null;
  }

  /**
   * Commit exploration result (merge into main history)
   */
  commitExplore() {
    if (!this.isExploring()) {
      throw new Error('Not in explore mode');
    }

    // Record this successful exploration  
    const exploit = this.exploreMode;

    // Modify main history: truncate after current position and add explored grid
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(this.sudoku.getGrid());
    this.historyIndex++;

    this.exploreMode = null;
  }

  /**
   * Try to continue exploration with a different candidate
   * Returns to exploration start and removes this failed path
   */
  backtrackExplore() {
    if (!this.isExploring()) {
      throw new Error('Not in explore mode');
    }

    // Record current exploration as failed
    const stateHash = this._hashGrid(this.sudoku.getGrid());
    this.failedExplorationPaths.add(stateHash);
    this.exploreMode.failedPaths.add(stateHash);

    // Reset to exploration start
    this.resetExplore();
  }

  /**
   * Get hash of grid state for path memory
   */
  _hashGrid(grid) {
    return grid.map(row => row.join('')).join('|');
  }
}
