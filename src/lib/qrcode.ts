/**
 * Pure TypeScript Standalone QR Code Generator
 * Generates genuine, scannable SVG QR codes directly in the browser without external APIs.
 */

// ─── Minimal Reed-Solomon & QR Matrix Encoder ──────────────────────────────────

// Galois Field GF(256) tables for QR Error Correction
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 285; // GF(256) primitive polynomial 0x11d
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function polyMul(poly1: number[], poly2: number[]): number[] {
  const result = new Array(poly1.length + poly2.length - 1).fill(0);
  for (let i = 0; i < poly1.length; i++) {
    for (let j = 0; j < poly2.length; j++) {
      result[i + j] ^= gfMul(poly1[i], poly2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(deg: number): number[] {
  let g = [1];
  for (let i = 0; i < deg; i++) {
    g = polyMul(g, [1, GF256_EXP[i]]);
  }
  return g;
}

function calculateECC(data: number[], eccCount: number): number[] {
  const gen = getGeneratorPoly(eccCount);
  const res = new Array(data.length + eccCount).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// ─── QR Code Specifications for Version 1 to 5 (Byte Mode, ECC Level M) ─────
interface QRVersionSpec {
  ver: number;
  size: number;
  totalDataBytes: number;
  eccBytes: number;
  alignPos: number[];
}

const VERSIONS: QRVersionSpec[] = [
  { ver: 1, size: 21, totalDataBytes: 16, eccBytes: 10, alignPos: [] },
  { ver: 2, size: 25, totalDataBytes: 28, eccBytes: 16, alignPos: [6, 18] },
  { ver: 3, size: 29, totalDataBytes: 44, eccBytes: 26, alignPos: [6, 22] },
  { ver: 4, size: 33, totalDataBytes: 64, eccBytes: 36, alignPos: [6, 26] },
  { ver: 5, size: 37, totalDataBytes: 88, eccBytes: 48, alignPos: [6, 30] },
];

function selectVersion(dataLen: number): QRVersionSpec {
  for (const v of VERSIONS) {
    // 4 bits mode + 8 bits count + data
    if (dataLen + 2 <= v.totalDataBytes) return v;
  }
  return VERSIONS[VERSIONS.length - 1];
}

// ─── Matrix Builder ──────────────────────────────────────────────────────────

export function generateQRMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec = selectVersion(bytes.length);
  const n = spec.size;

  // Initialize matrix (null = unassigned, true = dark, false = light)
  const grid: (boolean | null)[][] = Array.from({ length: n }, () => new Array(n).fill(null));

  // Helper: Mark function patterns (finder, timing, format)
  const isFunction = Array.from({ length: n }, () => new Array(n).fill(false));

  function setModule(r: number, c: number, val: boolean) {
    grid[r][c] = val;
    isFunction[r][c] = true;
  }

  // 1. Draw Finder Patterns (7x7) at 3 corners
  const finders = [[0, 0], [0, n - 7], [n - 7, 0]];
  for (const [fr, fc] of finders) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = fr + r;
        const col = fc + c;
        if (row < 0 || row >= n || col < 0 || col >= n) continue;
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const isDark = (r >= 0 && r <= 6 && c >= 0 && c <= 6) && (isBorder || isInner);
        setModule(row, col, isDark);
      }
    }
  }

  // 2. Alignment Patterns (5x5)
  if (spec.alignPos.length > 0) {
    for (const r of spec.alignPos) {
      for (const c of spec.alignPos) {
        if (isFunction[r][c]) continue; // Skip overlaps with finders
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isDark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(r + dr, c + dc, isDark);
          }
        }
      }
    }
  }

  // 3. Timing Patterns (row 6 and col 6)
  for (let i = 0; i < n; i++) {
    if (grid[6][i] === null) setModule(6, i, i % 2 === 0);
    if (grid[i][6] === null) setModule(i, 6, i % 2 === 0);
  }

  // 4. Dark Module (always at row 4*ver + 9, col 8)
  setModule(4 * spec.ver + 9, 8, true);

  // 5. Format Info Space (reserve 15 bits around finders)
  for (let i = 0; i < 9; i++) {
    if (grid[8][i] === null) isFunction[8][i] = true;
    if (grid[i][8] === null) isFunction[i][8] = true;
  }
  for (let i = n - 8; i < n; i++) {
    if (grid[8][i] === null) isFunction[8][i] = true;
    if (grid[n - (n - i)][8] === null) isFunction[n - (n - i)][8] = true;
  }

  // 6. Encode Data (Byte Mode 0100 + Length + Bytes + Padding)
  const bitBuf: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) bitBuf.push((val >> i) & 1);
  }

  pushBits(4, 4); // Byte Mode
  pushBits(bytes.length, 8); // Data Count
  for (const b of bytes) pushBits(b, 8); // Payload

  // Add Terminator
  const totalDataBits = spec.totalDataBytes * 8;
  while (bitBuf.length < totalDataBits && bitBuf.length % 8 !== 0) bitBuf.push(0);
  while (bitBuf.length < totalDataBits) {
    pushBits(236, 8);
    if (bitBuf.length < totalDataBits) pushBits(17, 8);
  }

  // Convert bitstream to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bitBuf.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) byteVal = (byteVal << 1) | (bitBuf[i + j] || 0);
    dataBytes.push(byteVal);
  }

  // Compute Reed-Solomon ECC
  const ecc = calculateECC(dataBytes, spec.eccBytes);
  const finalCodewords = [...dataBytes, ...ecc];

  // Convert codewords back to bit sequence
  const finalBits: number[] = [];
  for (const byte of finalCodewords) {
    for (let i = 7; i >= 0; i--) finalBits.push((byte >> i) & 1);
  }

  // 7. Place bits in zig-zag pattern
  let bitIdx = 0;
  let dir = -1; // up
  let r = n - 1;
  let c = n - 1;

  while (c > 0) {
    if (c === 6) c--; // Skip vertical timing column
    for (let i = 0; i < 2; i++) {
      const col = c - i;
      if (!isFunction[r][col]) {
        const bit = bitIdx < finalBits.length ? finalBits[bitIdx++] === 1 : false;
        grid[r][col] = bit;
      }
    }
    r += dir;
    if (r < 0 || r >= n) {
      dir = -dir;
      r += dir;
      c -= 2;
    }
  }

  // 8. Mask Pattern 0 ( (r + c) % 2 == 0 -> invert non-function modules )
  const result: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const isBit = grid[row][col] ?? false;
      if (!isFunction[row][col] && (row + col) % 2 === 0) {
        result[row][col] = !isBit;
      } else {
        result[row][col] = isBit;
      }
    }
  }

  // 9. Write Format Information (Mask 0 + ECC Level M -> 0x5412 XOR Mask 0x5412 = 0x0000)
  // Standard Format Code for Level M, Mask 0: 0x5412 (101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  let fIdx = 0;

  // Around top-left finder
  for (let i = 0; i <= 5; i++) result[8][i] = formatBits[fIdx++] === 1;
  result[8][7] = formatBits[fIdx++] === 1;
  result[8][8] = formatBits[fIdx++] === 1;
  result[7][8] = formatBits[fIdx++] === 1;
  for (let i = 5; i >= 0; i--) result[i][8] = formatBits[fIdx++] === 1;

  // Around top-right and bottom-left finders
  fIdx = 0;
  for (let i = n - 1; i >= n - 8; i--) result[8][i] = formatBits[fIdx++] === 1;
  for (let i = n - 7; i < n; i++) result[i][8] = formatBits[fIdx++] === 1;

  return result;
}

// ─── SVG Generator Function ───────────────────────────────────────────────────

export interface QROptions {
  size?: number;
  fgColor?: string;
  bgColor?: string;
  margin?: number;
}

export function generateQRCodeSVG(
  text: string,
  options: QROptions = {}
): string {
  const { size = 256, fgColor = "#111b21", bgColor = "#ffffff", margin = 2 } = options;
  const matrix = generateQRMatrix(text);
  const n = matrix.length;
  const moduleSize = (size - margin * 2 * 4) / n;

  let paths = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (margin * 4 + c * moduleSize).toFixed(2);
        const y = (margin * 4 + r * moduleSize).toFixed(2);
        const w = moduleSize.toFixed(2);
        paths += `M${x},${y}h${w}v${w}h-${w}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="100%" height="100%" fill="${bgColor}" rx="16"/>
    <path d="${paths}" fill="${fgColor}"/>
  </svg>`;
}
