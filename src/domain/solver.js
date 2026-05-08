/**
 * Sudoku solver utilities
 * Provides functions for analyzing the puzzle state
 */

/**
 * Get all possible candidates for a specific cell
 * Candidates are numbers 1-9 that are:
 * - Not already in the same row
 * - Not already in the same column  * - Not already in the same 3x3 box
 */
export function getCandidates(grid, row, col) {
  if (grid[row][col] !== 0) {
    // Cell is already filled
    return [];
  }

  const candidates = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  // Remove numbers in the same row
  for (let c = 0; c < 9; c++) {
    const value = grid[row][c];
    if (value !== 0) {
      candidates.delete(value);
    }
  }

  // Remove numbers in the same column
  for (let r = 0; r < 9; r++) {
    const value = grid[r][col];
    if (value !== 0) {
      candidates.delete(value);
    }
  }

  // Remove numbers in the same 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      const value = grid[r][c];
      if (value !== 0) {
        candidates.delete(value);
      }
    }
  }

  return Array.from(candidates).sort((a, b) => a - b);
}

/**
 * Find all cells with only one candidate (naked singles)
 * These are cells that can only have one value
 */
export function findSingles(grid) {
  const singles = [];
  
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        const candidates = getCandidates(grid, row, col);
        if (candidates.length === 1) {
          singles.push({
            row,
            col,
            value: candidates[0],
            reason: 'naked_single',
          });
        }
      }
    }
  }

  return singles;
}

/**
 * Find hidden singles - numbers that can only go in one place in row/column/box
 * More complex logic, returns next deducible move
 */
export function findHiddenSingles(grid) {
  const moves = [];

  // Check rows
  for (let row = 0; row < 9; row++) {
    for (let num = 1; num <= 9; num++) {
      let count = 0;
      let lastCol = -1;
      
      // Count where this number can go in this row
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === num) {
          count = 0; // Already placed
          break;
        }
        if (grid[row][col] === 0 && getCandidates(grid, row, col).includes(num)) {
          count++;
          lastCol = col;
        }
      }
      
      if (count === 1) {
        moves.push({
          row,
          col: lastCol,
          value: num,
          reason: 'hidden_single_row',
        });
      }
    }
  }

  // Check columns
  for (let col = 0; col < 9; col++) {
    for (let num = 1; num <= 9; num++) {
      let count = 0;
      let lastRow = -1;
      
      for (let row = 0; row < 9; row++) {
        if (grid[row][col] === num) {
          count = 0;
          break;
        }
        if (grid[row][col] === 0 && getCandidates(grid, row, col).includes(num)) {
          count++;
          lastRow = row;
        }
      }
      
      if (count === 1) {
        moves.push({
          row: lastRow,
          col,
          value: num,
          reason: 'hidden_single_col',
        });
      }
    }
  }

  // Check 3x3 boxes
  for (let boxRow = 0; boxRow < 9; boxRow += 3) {
    for (let boxCol = 0; boxCol < 9; boxCol += 3) {
      for (let num = 1; num <= 9; num++) {
        let count = 0;
        let lastRow = -1;
        let lastCol = -1;
        
        for (let r = boxRow; r < boxRow + 3; r++) {
          for (let c = boxCol; c < boxCol + 3; c++) {
            if (grid[r][c] === num) {
              count = 0;
              break;
            }
            if (grid[r][c] === 0 && getCandidates(grid, r, c).includes(num)) {
              count++;
              lastRow = r;
              lastCol = c;
            }
          }
          if (count === 0) break;
        }
        
        if (count === 1) {
          moves.push({
            row: lastRow,
            col: lastCol,
            value: num,
            reason: 'hidden_single_box',
          });
        }
      }
    }
  }

  // Return only unique moves
  const seen = new Set();
  return moves.filter(move => {
    const key = `${move.row},${move.col},${move.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Find the next deducible move (naked or hidden single)
 */
export function findNextMove(grid) {
  // Prefer naked singles first
  const singles = findSingles(grid);
  if (singles.length > 0) {
    return singles[0];
  }

  // Fall back to hidden singles
  const hiddenSingles = findHiddenSingles(grid);
  if (hiddenSingles.length > 0) {
    return hiddenSingles[0];
  }

  return null;
}

/**
 * Check if the current grid state is in conflict (invalid)
 * Returns true if there are empty cells with no candidates
 */
export function isInConflict(grid) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        const candidates = getCandidates(grid, row, col);
        if (candidates.length === 0) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if the puzzle is solved
 */
export function isSolved(grid) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        return false;
      }
    }
  }
  return true;
}
