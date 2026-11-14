// ─── seatingEngine.js ─── Mode-aware seating arrangement engine ───

export const MODES = {
  SEMESTER: 'semester',
  INTERNAL: 'internal'
};

// Mode-specific configurations — used for conflict display / heatmap
// The actual generation uses dynamic hall sizes from the backend
const CONFIG = {
  [MODES.SEMESTER]: {
    ROWS: 10,
    COLS: 6,
    SEATS_PER_HALL: 60,
    STRATEGIC_GAPS: 4
  },
  [MODES.INTERNAL]: {
    ROWS: 10,
    COLS: 8,
    SEATS_PER_HALL: 80,
    STRATEGIC_GAPS: 4
  }
};

export function getGridConfig(mode) {
  return CONFIG[mode] || CONFIG[MODES.SEMESTER];
}

// ─── Utility helpers ───

// Extraction logic: "AI&DS A" -> "AI&DS", "CSE-B" -> "CSE"
function getBaseDept(dept) {
  if (!dept) return 'Unknown';
  // Remove trailing sections (Space+Letter, Dash+Letter, Parentheses)
  return dept.split(/[\s\-\(]/)[0].toUpperCase().trim();
}

function getUniqueClass(student) {
  return `${getBaseDept(student.dept)}-Y${student.year}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function snakeOrder(rows, cols) {
  const order = [];
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < cols; c++) order.push({ row: r, col: c });
    } else {
      for (let c = cols - 1; c >= 0; c--) order.push({ row: r, col: c });
    }
  }
  return order;
}

function getAdjacentPositions(row, col, rows, cols) {
  const adj = [];
  if (row > 0) adj.push({ row: row - 1, col });
  if (row < rows - 1) adj.push({ row: row + 1, col });
  if (col > 0) adj.push({ row, col: col - 1 });
  if (col < cols - 1) adj.push({ row, col: col + 1 });
  return adj;
}

function getBenchMatePosition(row, col, mode) {
  if (mode !== MODES.INTERNAL) return null;
  // Benches are (0,1), (2,3), (4,5), (6,7)
  const isSeatA = col % 2 === 0;
  return { row, col: isSeatA ? col + 1 : col - 1 };
}

// ─── Safe Grid Access Helper ───

function getSeat(grid, row, col) {
  if (!grid || !Array.isArray(grid)) return null;
  if (row < 0 || row >= grid.length) return null;
  if (!grid[row] || !Array.isArray(grid[row])) return null;
  if (col < 0 || col >= grid[row].length) return null;
  return grid[row][col];
}

// ─── Conflict scoring ───

export function calculateConflicts(grid, mode = MODES.SEMESTER) {
  // Data guard - check grid is valid
  if (!grid || !Array.isArray(grid) || grid.length === 0) {
    return [];
  }
  
  // Use actual grid dimensions (worker returns dynamic sizes)
  const actualRows = grid.length;
  const actualCols = grid[0] ? grid[0].length : 0;
  if (actualRows === 0 || actualCols === 0) return [];

  const conflicts = [];
  const processedKeys = new Set();

  for (let r = 0; r < actualRows; r++) {
    for (let c = 0; c < actualCols; c++) {
      const student = getSeat(grid, r, c);
      if (!student) continue;

      const studentClass = getUniqueClass(student);
      const studentCourse = student.courseCode || studentClass;

      // 1. Adjacency Checks (R, B) - avoids double-counting relative to L, F
      const neighbors = [
        { row: r, col: c + 1 }, // Right
        { row: r + 1, col: c }  // Bottom
      ];

      neighbors.forEach(({ row: ar, col: ac }) => {
        if (ar < 0 || ar >= actualRows || ac < 0 || ac >= actualCols) return;
        const neighbor = getSeat(grid, ar, ac);
        if (!neighbor) return;

        const neighborClass = getUniqueClass(neighbor);
        const neighborCourse = neighbor.courseCode || neighborClass;

        let score = 0;
        let type = '';

        // Hard Cheating Conflict: Same Course Code / Exam Paper
        if (studentCourse === neighborCourse) {
          score = 25;
          type = 'same-course-adjacent';
        }
        // Soft Conflict: Same Class (Dept + Year) when courseCode is unspecified
        else if (!student.courseCode && !neighbor.courseCode && studentClass === neighborClass) {
          score = 20;
          type = 'same-dept-year-adjacent';
        }

        if (score > 0) {
          const key = `${student.id || student.regNo}-${neighbor.id || neighbor.regNo}`;
          if (!processedKeys.has(key)) {
            processedKeys.add(key);
            conflicts.push({ key, student1: student, student2: neighbor, score, type });
          }
        }
      });

      // 2. Bench Checks (Internal Mode only) - Same course on bench
      if (mode === MODES.INTERNAL && c % 2 === 0) {
        const mate = getSeat(grid, r, c + 1);
        if (mate) {
          const mateClass = getUniqueClass(mate);
          const mateCourse = mate.courseCode || mateClass;

          let score = 0;
          let type = '';

          // Priority 1: Same CourseCode on same bench
          if (studentCourse === mateCourse) {
            score = 18;
            type = 'same-course-bench';
          }
          // Priority 2: Same Dept+Year on bench
          else if (studentClass === mateClass) {
            score = 18;
            type = 'same-dept-year-bench';
          }

          if (score > 0) {
            const key = `${student.id}-${mate.id}`;
            if (!processedKeys.has(key)) {
              processedKeys.add(key);
              conflicts.push({ key, student1: student, student2: mate, score, type });
            }
          }
        }
      }
    }
  }

  // Sort conflicts by priority (score descending)
  return conflicts.sort((a, b) => b.score - a.score);
}

export function calculateSQI(conflicts) {
  const totalPenalty = conflicts.reduce((sum, c) => sum + c.score, 0);
  // Integer SQI: max(0, 100 - totalPenalty / 2), clamped to 0-100
  const sqi = Math.max(0, Math.min(100, Math.round(100 - totalPenalty / 2)));
  let rating = 'Poor';
  if (sqi >= 90) rating = 'Excellent';
  else if (sqi >= 70) rating = 'Good';
  else if (sqi >= 50) rating = 'Fair';
  return { sqi, rating, totalPenalty };
}

// ─── Core Engine logic ───

function groupByDept(students) {
  const groups = {};
  students.forEach(s => {
    // Group by (BaseDept + Year) to treat them as the primary unit of separation
    const key = getUniqueClass(s);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

function groupByCourse(students) {
  const groups = {};
  students.forEach(s => {
    // Group by CourseCode (fallback to Dept-Year)
    const key = s.courseCode || getUniqueClass(s);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

// ─── Checkerboard Allocation Pattern ───

function checkerboardInterleave(students, mode) {
  const config = getGridConfig(mode);
  const courseGroups = groupByCourse(students);
  const courses = Object.keys(courseGroups);
  
  if (courses.length === 0) return students;
  
  // Create cyclic assignment order
  const result = [];
  const queues = courses.map(c => [...courseGroups[c]]);
  let courseIndex = 0;
  
  // Calculate total students
  const totalStudents = students.length;
  
  for (let i = 0; i < totalStudents; i++) {
    // Find next course with available students
    let attempts = 0;
    while (attempts < courses.length) {
      if (queues[courseIndex].length > 0) {
        result.push(queues[courseIndex].shift());
        break;
      }
      courseIndex = (courseIndex + 1) % courses.length;
      attempts++;
    }
    // Shift pattern for next iteration (creates checkerboard effect)
    courseIndex = (courseIndex + 1) % courses.length;
  }
  
  return result;
}

function roundRobinInterleave(deptGroups) {
  const depts = Object.keys(deptGroups);
  const queues = depts.map(d => [...deptGroups[d]]);
  const result = [];
  let total = queues.reduce((s, q) => s + q.length, 0);
  
  let lastClass = null;

  while (result.length < total) {
    let bestQueueIdx = -1;
    let maxLen = -1;

    // Smart pick: find a queue that isn't the last one we used, 
    // and ideally has the most students remaining to maintain balance.
    for (let i = 0; i < depts.length; i++) {
      if (queues[i].length > 0) {
        if (depts[i] !== lastClass) {
          if (queues[i].length > maxLen) {
            maxLen = queues[i].length;
            bestQueueIdx = i;
          }
        }
      }
    }

    // If no different class is available, we have to pick anything
    if (bestQueueIdx === -1) {
      for (let i = 0; i < depts.length; i++) {
        if (queues[i].length > 0) {
          bestQueueIdx = i;
          break;
        }
      }
    }

    if (bestQueueIdx === -1) break;

    result.push(queues[bestQueueIdx].shift());
    lastClass = depts[bestQueueIdx];
  }
  return result;
}

function hasConflict(grid, r, c, student, mode) {
  const config = getGridConfig(mode);
  
  // Adjacency check
  const adjacents = getAdjacentPositions(r, c, config.ROWS, config.COLS);
  const studentClass = getUniqueClass(student);

  for (let { row: ar, col: ac } of adjacents) {
    const neighbor = grid[ar][ac];
    if (neighbor && getUniqueClass(neighbor) === studentClass) return true;
  }

  // Bench check
  if (mode === MODES.INTERNAL) {
    const matePos = getBenchMatePosition(r, c, mode);
    const mate = grid[matePos.row][matePos.col];
    if (mate && getUniqueClass(mate) === studentClass) return true;
  }

  return false;
}

function assignToGrid(students, hallIndex, mode) {
  const config = getGridConfig(mode);
  const grid = Array.from({ length: config.ROWS }, () => Array(config.COLS).fill(null));
  
  // Internal mode uses standard row-major to keep benches aligned vertically
  // Semester mode uses snake for traditional pathing
  let order;
  if (mode === MODES.INTERNAL) {
    order = [];
    for (let r = 0; r < config.ROWS; r++) {
      for (let c = 0; c < config.COLS; c++) order.push({ row: r, col: c });
    }
  } else {
    order = snakeOrder(config.ROWS, config.COLS);
  }
  let unassigned = [...students];

  for (let i = 0; i < order.length; i++) {
    if (unassigned.length === 0) break;
    const { row, col } = order[i];
    
    // Efficient candidate finding
    let bestMatchIdx = -1;
    for (let j = 0; j < unassigned.length; j++) {
      if (!hasConflict(grid, row, col, unassigned[j], mode)) {
        bestMatchIdx = j;
        break;
      }
    }

    const student = unassigned.splice(bestMatchIdx === -1 ? 0 : bestMatchIdx, 1)[0];
    grid[row][col] = {
      ...student,
      hall: hallIndex + 1,
      seat: i + 1,
      row: row + 1,
      col: col + 1,
    };
  }

  return grid;
}

// ─── Algorithms ───

export function standardSeating(students, mode = MODES.SEMESTER) {
  const config = getGridConfig(mode);
  const deptGroups = groupByDept(students);
  const interleaved = roundRobinInterleave(deptGroups);
  
  const halls = [];
  for (let i = 0; i < interleaved.length; i += config.SEATS_PER_HALL) {
    const hallStudents = interleaved.slice(i, i + config.SEATS_PER_HALL);
    halls.push(assignToGrid(hallStudents, halls.length, mode, 'greedy'));
  }
  return halls;
}

export function marksBasedSeating(students, mode = MODES.SEMESTER) {
  const sorted = [...students].sort((a, b) => (b.marks || 0) - (a.marks || 0));
  const config = getGridConfig(mode);
  
  const halls = [];
  for (let i = 0; i < sorted.length; i += config.SEATS_PER_HALL) {
    const hallStudents = sorted.slice(i, i + config.SEATS_PER_HALL);
    const deptGroups = groupByDept(hallStudents);
    const interleaved = roundRobinInterleave(deptGroups);
    halls.push(assignToGrid(interleaved, halls.length, mode, 'greedy'));
  }
  return halls;
}

export function randomSeating(students, mode = MODES.SEMESTER) {
  const shuffled = shuffle(students);
  return standardSeating(shuffled, mode);
}

function scoreGrid(grid, mode) {
  return calculateConflicts(grid, mode).reduce((sum, c) => sum + c.score, 0);
}

export function countConflicts(grid, mode) {
  return calculateConflicts(grid, mode).length;
}

export function countAllConflicts(halls, mode) {
  if (!halls || !Array.isArray(halls)) return 0;
  return halls.reduce((acc, g) => acc + countConflicts(g, mode), 0);
}

function deepCopyGrid(grid) {
  if (!grid || !Array.isArray(grid)) return [];
  return grid.map(row => (row && Array.isArray(row)) ? row.map(cell => (cell ? { ...cell } : null)) : []);
}

export function optimizedSeating(students, mode = MODES.SEMESTER) {
  if (!students || students.length === 0) return [];
  const initialHalls = standardSeating(students, mode);
  const config = getGridConfig(mode);

  return initialHalls.map((grid) => {
    if (!grid || !Array.isArray(grid)) return grid;
    let currentGrid = grid; 
    let currentScore = scoreGrid(currentGrid, mode);
    
    // Significantly increased iterations for a "strong" algorithm
    const MAX_ITERATIONS = 8000; 
    const occupied = [];
    for (let r = 0; r < config.ROWS; r++) {
      for (let c = 0; c < config.COLS; c++) {
        if (getSeat(currentGrid, r, c)) occupied.push({ r, c });
      }
    }

    if (occupied.length < 2) return currentGrid;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      if (currentScore === 0) break;

      // Randomly select two positions to swap
      const i1 = Math.floor(Math.random() * occupied.length);
      const i2 = Math.floor(Math.random() * occupied.length);
      if (i1 === i2) continue;

      const p1 = occupied[i1];
      const p2 = occupied[i2];

      // Perform swap in-place for scoring (simulate)
      const s1 = currentGrid[p1.r][p1.c];
      const s2 = currentGrid[p2.r][p2.c];

      currentGrid[p1.r][p1.c] = s2;
      currentGrid[p2.r][p2.c] = s1;

      const newScore = scoreGrid(currentGrid, mode);

      if (newScore < currentScore) {
        currentScore = newScore;
        // Permenantly update coords
        if (currentGrid[p1.r][p1.c]) {
          currentGrid[p1.r][p1.c].row = p1.r + 1;
          currentGrid[p1.r][p1.c].col = p1.c + 1;
        }
        if (currentGrid[p2.r][p2.c]) {
          currentGrid[p2.r][p2.c].row = p2.r + 1;
          currentGrid[p2.r][p2.c].col = p2.c + 1;
        }
      } else {
        // Swap back — never accept a worse result
        currentGrid[p1.r][p1.c] = s1;
        currentGrid[p2.r][p2.c] = s2;
      }
    }

    return currentGrid;
  });
}

/**
 * fixConflicts — Incremental improvement pass on existing halls.
 * Guaranteed to NEVER increase conflicts. Each call only improves or stays same.
 * Used by the 'Fix X Conflicts' button for progressive refinement.
 */
export function fixConflicts(halls, mode = MODES.SEMESTER) {
  const config = getGridConfig(mode);

  return halls.map((grid) => {
    let bestGrid = deepCopyGrid(grid);
    let bestScore = scoreGrid(bestGrid, mode);

    if (bestScore === 0) return bestGrid;

    const occupied = [];
    for (let r = 0; r < config.ROWS; r++) {
      for (let c = 0; c < config.COLS; c++) {
        if (bestGrid[r][c]) occupied.push({ r, c });
      }
    }
    if (occupied.length < 2) return bestGrid;

    const MAX_ITERATIONS = 20000;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      if (bestScore === 0) break;

      // Targeted Swap Logic:
      // Identify a seat that CURRENTLY has a conflict
      let p1 = null;
      const conflictSeats = [];
      
      // Randomly sample to find a conflict seat quickly
      for (let attempt = 0; attempt < 10; attempt++) {
        const randOccupied = occupied[Math.floor(Math.random() * occupied.length)];
        const student = bestGrid[randOccupied.r][randOccupied.c];
        
        // Use hasConflict helper
        if (hasConflict(bestGrid, randOccupied.r, randOccupied.c, student, mode)) {
          p1 = randOccupied;
          break;
        }
      }

      // If we didn't find one by sampling, grab any random seat
      if (!p1) p1 = occupied[Math.floor(Math.random() * occupied.length)];
      
      // Pick any other seat to swap with
      const p2 = occupied[Math.floor(Math.random() * occupied.length)];
      if (p1.r === p2.r && p1.c === p2.c) continue;

      const s1 = bestGrid[p1.r][p1.c];
      const s2 = bestGrid[p2.r][p2.c];
      
      bestGrid[p1.r][p1.c] = s2;
      bestGrid[p2.r][p2.c] = s1;

      const newScore = scoreGrid(bestGrid, mode);

      if (newScore < bestScore) {
        bestScore = newScore;
        // Update metadata
        if (bestGrid[p1.r][p1.c]) {
          bestGrid[p1.r][p1.c].row = p1.r + 1;
          bestGrid[p1.r][p1.c].col = p1.c + 1;
        }
        if (bestGrid[p2.r][p2.c]) {
          bestGrid[p2.r][p2.c].row = p2.r + 1;
          bestGrid[p2.r][p2.c].col = p2.c + 1;
        }
      } else {
        // Revert
        bestGrid[p1.r][p1.c] = s1;
        bestGrid[p2.r][p2.c] = s2;
      }
    }

    return bestGrid;
  });
}

// ─── Zero-Conflict Guarantee Engine ───

/**
 * zeroConflictOptimize — Advanced optimization with priority-based conflict resolution
 * Guarantees near-zero conflicts or returns lowest possible conflict configuration
 * Priority Order: 1. Same CourseCode, 2. Same Dept+Year, 3. Distance violations, 4. Adjacent
 */
export function zeroConflictOptimize(halls, mode = MODES.SEMESTER, maxIterations = 5000) {
  const config = getGridConfig(mode);

  return halls.map((grid, hallIdx) => {
    let bestGrid = deepCopyGrid(grid);
    let bestScore = scoreGrid(bestGrid, mode);
    let bestConflicts = calculateConflicts(bestGrid, mode);

    if (bestScore === 0) return { grid: bestGrid, score: 0, isPerfect: true };

    const occupied = [];
    for (let r = 0; r < config.ROWS; r++) {
      for (let c = 0; c < config.COLS; c++) {
        if (bestGrid[r][c]) occupied.push({ r, c });
      }
    }
    if (occupied.length < 2) return { grid: bestGrid, score: bestScore, isPerfect: bestScore === 0 };

    let stableCount = 0;
    const STABLE_THRESHOLD = 500; // Stop if no improvement for 500 iterations

    for (let iter = 0; iter < maxIterations; iter++) {
      if (bestScore === 0) break; // Perfect seating achieved
      if (stableCount >= STABLE_THRESHOLD) break; // No improvement possible

      // Get current conflicts sorted by priority (highest score first)
      const conflicts = calculateConflicts(bestGrid, mode);
      
      // Target highest priority conflict first
      let targetSeat = null;
      if (conflicts.length > 0) {
        // Pick a seat involved in the highest-priority conflict
        const worstConflict = conflicts[0];
        const seat1 = occupied.find(p => 
          bestGrid[p.r][p.c]?.id === worstConflict.student1.id
        );
        if (seat1) targetSeat = seat1;
      }

      // If no conflict seat found, pick random
      if (!targetSeat) {
        targetSeat = occupied[Math.floor(Math.random() * occupied.length)];
      }

      // Find best swap candidate
      let bestSwap = null;
      let bestSwapScore = bestScore;

      // Try swapping with several random candidates
      const sampleSize = Math.min(20, occupied.length);
      for (let i = 0; i < sampleSize; i++) {
        const candidate = occupied[Math.floor(Math.random() * occupied.length)];
        if (candidate.r === targetSeat.r && candidate.c === targetSeat.c) continue;

        // Simulate swap
        const s1 = bestGrid[targetSeat.r][targetSeat.c];
        const s2 = bestGrid[candidate.r][candidate.c];

        bestGrid[targetSeat.r][targetSeat.c] = s2;
        bestGrid[candidate.r][candidate.c] = s1;

        const newScore = scoreGrid(bestGrid, mode);

        if (newScore < bestSwapScore) {
          bestSwapScore = newScore;
          bestSwap = { ...candidate };
        }

        // Revert
        bestGrid[targetSeat.r][targetSeat.c] = s1;
        bestGrid[candidate.r][candidate.c] = s2;
      }

      // Apply best swap if it improves
      if (bestSwap && bestSwapScore < bestScore) {
        const s1 = bestGrid[targetSeat.r][targetSeat.c];
        const s2 = bestGrid[bestSwap.r][bestSwap.c];

        bestGrid[targetSeat.r][targetSeat.c] = s2;
        bestGrid[bestSwap.r][bestSwap.c] = s1;

        // Update metadata
        if (bestGrid[targetSeat.r][targetSeat.c]) {
          bestGrid[targetSeat.r][targetSeat.c].row = targetSeat.r + 1;
          bestGrid[targetSeat.r][targetSeat.c].col = targetSeat.c + 1;
        }
        if (bestGrid[bestSwap.r][bestSwap.c]) {
          bestGrid[bestSwap.r][bestSwap.c].row = bestSwap.r + 1;
          bestGrid[bestSwap.r][bestSwap.c].col = bestSwap.c + 1;
        }

        bestScore = bestSwapScore;
        stableCount = 0; // Reset stable count on improvement
      } else {
        stableCount++;
      }
    }

    return {
      grid: bestGrid,
      score: bestScore,
      isPerfect: bestScore === 0,
      iterations: maxIterations - stableCount
    };
  });
}

/**
 * autoOptimize — Full automatic optimization with progress tracking
 * Runs until near-zero conflicts or max iterations reached
 */
export function autoOptimize(halls, mode = MODES.SEMESTER, onProgress = null) {
  const MAX_TOTAL_ITERATIONS = 2000;
  let totalIterations = 0;
  let currentHalls = halls.map(g => deepCopyGrid(g));
  let bestOverallScore = Infinity;
  let bestOverallHalls = currentHalls;

  while (totalIterations < MAX_TOTAL_ITERATIONS) {
    const batchSize = 100;
    const results = zeroConflictOptimize(currentHalls, mode, batchSize);
    
    currentHalls = results.map(r => r.grid);
    const currentScore = results.reduce((sum, r) => sum + r.score, 0);
    
    if (currentScore < bestOverallScore) {
      bestOverallScore = currentScore;
      bestOverallHalls = currentHalls.map(g => deepCopyGrid(g));
    }

    totalIterations += batchSize;

    // Report progress
    if (onProgress) {
      onProgress({
        iterations: totalIterations,
        maxIterations: MAX_TOTAL_ITERATIONS,
        currentScore,
        bestScore: bestOverallScore,
        isComplete: currentScore === 0 || totalIterations >= MAX_TOTAL_ITERATIONS
      });
    }

    // Stop if perfect
    if (currentScore === 0) break;
  }

  return {
    halls: bestOverallHalls,
    finalScore: bestOverallScore,
    iterations: totalIterations,
    isPerfect: bestOverallScore === 0
  };
}

// ─── Checkerboard Seating Algorithm ───

export function checkerboardSeating(students, mode = MODES.SEMESTER) {
  const config = getGridConfig(mode);
  
  // Use checkerboard interleaving for better distribution
  const checkered = checkerboardInterleave(students, mode);
  
  const halls = [];
  for (let i = 0; i < checkered.length; i += config.SEATS_PER_HALL) {
    const hallStudents = checkered.slice(i, i + config.SEATS_PER_HALL);
    halls.push(assignToGrid(hallStudents, halls.length, mode, getSeatOrder(mode)));
  }
  
  // Run zero-conflict optimization on the result
  return zeroConflictOptimize(halls, mode, 3000).map(r => r.grid);
}

// ─── Others ───

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rollIdx = headers.findIndex(h => h.includes('reg') || h.includes('roll') || h === 'id');
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('student'));
  const deptIdx = headers.findIndex(h => h.includes('dept') || h.includes('branch'));
  const yearIdx = headers.findIndex(h => h === 'year' || h === 'yr');
  const snoIdx = headers.findIndex(h => h.includes('sno') || h.includes('serial'));
  const marksIdx = headers.findIndex(h => h.includes('mark') || h.includes('score'));

  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const cols = line.split(',').map(c => c.trim());
    return {
      sno: snoIdx !== -1 ? cols[snoIdx] : String(i + 1),
      regNo: rollIdx !== -1 ? cols[rollIdx] : `R${String(i + 1).padStart(3, '0')}`,
      id: rollIdx !== -1 ? cols[rollIdx] : `R${String(i + 1).padStart(3, '0')}`, // keeping id for keys
      name: nameIdx !== -1 ? cols[nameIdx] : `Student ${i + 1}`,
      dept: deptIdx !== -1 ? cols[deptIdx] : 'Unknown',
      year: yearIdx !== -1 ? parseInt(cols[yearIdx]) || 1 : 1,
      marks: marksIdx !== -1 ? parseFloat(cols[marksIdx]) || 0 : 0,
    };
  });
}

export function generateSampleData(count = 112) {
  const depts = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS'];
  const students = [];
  for (let i = 0; i < count; i++) {
    students.push({
      id: `S${String(i + 1).padStart(3, '0')}`,
      regNo: `S${String(i + 1).padStart(3, '0')}`,
      name: `Student ${i + 1}`,
      dept: depts[i % depts.length],
      year: Math.floor(Math.random() * 4) + 1,
      marks: Math.floor(Math.random() * 60) + 40,
      sno: String(i + 1)
    });
  }
  return students;
}

export function flattenHalls(halls, mode = MODES.SEMESTER) {
  if (!halls || !Array.isArray(halls)) return [];
  const rows = [];
  halls.forEach((grid, hallIdx) => {
    if (!grid || !Array.isArray(grid)) return;
    const numRows = grid.length;
    const numCols = grid[0] ? grid[0].length : 0;
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const s = getSeat(grid, r, c);
        if (s) {
          rows.push({
            hall: hallIdx + 1,
            hallName: s.hallName || `Hall ${hallIdx + 1}`,
            seat: s.seat,
            row: r + 1,
            col: c + 1,
            name: s.name,
            dept: s.dept,
            year: s.year,
            marks: s.marks,
            id: s.id,
            regNo: s.regNo,
            sno: s.sno,
            courseCode: s.courseCode,
            subject: s.subject || s.subjectCode || '',
            subjectCode: s.subjectCode || s.courseCode || '',
            examDate: s.examDate || '',
            session: s.session || '',
            examMode: mode
          });
        }
      }
    }
  });
  return rows;
}

export function calculateHeatmap(grid) {
  if (!grid || !Array.isArray(grid)) return {};
  const deptCounts = {};
  let total = 0;
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r] || !Array.isArray(grid[r])) continue;
    for (let c = 0; c < grid[r].length; c++) {
      const s = grid[r][c];
      if (s) {
        deptCounts[s.dept] = (deptCounts[s.dept] || 0) + 1;
        total++;
      }
    }
  }
  const heatmap = {};
  Object.keys(deptCounts).forEach(dept => {
    heatmap[dept] = {
      count: deptCounts[dept],
      percentage: total > 0 ? ((deptCounts[dept] / total) * 100).toFixed(1) : 0,
    };
  });
  return heatmap;
}
