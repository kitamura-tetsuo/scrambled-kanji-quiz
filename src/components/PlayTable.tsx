import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, RefreshCw, Eye, Sparkles, BookOpen, Clock, Trophy, ArrowRight, ArrowLeft, Volume2 } from 'lucide-react';
import { motion, AnimatePresence, useDragControls, useMotionValue } from 'motion/react';
import { KanjiQuiz } from '../types';

interface PlayTableProps {
  key?: React.Key | string;
  quiz: KanjiQuiz;
  onCorrect: (timeSpent: number) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Piece {
  id: string;
  char: string;
  originalIndex: number; // original index in quiz.parts to map to its slice definition
  x: number; // percentage
  y: number; // percentage
  correctX: number; // original layout center X coordinate (percentage)
  correctY: number; // original layout center Y coordinate (percentage)
  widthPct: number; // percentage size relative to board width
  heightPct: number; // percentage size relative to board height
  rotate: number; // degrees
  scale: number;
  imageDataUrl: string;
  hitMask?: Uint8Array;
}

function checkIsSolidAtPoint(clientX: number, clientY: number, element: Element, piece: Piece): boolean {
  if (!piece.hitMask) return true; // Default to solid if mask is not yet loaded
  const rect = element.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const maskX = Math.floor((x / rect.width) * 100);
  const maskY = Math.floor((y / rect.height) * 100);

  if (maskX >= 0 && maskX < 100 && maskY >= 0 && maskY < 100) {
    const idx = maskY * 100 + maskX;
    return piece.hitMask[idx] > 20;
  }
  return false;
}

interface KanjiPieceProps {
  key?: React.Key | any;
  piece: Piece;
  playZoneRef: React.RefObject<HTMLDivElement | null>;
  onTranspClick: (e: React.PointerEvent<HTMLDivElement>, currentPieceId: string) => void;
  pieceDragHandlesRef: React.RefObject<{ [pieceId: string]: (e: React.PointerEvent<HTMLDivElement>) => void }>;
  onPieceDragEnd: (id: string, pctX: number, pctY: number) => void;
}

function KanjiPiece({ piece, playZoneRef, onTranspClick, pieceDragHandlesRef, onPieceDragEnd }: KanjiPieceProps) {
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const pieceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pieceDragHandlesRef.current[piece.id] = (e) => {
      dragControls.start(e);
    };
    return () => {
      delete pieceDragHandlesRef.current[piece.id];
    };
  }, [piece.id, dragControls, pieceDragHandlesRef]);

  // Reset dragging offsets when coordinates in parent state change (e.g. shuffles or drop updates)
  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [piece.x, piece.y, x, y]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!piece.hitMask) {
      dragControls.start(e);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const maskX = Math.floor((x / rect.width) * 100);
    const maskY = Math.floor((y / rect.height) * 100);

    let isSolid = false;
    if (maskX >= 0 && maskX < 100 && maskY >= 0 && maskY < 100) {
      const idx = maskY * 100 + maskX;
      isSolid = piece.hitMask[idx] > 20;
    }

    if (isSolid) {
      dragControls.start(e);
    } else {
      onTranspClick(e, piece.id);
    }
  };

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  return (
    <motion.div
      ref={pieceRef}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={playZoneRef}
      dragElastic={0.1}
      dragMomentum={false}
      style={{
        left: `${piece.x}%`,
        top: `${piece.y}%`,
        width: `${piece.widthPct}%`,
        height: `${piece.heightPct}%`,
        x,
        y,
      }}
      initial={{ scale: 0, rotate: 0 }}
      animate={{ scale: piece.scale, rotate: piece.rotate }}
      whileHover={{ scale: piece.scale + 0.05, zIndex: 30, cursor: 'grab' }}
      whileDrag={{ scale: piece.scale + 0.02, cursor: 'grabbing', zIndex: 40 }}
      className="absolute -translate-x-1/2 -translate-y-1/2 select-none cursor-pointer touch-none"
      onPointerDown={handlePointerDown}
      onDragStart={() => {
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
      }}
      onDragEnd={(event, info) => {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        
        if (playZoneRef.current && pieceRef.current) {
          const playZoneRect = playZoneRef.current.getBoundingClientRect();
          const pieceRect = pieceRef.current.getBoundingClientRect();
          
          // Calculate precise center in px of the rendered piece bounding box at drag end
          const pieceCenterX = pieceRect.left + pieceRect.width / 2;
          const pieceCenterY = pieceRect.top + pieceRect.height / 2;
          
          const relativeX = pieceCenterX - playZoneRect.left;
          const relativeY = pieceCenterY - playZoneRect.top;
          
          const pctX = (relativeX / playZoneRect.width) * 100;
          const pctY = (relativeY / playZoneRect.height) * 100;
          onPieceDragEnd(piece.id, pctX, pctY);
        }
      }}
      data-piece-id={piece.id}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none">
        {piece.imageDataUrl ? (
          <img
            src={piece.imageDataUrl}
            alt={piece.char}
            className="w-full h-full object-contain p-0.5 select-none pointer-events-none filter drop-shadow-[0_1px_1px_rgba(30,27,75,0.08)]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="font-serif text-5xl font-black text-gray-900 leading-none opacity-30">
            {piece.char}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function getNonOverlappingPositions(numPieces: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const minX = 18;
  const maxX = 82;
  const minY = 18;
  const maxY = 82;

  // Spacing distance according to piece count: fewer pieces mean larger spacing, 
  // and more pieces mean tighter but still completely separated spacing.
  const minDistancePercent = numPieces <= 2 ? 28 : numPieces <= 3 ? 24 : numPieces <= 4 ? 20 : 16;

  for (let i = 0; i < numPieces; i++) {
    let bestX = 50;
    let bestY = 50;
    let maxMinDist = -1;

    // We can do up to 250 attempts to find coordinates that satisfy the minDistancePercent criteria.
    for (let attempt = 0; attempt < 250; attempt++) {
      const rx = minX + Math.random() * (maxX - minX);
      const ry = minY + Math.random() * (maxY - minY);
      
      // Let's avoid exact center so the parts look beautifully scattered and not already half-solved.
      const distToCenter = Math.hypot(rx - 50, ry - 50);
      if (distToCenter < 6) continue;

      let currentMinD = Infinity;
      for (const pos of positions) {
        const d = Math.hypot(rx - pos.x, ry - pos.y);
        if (d < currentMinD) {
          currentMinD = d;
        }
      }

      if (currentMinD >= minDistancePercent) {
        bestX = rx;
        bestY = ry;
        maxMinDist = currentMinD;
        break;
      } else {
        if (currentMinD > maxMinDist) {
          maxMinDist = currentMinD;
          bestX = rx;
          bestY = ry;
        }
      }
    }

    positions.push({ x: bestX, y: bestY });
  }

  return positions;
}

interface SliceDef {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  excludeCenter?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

function getSliceDefinitions(kanji: string, partsCount: number): SliceDef[] {
  // Hardcoded mappings for the preloaded/default quizzes to be 100% accurate
  if (kanji === '森' && partsCount === 3) {
    return [
      { x1: 5, y1: 5, x2: 95, y2: 48 },      // Top 木
      { x1: 5, y1: 48, x2: 50, y2: 95 },     // Left 木
      { x1: 50, y1: 48, x2: 95, y2: 95 },    // Right 木
    ];
  }
  if (kanji === '森' && partsCount === 2) {
    return [
      { x1: 5, y1: 5, x2: 95, y2: 48 },      // Top 木
      { x1: 5, y1: 48, x2: 95, y2: 95 },     // Bottom 林
    ];
  }
  if (kanji === '語' && partsCount === 3) {
    return [
      { x1: 5, y1: 5, x2: 46, y2: 95 },      // Left 言
      { x1: 46, y1: 5, x2: 95, y2: 50 },     // Top-right 五
      { x1: 46, y1: 50, x2: 95, y2: 95 },    // Bottom-right 口
    ];
  }
  if (kanji === '鳴' && partsCount === 2) {
    return [
      { x1: 5, y1: 5, x2: 46, y2: 95 },      // Left 口
      { x1: 46, y1: 5, x2: 95, y2: 95 },     // Right 鳥
    ];
  }
  if (kanji === '働' && partsCount === 3) {
    return [
      { x1: 5, y1: 5, x2: 34, y2: 95 },      // Left 人
      { x1: 34, y1: 5, x2: 67, y2: 95 },     // Center 重
      { x1: 67, y1: 5, x2: 95, y2: 95 },     // Right 力
    ];
  }
  if (kanji === '鉄' && partsCount === 2) {
    return [
      { x1: 5, y1: 5, x2: 48, y2: 95 },      // Left 金
      { x1: 48, y1: 5, x2: 95, y2: 95 },     // Right 失
    ];
  }
  if (kanji === '物' && partsCount === 2) {
    return [
      { x1: 5, y1: 5, x2: 46, y2: 95 },      // Left 牛
      { x1: 46, y1: 5, x2: 95, y2: 95 },     // Right 勿
    ];
  }
  if (kanji === '解' && partsCount === 3) {
    return [
      { x1: 5, y1: 5, x2: 50, y2: 95 },      // Left 角
      { x1: 50, y1: 5, x2: 95, y2: 52 },     // Top-right 刀
      { x1: 50, y1: 52, x2: 95, y2: 95 },    // Bottom-right 牛
    ];
  }
  if (kanji === '聞' && partsCount === 2) {
    return [
      { x1: 5, y1: 5, x2: 95, y2: 95, excludeCenter: { x1: 28, y1: 34, x2: 72, y2: 98 } }, // Outer 門
      { x1: 28, y1: 34, x2: 72, y2: 98 },    // Inner 耳
    ];
  }
  if (kanji === '競' && partsCount === 4) {
    return [
      { x1: 5, y1: 5, x2: 50, y2: 48 },      // Left-top 立
      { x1: 5, y1: 48, x2: 50, y2: 95 },     // Left-bottom 兄
      { x1: 50, y1: 5, x2: 95, y2: 48 },     // Right-top 立
      { x1: 50, y1: 48, x2: 95, y2: 95 },    // Right-bottom 兄
    ];
  }
  if (kanji === '曜' && partsCount === 4) {
    return [
      { x1: 5, y1: 5, x2: 29, y2: 95 },      // Left 日
      { x1: 29, y1: 5, x2: 64, y2: 48 },     // Center-top ヨ
      { x1: 29, y1: 48, x2: 64, y2: 95 },    // Center-bottom ヨ
      { x1: 64, y1: 5, x2: 95, y2: 95 },     // Right 隹
    ];
  }
  if (kanji === '露' && partsCount === 3) {
    return [
      { x1: 5, y1: 5, x2: 95, y2: 42 },      // Top 雨
      { x1: 5, y1: 42, x2: 50, y2: 95 },     // Bottom-left 足
      { x1: 50, y1: 42, x2: 95, y2: 95 },    // Bottom-right 各
    ];
  }
  if (kanji === '鬱' && partsCount === 6) {
    return [
      { x1: 2, y1: 2, x2: 36, y2: 35 },      // Top-left 木
      { x1: 36, y1: 2, x2: 64, y2: 35 },     // Top-center 缶
      { x1: 64, y1: 2, x2: 98, y2: 35 },     // Top-right 木
      { x1: 2, y1: 35, x2: 98, y2: 50 },     // Middle 冖
      { x1: 2, y1: 50, x2: 66, y2: 98 },     // Bottom-left 鬯
      { x1: 66, y1: 50, x2: 98, y2: 98 },    // Bottom-right 彡
    ];
  }

  // --- Dynamic fallback slicing generator for user/generated kanjis ---
  const count = partsCount;
  const defs: SliceDef[] = [];

  if (count <= 1) {
    defs.push({ x1: 5, y1: 5, x2: 95, y2: 95 });
  } else if (count === 2) {
    defs.push({ x1: 5, y1: 5, x2: 48, y2: 95 });
    defs.push({ x1: 48, y1: 5, x2: 95, y2: 95 });
  } else if (count === 3) {
    defs.push({ x1: 5, y1: 5, x2: 46, y2: 95 });
    defs.push({ x1: 46, y1: 5, x2: 95, y2: 50 });
    defs.push({ x1: 46, y1: 50, x2: 95, y2: 95 });
  } else if (count === 4) {
    defs.push({ x1: 5, y1: 5, x2: 50, y2: 50 });
    defs.push({ x1: 50, y1: 5, x2: 95, y2: 50 });
    defs.push({ x1: 5, y1: 50, x2: 50, y2: 95 });
    defs.push({ x1: 50, y1: 50, x2: 95, y2: 95 });
  } else {
    for (let i = 0; i < count; i++) {
      const xStart = 5 + (i / count) * 90;
      const xEnd = 5 + ((i + 1) / count) * 90;
      defs.push({ x1: xStart, y1: 5, x2: xEnd, y2: 95 });
    }
  }

  return defs;
}

interface Pixel {
  x: number;
  y: number;
}

function getConnectedComponents(imgData: ImageData): Pixel[][] {
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;
  const visited = new Uint8Array(width * height);
  const components: Pixel[][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      // Alpha threshold > 25
      if (data[idx * 4 + 3] > 25 && visited[idx] === 0) {
        const comp: Pixel[] = [];
        const stack: number[] = [idx];
        visited[idx] = 1;

        while (stack.length > 0) {
          const currIdx = stack.pop()!;
          const currX = currIdx % width;
          const currY = Math.floor(currIdx / width);
          comp.push({ x: currX, y: currY });

          // Check 8-connected neighbors
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = currX + dx;
              const ny = currY + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = ny * width + nx;
                if (data[nidx * 4 + 3] > 25 && visited[nidx] === 0) {
                  visited[nidx] = 1;
                  stack.push(nidx);
                }
              }
            }
          }
        }

        if (comp.length >= 3) {
          components.push(comp);
        }
      }
    }
  }
  return components;
}

const speakReading = (quiz: KanjiQuiz) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      
      const onyomiText = quiz.onyomi || quiz.reading.split(/[、/,\s]/)[0];
      const kunyomiText = quiz.kunyomi || quiz.reading.split(/[、/,\s]/).slice(1).join('、');
      
      let speechParts: string[] = [];
      speechParts.push(`${quiz.kanji}。`);
      
      if (onyomiText && onyomiText !== '—' && onyomiText.trim() !== '') {
        speechParts.push(`${onyomiText}。`);
      }
      if (kunyomiText && kunyomiText !== '—' && kunyomiText.trim() !== '') {
        speechParts.push(`${kunyomiText}。`);
      }
      
      if (quiz.meaning) {
        speechParts.push(`${quiz.meaning}。`);
      }
      
      if (quiz.exampleWords && quiz.exampleWords.length > 0) {
        quiz.exampleWords.forEach((wordObj) => {
          speechParts.push(wordObj.word);
          if (wordObj.meaning) {
            speechParts.push(`、${wordObj.meaning}`);
          }
          speechParts.push(`。`);
        });
      }
      
      const fullText = speechParts.join(' ').replace(/[-]/g, '').replace(/[、/／,\s]+/g, '、');
      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find((v) => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
      if (jaVoice) {
        utterance.voice = jaVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech synthesis failed', e);
    }
  }
};

// Helper to get matching threshold bounds dynamically based on piece count
const getThresholds = (numPieces: number) => {
  let maxThreshold = 9.25;
  let avgThreshold = 9.25;

  if (numPieces <= 2) {
    // 2 parts: strict limit since two elements naturally align easily.
    maxThreshold = 4.5;
    avgThreshold = 4.25;
  } else if (numPieces === 3) {
    // 3 parts: tailored balanced limit for mixed lenient/strict.
    maxThreshold = 6.75;
    avgThreshold = 5.25;
  } else if (numPieces === 4) {
    // 4 parts
    maxThreshold = 8.0;
    avgThreshold = 6.25;
  } else if (numPieces === 5) {
    // 5 parts
    maxThreshold = 9.0;
    avgThreshold = 7.0;
  } else {
    // 6 or more parts (e.g. 鬱)
    maxThreshold = 10.25;
    avgThreshold = 7.5;
  }
  return {
    maxThreshold: maxThreshold * 0.9,
    avgThreshold: avgThreshold * 0.9,
  };
};

export default function PlayTable({ quiz, onCorrect, onNext, onBack }: PlayTableProps) {
  const [guess, setGuess] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [hintLevel, setHintLevel] = useState<number>(0); // 0 = none, 1 = reading, 2 = meaning, 3 = detailed text
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showDebugMarkers, setShowDebugMarkers] = useState(false);
  const playZoneRef = useRef<HTMLDivElement>(null);

  const pieceDragHandlesRef = useRef<{ [pieceId: string]: (e: React.PointerEvent<HTMLDivElement>) => void }>({});

  const handleTransparentClick = (e: React.PointerEvent<HTMLDivElement>, currentPieceId: string) => {
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of elements) {
      const pId = el.getAttribute('data-piece-id');
      if (pId && pId !== currentPieceId) {
        const targetPiece = pieces.find(p => p.id === pId);
        if (targetPiece) {
          if (checkIsSolidAtPoint(e.clientX, e.clientY, el, targetPiece)) {
            pieceDragHandlesRef.current[pId]?.(e);
            break;
          }
        }
      }
    }
  };

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Exclude button inputs, hint menus, skip keys or other sub-controls to avoid side-effects
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
      return;
    }

    // Check if any piece's actual solid stroke is under the pointer.
    let solidPieceFound = false;
    if (playZoneRef.current) {
      for (const piece of pieces) {
        const el = playZoneRef.current.querySelector(`[data-piece-id="${piece.id}"]`);
        if (el && checkIsSolidAtPoint(e.clientX, e.clientY, el, piece)) {
          solidPieceFound = true;
          break;
        }
      }
    }

    // If there's a solid piece under the pointer, we let the native KanjiPiece component's handler trigger drag.
    if (solidPieceFound) {
      return;
    }

    // If we clicked/touched on empty space or a transparent part, let's find the nearest piece.
    // This implements a general "expanded touch hitbox".
    if (playZoneRef.current && pieces.length > 0) {
      let nearestPiece: Piece | null = null;
      let minDistance = Infinity;

      for (const piece of pieces) {
        const el = playZoneRef.current.querySelector(`[data-piece-id="${piece.id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
          if (dist < minDistance) {
            minDistance = dist;
            nearestPiece = piece;
          }
        }
      }

      // Max touch detection expansion range of 280 pixels around a piece's center (extremely generous, yet localized).
      if (nearestPiece && minDistance < 280) {
        pieceDragHandlesRef.current[nearestPiece.id]?.(e);
      }
    }
  };

  // Stats
  useEffect(() => {
    setGuess('');
    setIsCorrect(false);
    setHintLevel(0);
    setTimeSpent(0);
    setIsLoaded(false);

    const loadGame = async () => {
      try {
        const unicodeHex = quiz.kanji.charCodeAt(0).toString(16).toLowerCase();
        const paddedHex = unicodeHex.padStart(5, '0');
        const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${paddedHex}.svg`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch KanjiVG');
        const svgText = await response.text();
        
        // Parse the SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        
        // Find all stroke path elements whose id starts with 'kvg:'
        const allPaths = Array.from(svgDoc.querySelectorAll('path'));
        const strokePaths = allPaths.filter(p => p.getAttribute('id')?.startsWith('kvg:'));
        
        if (strokePaths.length === 0) {
          throw new Error('No stroke paths found in KanjiVG');
        }

        // Limit the number of parts automatically if it exceeds the stroke count of the Kanji (画数)
        const strokeCount = strokePaths.length;
        const activeParts = quiz.parts.length > strokeCount ? quiz.parts.slice(0, strokeCount) : quiz.parts;

        const defs = getSliceDefinitions(quiz.kanji, activeParts.length);

        // Map vector paths so we can measure coordinates and sample positions
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.setAttribute('viewBox', '0 0 109 109');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '109px';
        tempSvg.style.height = '109px';
        tempSvg.style.pointerEvents = 'none';
        document.body.appendChild(tempSvg);

        const loadedPaths = strokePaths.map((p) => {
          const d = p.getAttribute('d') || '';
          
          const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pathEl.setAttribute('d', d);
          tempSvg.appendChild(pathEl);
          
          let bbox = { x: 0, y: 0, width: 0, height: 0 };
          let length = 0;
          try {
            bbox = pathEl.getBBox();
            length = pathEl.getTotalLength();
          } catch (e) {
            // sandbox/iframe layout rendering fallback
          }

          const points: { x: number; y: number }[] = [];
          if (length > 0) {
            for (let i = 0; i <= 4; i++) {
              try {
                const pt = pathEl.getPointAtLength((i / 4) * length);
                points.push({ x: pt.x, y: pt.y });
              } catch (e) {}
            }
          }
          
          if (points.length === 0) {
            points.push({ x: bbox.x, y: bbox.y });
            points.push({ x: bbox.x + bbox.width, y: bbox.y + bbox.height });
            points.push({ x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 });
          }

          return {
            id: p.getAttribute('id') || `s-${Math.random()}`,
            d,
            bbox,
            points,
            element: p,
          };
        });

        document.body.removeChild(tempSvg);

        const getKvgElement = (el: Element): string | null => {
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            if (attr.name === 'kvg:element' || attr.localName === 'element') {
              return attr.value;
            }
          }
          return null;
        };

        const isElementMatch = (kvgElem: string | null, part: string): boolean => {
          if (!kvgElem) return false;
          if (kvgElem === part) return true;
          
          const normalize = (s: string) => s.trim();
          const normKvg = normalize(kvgElem);
          const normPart = normalize(part);
          if (normKvg === normPart) return true;

          const mapping: { [key: string]: string[] } = {
            '人': ['人', '亻', '𠆢', '入', '亼'],
            '金': ['金', '钅', '釒'],
            '水': ['水', '氵', '氺'],
            '手': ['手', '扌', '龵'],
            '心': ['心', '忄', '⺗'],
            '火': ['火', '灬'],
            '牛': ['牛', '牜', '⺧'],
            '刀': ['刀', '刂', '⺈'],
            '示': ['示', '礻'],
            '衣': ['衣', '衤'],
            '犬': ['犬', '犭'],
            '玉': ['玉', '王', '⺩'],
            '王': ['王', '玉', '⺩'],
            '足': ['足', '⻊'],
            '言': ['言', '讠'],
            '日': ['日', '曰'],
            '月': ['月', '⺼'],
            '肉': ['肉', '⺼', '月'],
            '糸': ['糸', '纟'],
            '艸': ['艸', '艹', '⺾'],
            '艹': ['艹', '艸', '⺾'],
            '辶': ['辶', '辵'],
            '阜': ['阜', '阝'],
            '邑': ['邑', '阝'],
            '阝': ['阝', '阜', '邑'],
            'ヨ': ['ヨ', '⺕'],
          };

          const variants = mapping[normPart];
          if (variants && variants.includes(normKvg)) {
            return true;
          }
          
          const kvgVariants = mapping[normKvg];
          if (kvgVariants && kvgVariants.includes(normPart)) {
            return true;
          }

          return false;
        };

        // Distribute paths to slices
        const slicePaths: typeof loadedPaths[] = Array.from({ length: activeParts.length }, () => []);

        loadedPaths.forEach((stroke) => {
          const scores = Array(activeParts.length).fill(0);
          
          stroke.points.forEach((pt) => {
            const px = (pt.x / 109) * 100;
            const py = (pt.y / 109) * 100;

            defs.forEach((def, sIdx) => {
              if (sIdx >= activeParts.length) return;
              let inside = px >= def.x1 && px <= def.x2 && py >= def.y1 && py <= def.y2;
              if (inside && def.excludeCenter) {
                if (px >= def.excludeCenter.x1 && px <= def.excludeCenter.x2 &&
                    py >= def.excludeCenter.y1 && py <= def.excludeCenter.y2) {
                  inside = false;
                }
              }
              if (inside) {
                scores[sIdx]++;
              }
            });
          });

          const centerDists = defs.map((def) => {
            const cx = (def.x1 + def.x2) / 2;
            const cy = (def.y1 + def.y2) / 2;
            const strokeCX = (stroke.bbox.x + stroke.bbox.width / 2) / 1.09;
            const strokeCY = (stroke.bbox.y + stroke.bbox.height / 2) / 1.09;
            return Math.hypot(strokeCX - cx, strokeCY - cy);
          });

          // Resolve semantic annotations using ancestor folders
          const semanticallyMatchedIndices: number[] = [];
          let current: Element | null = stroke.element.parentElement;
          while (current && current.tagName !== 'svg') {
            const kvgElem = getKvgElement(current);
            if (kvgElem) {
              activeParts.forEach((part, idx) => {
                if (isElementMatch(kvgElem, part)) {
                  if (!semanticallyMatchedIndices.includes(idx)) {
                    semanticallyMatchedIndices.push(idx);
                  }
                }
              });
            }
            current = current.parentElement;
          }

          const candidates = semanticallyMatchedIndices.length > 0
            ? semanticallyMatchedIndices
            : Array.from({ length: activeParts.length }, (_, i) => i);

          let bestSIdx = -1;
          let maxScore = -1;

          candidates.forEach((i) => {
            if (scores[i] > maxScore) {
              maxScore = scores[i];
              bestSIdx = i;
            } else if (scores[i] === maxScore && bestSIdx !== -1) {
              if (centerDists[i] < centerDists[bestSIdx]) {
                bestSIdx = i;
              }
            }
          });

          if (bestSIdx === -1 && candidates.length > 0) {
            bestSIdx = candidates[0];
            let minDist = Infinity;
            candidates.forEach((idx) => {
              if (centerDists[idx] < minDist) {
                minDist = centerDists[idx];
                bestSIdx = idx;
              }
            });
          }

          if (bestSIdx === -1) {
            bestSIdx = 0;
          }

          slicePaths[bestSIdx].push(stroke);
        });

        // Safe fallback for empty slices: steal a stroke to ensure engagement
        for (let sIdx = 0; sIdx < activeParts.length; sIdx++) {
          if (slicePaths[sIdx].length === 0) {
            const defEmpty = defs[sIdx];
            const emptyCX = (defEmpty.x1 + defEmpty.x2) / 2;
            const emptyCY = (defEmpty.y1 + defEmpty.y2) / 2;

            let candidateStroke: typeof loadedPaths[0] | null = null;
            let bestSourceSIdx = -1;
            let minDist = Infinity;

            for (let srcIdx = 0; srcIdx < activeParts.length; srcIdx++) {
              if (srcIdx !== sIdx && slicePaths[srcIdx].length > 1) {
                slicePaths[srcIdx].forEach((stroke) => {
                  const scx = (stroke.bbox.x + stroke.bbox.width / 2) / 1.09;
                  const scy = (stroke.bbox.y + stroke.bbox.height / 2) / 1.09;
                  const d = Math.hypot(scx - emptyCX, scy - emptyCY);
                  if (d < minDist) {
                    minDist = d;
                    candidateStroke = stroke;
                    bestSourceSIdx = srcIdx;
                  }
                });
              }
            }

            if (candidateStroke && bestSourceSIdx !== -1) {
              slicePaths[bestSourceSIdx] = slicePaths[bestSourceSIdx].filter(s => s.id !== candidateStroke!.id);
              slicePaths[sIdx].push(candidateStroke);
            }
          }
        }

        // Generate vector pieces
        const scatteredPositions = getNonOverlappingPositions(activeParts.length);
        const initialPieces = activeParts.map((p, idx) => {
          const rotate = 0;
          const scale = 1.0;

          const strokes = slicePaths[idx];

          // Calculate precise bounding box of coordinates
          let minX = 109;
          let maxX = 0;
          let minY = 109;
          let maxY = 0;

          const allPoints = strokes.flatMap((s) => s.points);
          if (allPoints.length > 0) {
            allPoints.forEach((pt) => {
              if (pt.x < minX) minX = pt.x;
              if (pt.x > maxX) maxX = pt.x;
              if (pt.y < minY) minY = pt.y;
              if (pt.y > maxY) maxY = pt.y;
            });
          } else {
            const def = defs[idx] || { x1: 5, y1: 5, x2: 95, y2: 95 };
            minX = (def.x1 / 100) * 109;
            maxX = (def.x2 / 100) * 109;
            minY = (def.y1 / 100) * 109;
            maxY = (def.y2 / 100) * 109;
          }

          // Add padding so lines of 6.2 stroke-width aren't clipped, small enough so the HTML container fits the stroke tightly
          const padding = 10.0;
          const pMinX = minX - padding;
          const pMaxX = maxX + padding;
          const pMinY = minY - padding;
          const pMaxY = maxY + padding;

          const bboxW = pMaxX - pMinX;
          const bboxH = pMaxY - pMinY;

          // Scale factor 1.0 represents the exact proportions of the target Kanji template
          const displayScale = 0.5;
          const widthPct = (bboxW / 109) * 100 * displayScale;
          const heightPct = (bboxH / 109) * 100 * displayScale;

          // Target coordinate is the true, unclipped center of this bounding box, scaled by displayScale relative to 50% center
          const rawCorrectX = ((pMinX + pMaxX) / 2 / 109) * 100;
          const rawCorrectY = ((pMinY + pMaxY) / 2 / 109) * 100;
          const correctX = 50 + (rawCorrectX - 50) * displayScale;
          const correctY = 50 + (rawCorrectY - 50) * displayScale;

          let imageDataUrl = '';

          if (strokes.length > 0) {
            const strokeColor = '#1E1B4B';
            // Scale and shift viewBox so that the bounding box fills exactly 100% of the SVG bounds
            const pieceSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${pMinX} ${pMinY} ${bboxW} ${bboxH}">
  <g style="fill:none;stroke:${strokeColor};stroke-width:6.2;stroke-linecap:round;stroke-linejoin:round;">
    ${strokes.map((s) => `<path d="${s.d}" />`).join('\n')}
  </g>
</svg>
`.trim();

            imageDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(pieceSvg)}`;
          }

          const pieceId = `piece-${idx}-${Date.now()}`;
          const pos = scatteredPositions[idx];
          const newPiece: Piece = {
            id: pieceId,
            char: p,
            originalIndex: idx,
            x: pos.x,
            y: pos.y,
            correctX,
            correctY,
            widthPct,
            heightPct,
            rotate,
            scale,
            imageDataUrl,
          };

          // Generate HitMask asynchronously
          if (imageDataUrl) {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 100;
              canvas.height = 100;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, 100, 100);
                const imgData = ctx.getImageData(0, 0, 100, 100);
                const data = imgData.data;
                const mask = new Uint8Array(100 * 100);
                for (let i = 0; i < 100 * 100; i++) {
                  mask[i] = data[i * 4 + 3];
                }
                setPieces((prev) =>
                  prev.map((item) => (item.id === pieceId ? { ...item, hitMask: mask } : item))
                );
              }
            };
            img.src = imageDataUrl;
          }

          return newPiece;
        });

        setPieces(initialPieces);
        setIsLoaded(true);
        console.log('Successfully generated vector stroke-order split pieces via KanjiVG!');
        return;
      } catch (error) {
        console.warn('KanjiVG fetch/split failed, executing pixel fallback:', error);
      }

      executePixelFallback();
    };

    const executePixelFallback = () => {
      // Create the full-glyphe canvas in memory
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.clearRect(0, 0, 400, 400);
        ctx.font = '900 285px "Shippori Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", "Georgia", serif';
        ctx.fillStyle = '#1E1B4B'; // Slate Velvet Indigo
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(quiz.kanji, 200, 203);
      }

      // Get all connected components
      let components: Pixel[][] = [];
      if (ctx) {
        const imgData = ctx.getImageData(0, 0, 400, 400);
        components = getConnectedComponents(imgData);
      }

      // Automatically limit the fallback division to the visual component count if parts count exceeds it
      const componentCount = components.length > 0 ? components.length : 1;
      const activePartsFallback = quiz.parts.length > componentCount ? quiz.parts.slice(0, componentCount) : quiz.parts;

      const defs = getSliceDefinitions(quiz.kanji, activePartsFallback.length);

      // Group components into slices based on overlap with the SliceDef boxes
      const sliceComponents: Pixel[][][] = Array.from({ length: activePartsFallback.length }, () => []);

      components.forEach((comp) => {
        // For this component, compute the distribution across slices
        const counts = Array(activePartsFallback.length).fill(0);
        let totalInBoxes = 0;

        comp.forEach((p) => {
          let assignedToAnyBox = false;
          defs.forEach((def, sIdx) => {
            if (sIdx >= activePartsFallback.length) return;
            const sx1 = (def.x1 / 100) * 400;
            const sy1 = (def.y1 / 100) * 400;
            const sx2 = (def.x2 / 100) * 400;
            const sy2 = (def.y2 / 100) * 400;

            let inside = p.x >= sx1 && p.x <= sx2 && p.y >= sy1 && p.y <= sy2;
            if (inside && def.excludeCenter) {
              const exX1 = (def.excludeCenter.x1 / 100) * 400;
              const exY1 = (def.excludeCenter.y1 / 100) * 400;
              const exX2 = (def.excludeCenter.x2 / 100) * 400;
              const exY2 = (def.excludeCenter.y2 / 100) * 400;
              if (p.x >= exX1 && p.x <= exX2 && p.y >= exY1 && p.y <= exY2) {
                inside = false;
              }
            }
            if (inside) {
              counts[sIdx]++;
              assignedToAnyBox = true;
            }
          });
          if (assignedToAnyBox) {
            totalInBoxes++;
          }
        });

        // Find the slice with the maximum count of pixels
        let maxCount = -1;
        let maxSIdx = 0;
        counts.forEach((cnt, sIdx) => {
          if (cnt > maxCount) {
            maxCount = cnt;
            maxSIdx = sIdx;
          }
        });

        // If the component is heavily concentrated inside one slice's boundary (>=82% of its inside-box pixels belong to maxSIdx)
        // and it doesn't clearly span across other slices as a merged entity.
        const threshold = 0.82;
        if (maxCount >= totalInBoxes * threshold && maxCount > 0) {
          // Assign the ENTIRE component directly to maxSIdx, maintaining absolute stroke integrity
          sliceComponents[maxSIdx].push(comp);
        } else {
          // This is a merged component due to overlapping font rendering! 
          // Run a geodesic BFS to split it along the actual stroke connection bottlenecks.
          const activeSlices: number[] = [];
          defs.forEach((_, sIdx) => {
            if (sIdx >= activePartsFallback.length) return;
            // Only split to slices with substantial overlaps (at least 5% of total inside points OR at least 20 pixels)
            if (counts[sIdx] > totalInBoxes * 0.05 || counts[sIdx] > 20) {
              activeSlices.push(sIdx);
            }
          });

          // Fallback: if activeSlices is empty, just use the maxSIdx
          if (activeSlices.length === 0) {
            activeSlices.push(maxSIdx);
          }

          // Find unique start seeds for each active slice
          const seeds: { [sIdx: number]: Pixel } = {};
          const chosenSeedKeys = new Set<number>();

          activeSlices.forEach((sIdx) => {
            const def = defs[sIdx];
            const sCenterX = ((def.x1 + def.x2) / 2 / 100) * 400;
            const sCenterY = ((def.y1 + def.y2) / 2 / 100) * 400;

            let bestPixel: Pixel | null = null;
            let minDist = Infinity;

            comp.forEach((p) => {
              const pKey = p.y * 400 + p.x;
              if (chosenSeedKeys.has(pKey)) return;
              const dist = Math.hypot(p.x - sCenterX, p.y - sCenterY);
              if (dist < minDist) {
                minDist = dist;
                bestPixel = p;
              }
            });

            if (!bestPixel && comp.length > 0) {
              bestPixel = comp[0];
            }

            if (bestPixel) {
              seeds[sIdx] = bestPixel;
              chosenSeedKeys.add(bestPixel.y * 400 + bestPixel.x);
            }
          });

          // Set up grid states for BFS
          const isCompPixel = new Uint8Array(400 * 400);
          comp.forEach((p) => {
            isCompPixel[p.y * 400 + p.x] = 1;
          });

          const assigned = new Uint8Array(400 * 400);
          assigned.fill(255); // 255 represents unassigned

          const Q: Pixel[] = [];

          Object.keys(seeds).forEach((sKey) => {
            const sIdx = Number(sKey);
            const sPixel = seeds[sIdx];
            const idx = sPixel.y * 400 + sPixel.x;
            assigned[idx] = sIdx;
            Q.push(sPixel);
          });

          // Multi-source BFS inside the connected component's grid
          while (Q.length > 0) {
            const curr = Q.shift()!;
            const currIdx = curr.y * 400 + curr.x;
            const s = assigned[currIdx];

            // 8-connected neighbors
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = curr.x + dx;
                const ny = curr.y + dy;
                if (nx >= 0 && nx < 400 && ny >= 0 && ny < 400) {
                  const nidx = ny * 400 + nx;
                  if (isCompPixel[nidx] === 1 && assigned[nidx] === 255) {
                    assigned[nidx] = s;
                    Q.push({ x: nx, y: ny });
                  }
                }
              }
            }
          }

          // Gather final split pixel groups corresponding to each slice
          const pixelSubComps = Array.from({ length: activePartsFallback.length }, () => [] as Pixel[]);
          comp.forEach((p) => {
            const idx = p.y * 400 + p.x;
            const s = assigned[idx];
            if (s !== 255 && s < activePartsFallback.length) {
              pixelSubComps[s].push(p);
            } else {
              // Unreached pixels fallback
              pixelSubComps[maxSIdx].push(p);
            }
          });

          // Add each subcomponent segment containing pixels to the slice components
          pixelSubComps.forEach((subComp, sIdx) => {
            if (subComp.length > 0) {
              sliceComponents[sIdx].push(subComp);
            }
          });
        }
      });

      // Safeguard to ensure every slice has at least one pixel component (prevents empty/blank pieces on table)
      for (let sIdx = 0; sIdx < activePartsFallback.length; sIdx++) {
        if (sliceComponents[sIdx].length === 0) {
          // Find a different slice that contains a healthy amount of pixels to borrow from
          let sourceSIdx = -1;
          for (let j = 0; j < activePartsFallback.length; j++) {
            if (sliceComponents[j].length > 0) {
              let totalPixelsInSlide = 0;
              sliceComponents[j].forEach((c) => totalPixelsInSlide += c.length);
              if (totalPixelsInSlide > 50) {
                sourceSIdx = j;
                break;
              }
            }
          }

          if (sourceSIdx >= 0) {
            const sourceComps = sliceComponents[sourceSIdx];
            const emptyDef = defs[sIdx] || { x1: 5, y1: 5, x2: 95, y2: 95 };
            const sCenterX_val = ((emptyDef.x1 + emptyDef.x2) / 2 / 100) * 400;
            const sCenterY_val = ((emptyDef.y1 + emptyDef.y2) / 2 / 100) * 400;

            if (sourceComps.length > 1) {
              // Multiple independent components exist inside the source slice. Great!
              // We can move a whole uncut component to the empty slice to maintain 100% stroke integrity.
              let bestCompIdx = 0;
              let minDistance = Infinity;

              sourceComps.forEach((comp, cIdx) => {
                let sumX = 0, sumY = 0;
                comp.forEach((p) => {
                  sumX += p.x;
                  sumY += p.y;
                });
                const centerX = sumX / comp.length;
                const centerY = sumY / comp.length;
                const dist = Math.hypot(centerX - sCenterX_val, centerY - sCenterY_val);
                if (dist < minDistance) {
                  minDistance = dist;
                  bestCompIdx = cIdx;
                }
              });

              const compToMove = sourceComps[bestCompIdx];
              sliceComponents[sourceSIdx] = sourceComps.filter((_, idx) => idx !== bestCompIdx);
              sliceComponents[sIdx].push(compToMove);
            } else if (sourceComps.length === 1) {
              // Only a single connected component is present in the source slice.
              // We must partition it. Let's do a stroke-respecting BFS geodesic split.
              const compToSplit = sourceComps[0];
              const srcDef = defs[sourceSIdx] || { x1: 5, y1: 5, x2: 95, y2: 95 };
              const srcCenterX = ((srcDef.x1 + srcDef.x2) / 2 / 100) * 400;
              const srcCenterY = ((srcDef.y1 + srcDef.y2) / 2 / 100) * 400;

              // Find seed A (closest to source slice center)
              let seedA = compToSplit[0];
              let minDistA = Infinity;
              // Find seed B (closest to empty slice center)
              let seedB = compToSplit[0];
              let minDistB = Infinity;

              compToSplit.forEach((p) => {
                const distA = Math.hypot(p.x - srcCenterX, p.y - srcCenterY);
                if (distA < minDistA) {
                  minDistA = distA;
                  seedA = p;
                }
                const distB = Math.hypot(p.x - sCenterX_val, p.y - sCenterY_val);
                if (distB < minDistB) {
                  minDistB = distB;
                  seedB = p;
                }
              });

              // Ensure unique seed coordinates
              if (seedA.x === seedB.x && seedA.y === seedB.y && compToSplit.length > 1) {
                let secondBestB = compToSplit[0];
                let secondMinDistB = Infinity;
                compToSplit.forEach((p) => {
                  if (p.x === seedA.x && p.y === seedA.y) return;
                  const distB = Math.hypot(p.x - sCenterX_val, p.y - sCenterY_val);
                  if (distB < secondMinDistB) {
                    secondMinDistB = distB;
                    secondBestB = p;
                  }
                });
                seedB = secondBestB;
              }

              // Run BFS inside compToSplit using seedA and seedB
              const isCompPixel = new Uint8Array(400 * 400);
              compToSplit.forEach((p) => {
                isCompPixel[p.y * 400 + p.x] = 1;
              });

              const assigned = new Uint8Array(400 * 400);
              assigned.fill(255);

              assigned[seedA.y * 400 + seedA.x] = 0; // sourceSIdx group
              assigned[seedB.y * 400 + seedB.x] = 1; // target empty sIdx group

              const Q: Pixel[] = [seedA, seedB];

              while (Q.length > 0) {
                const curr = Q.shift()!;
                const currIdx = curr.y * 400 + curr.x;
                const s = assigned[currIdx];

                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = curr.x + dx;
                    const ny = curr.y + dy;
                    if (nx >= 0 && nx < 400 && ny >= 0 && ny < 400) {
                      const nidx = ny * 400 + nx;
                      if (isCompPixel[nidx] === 1 && assigned[nidx] === 255) {
                        assigned[nidx] = s;
                        Q.push({ x: nx, y: ny });
                      }
                    }
                  }
                }
              }

              const keptPixels: Pixel[] = [];
              const movedPixels: Pixel[] = [];

              compToSplit.forEach((p) => {
                const sVal = assigned[p.y * 400 + p.x];
                if (sVal === 1) {
                  movedPixels.push(p);
                } else {
                  keptPixels.push(p);
                }
              });

              if (keptPixels.length > 0 && movedPixels.length > 0) {
                sliceComponents[sourceSIdx] = [keptPixels];
                sliceComponents[sIdx] = [movedPixels];
              } else {
                // Standby standard division
                const half = Math.floor(compToSplit.length / 2);
                sliceComponents[sourceSIdx] = [compToSplit.slice(0, half)];
                sliceComponents[sIdx] = [compToSplit.slice(half)];
              }
            }
          }
        }
      }

      // Dynamic generation of scattered parts inside the virtual tray
      const scatteredPositions = getNonOverlappingPositions(activePartsFallback.length);
      const initialPieces = activePartsFallback.map((p, idx) => {
        const def = defs[idx] || { x1: 5, y1: 5, x2: 95, y2: 95 };

        const rotate = 0;
        const scale = 1.0;

        let imageDataUrl = '';

        let hasPixels = false;
        const currentSliceComps = sliceComponents[idx] || [];
        currentSliceComps.forEach((comp) => {
          if (comp.length > 0) hasPixels = true;
        });

        // 1. Calculate bounding box of this piece (400x400 coordinates)
        let minX = 400;
        let maxX = 0;
        let minY = 400;
        let maxY = 0;

        if (hasPixels) {
          currentSliceComps.forEach((comp) => {
            comp.forEach((pt) => {
              if (pt.x < minX) minX = pt.x;
              if (pt.x > maxX) maxX = pt.x;
              if (pt.y < minY) minY = pt.y;
              if (pt.y > maxY) maxY = pt.y;
            });
          });
        } else {
          minX = (def.x1 / 100) * 400;
          maxX = (def.x2 / 100) * 400;
          minY = (def.y1 / 100) * 400;
          maxY = (def.y2 / 100) * 400;
        }

        // Add 24 pixels padding to prevent anti-aliased edge clipping and keep exact symmetry
        const pad = 24;
        const pMinX = minX - pad;
        const pMaxX = maxX + pad;
        const pMinY = minY - pad;
        const pMaxY = maxY + pad;

        const cropW = pMaxX - pMinX;
        const cropH = pMaxY - pMinY;

        // Scale factor 1.0 represents the exact proportions of the canvas
        const displayScale = 0.5;
        const widthPct = (cropW / 400) * 100 * displayScale;
        const heightPct = (cropH / 400) * 100 * displayScale;

        // Visual layout target position (relative center of the bounding box), scaled by displayScale relative to 50% center
        const rawCorrectX = ((pMinX + pMaxX) / 2 / 400) * 100;
        const rawCorrectY = ((pMinY + pMaxY) / 2 / 400) * 100;
        const correctX = 50 + (rawCorrectX - 50) * displayScale;
        const correctY = 50 + (rawCorrectY - 50) * displayScale;

        const pos = scatteredPositions[idx];

        // 2. Create sliced Canvas sized matching custom crop boundaries
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = cropW;
        sliceCanvas.height = cropH;
        const sliceCtx = sliceCanvas.getContext('2d');

        if (sliceCtx && canvas) {
          if (hasPixels) {
            // Generate mask for this slice in full 400x400 canvas
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = 400;
            maskCanvas.height = 400;
            const maskCtx = maskCanvas.getContext('2d');
            if (maskCtx) {
              const maskImgData = maskCtx.createImageData(400, 400);
              const mData = maskImgData.data;

              currentSliceComps.forEach((comp) => {
                comp.forEach((pt) => {
                  // Set a 3x3 neighborhood of 100% opacity to preserve edges cleanly
                  for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                      const nx = pt.x + dx;
                      const ny = pt.y + dy;
                      if (nx >= 0 && nx < 400 && ny >= 0 && ny < 400) {
                        const nidx = (ny * 400 + nx) * 4;
                        mData[nidx] = 255;
                        mData[nidx + 1] = 255;
                        mData[nidx + 2] = 255;
                        mData[nidx + 3] = 255;
                      }
                    }
                  }
                });
              });
              maskCtx.putImageData(maskImgData, 0, 0);
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 400;
            tempCanvas.height = 400;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.drawImage(canvas, 0, 0);
              tempCtx.globalCompositeOperation = 'destination-in';
              tempCtx.drawImage(maskCanvas, 0, 0);

              // Render only the cropped bounding box window relative to pMinX, pMinY
              sliceCtx.drawImage(tempCanvas, -pMinX, -pMinY);
            }
          } else {
            // Fallback to simple rectangle cropping if no pixels were found/labeled
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 400;
            tempCanvas.height = 400;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.drawImage(canvas, 0, 0);
              tempCtx.clearRect(0,  0, 400, pMinY);
              tempCtx.clearRect(0, pMaxY, 400, 400 - pMaxY);
              tempCtx.clearRect(0, pMinY, pMinX, cropH);
              tempCtx.clearRect(pMaxX, pMinY, 400 - pMaxX, cropH);

              if (def.excludeCenter) {
                const exX = Math.round((def.excludeCenter.x1 / 100) * 400);
                const exY = Math.round((def.excludeCenter.y1 / 100) * 400);
                const exW = Math.round(((def.excludeCenter.x2 - def.excludeCenter.x1) / 100) * 400);
                const exH = Math.round(((def.excludeCenter.y2 - def.excludeCenter.y1) / 100) * 400);
                tempCtx.clearRect(exX, exY, exW, exH);
              }
              sliceCtx.drawImage(tempCanvas, -pMinX, -pMinY);
            }
          }
          imageDataUrl = sliceCanvas.toDataURL('image/png');
        }

        let hitMask: Uint8Array | undefined;
        if (sliceCtx) {
          // Build a normalized 100x100 resolution HitMask mapped perfectly over image bounding box
          const tempMaskData = sliceCtx.getImageData(0, 0, cropW, cropH);
          const data = tempMaskData.data;
          hitMask = new Uint8Array(100 * 100);
          for (let y = 0; y < 100; y++) {
            for (let x = 0; x < 100; x++) {
              const srcX = Math.floor((x / 100) * cropW);
              const srcY = Math.floor((y / 100) * cropH);
              const px = Math.min(cropW - 1, Math.max(0, srcX));
              const py = Math.min(cropH - 1, Math.max(0, srcY));
              hitMask[y * 100 + x] = data[(py * cropW + px) * 4 + 3];
            }
          }
        }

        return {
          id: `piece-${idx}-${Date.now()}`,
          char: p,
          originalIndex: idx,
          x: pos.x,
          y: pos.y,
          correctX,
          correctY,
          widthPct,
          heightPct,
          rotate,
          scale,
          imageDataUrl,
          hitMask,
        };
      });
      setPieces(initialPieces);
      setIsLoaded(true);
    };

    loadGame();
  }, [quiz]);

  // Timer
  useEffect(() => {
    if (isCorrect || !isLoaded) return;
    const interval = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCorrect, isLoaded]);

  // Audio vocalization player on solved answer
  useEffect(() => {
    if (isCorrect && quiz) {
      speakReading(quiz);
    }
  }, [isCorrect, quiz]);

  // Clean speaking on component unmount has been modified to not cancel so speech continues
  useEffect(() => {
    return () => {
      // Do not cancel speech synthesis so that it reads fully to the end even when transitioning
    };
  }, []);

  // Check if all pieces are close enough to their correct relative coordinates layout
  const checkQuizCompletion = (currentPieces: Piece[]) => {
    if (currentPieces.length === 0) return;

    // Calculate relative distance offsets between current coordinates and original layout coords
    const offsets = currentPieces.map((piece) => {
      return {
        dx: piece.x - piece.correctX,
        dy: piece.y - piece.correctY,
      };
    });

    // Relative check: find the average offset (drift) of the constructed parts relative to their perfect placement template
    const avgDx = offsets.reduce((sum, o) => sum + o.dx, 0) / offsets.length;
    const avgDy = offsets.reduce((sum, o) => sum + o.dy, 0) / offsets.length;

    // Calculate individual deviations from the group's average drift
    const deviations = offsets.map((o) => Math.hypot(o.dx - avgDx, o.dy - avgDy));
    const maxDev = Math.max(...deviations);
    const avgDev = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;

    const { maxThreshold, avgThreshold } = getThresholds(currentPieces.length);

    const allCorrect = maxDev <= maxThreshold && avgDev <= avgThreshold;

    if (allCorrect) {
      setIsCorrect(true);
      onCorrect(timeSpent);
    }
  };

  const handlePieceDragEnd = (id: string, pctX: number, pctY: number) => {
    setPieces((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          const finalX = Math.max(10, Math.min(pctX, 90));
          const finalY = Math.max(10, Math.min(pctY, 90));

          return {
            ...p,
            x: finalX,
            y: finalY,
          };
        }
        return p;
      });

      // Pass check immediately using updated array
      checkQuizCompletion(updated);
      return updated;
    });
  };

  // Handle typing guesses as backup or alternative solved trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setGuess(val);

    // If matches the answer
    if (val === quiz.kanji) {
      // Snap everyone to their correct visual places on typing completion!
      setPieces((prev) => prev.map((p) => {
        return {
          ...p,
          x: p.correctX,
          y: p.correctY,
        };
      }));
      setIsCorrect(true);
      onCorrect(timeSpent);
    }
  };

  const handleShuffle = () => {
    setPieces((prev) => {
      const scatteredPositions = getNonOverlappingPositions(prev.length);
      return prev.map((piece, idx) => {
        const pos = scatteredPositions[idx];
        return {
          ...piece,
          x: pos.x,
          y: pos.y,
          rotate: 0,
        };
      });
    });
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const revealNextHint = () => {
    if (hintLevel < 3) {
      setHintLevel((prev) => prev + 1);
    }
  };

  const handleRevealAnswer = () => {
    setHintLevel(3);
    setGuess(quiz.kanji);
    setPieces((prev) =>
      prev.map((p) => ({
        ...p,
        x: p.correctX,
        y: p.correctY,
      }))
    );
    setIsCorrect(true);
    onCorrect(timeSpent);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4" id="playtable-container">
      {/* Header Panel */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
            id="playtable-btn-back"
          >
            <ArrowLeft size={16} />
            <span>一覧へ戻る</span>
          </button>

          {!isCorrect && (
            <>
              <button
                onClick={onNext}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 bg-white px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95"
                title="この問題をスキップして次の漢字へ進みます"
                id="playtable-btn-skip"
              >
                <span>スキップして次へ</span>
                <ArrowRight size={13} />
              </button>

              <button
                onClick={handleRevealAnswer}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 bg-white px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95"
                title="正解を表示してパーツを組み合わせます"
                id="playtable-btn-reveal-answer"
              >
                <Eye size={13} />
                <span>回答表示</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full font-mono">
            <Clock size={13} className="text-indigo-500" />
            <span>TIME: {formatTime(timeSpent)}</span>
          </div>

          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase ${
              quiz.difficulty === 'easy'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : quiz.difficulty === 'medium'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            難易度: {quiz.difficulty === 'easy' ? '初級' : quiz.difficulty === 'medium' ? '中級' : '上級'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Game tray with Geometric Grid */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Canvas Box in Geometric Balance styling - highlights beautifully in green upon clear */}
          <div className={`relative rounded-xl shadow-inner overflow-hidden aspect-square flex items-center justify-center p-6 transition-all duration-750 border-2 ${
            isCorrect 
              ? 'bg-emerald-50/10 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.22)] ring-4 ring-emerald-500/10' 
              : 'bg-white border-gray-200'
          }`}>
            
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none select-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            {/* Dashed outer alignment guideline frame */}
            <div className={`absolute inset-4 border-2 border-dashed rounded-lg pointer-events-none select-none transition-colors duration-500 ${
              isCorrect ? 'border-emerald-300/40' : 'border-indigo-50/70'
            }`}></div>

            {quiz.creator === 'default' ? (
              <span className="absolute top-4 left-4 text-[9px] font-bold text-gray-400 tracking-wider font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">PRESETS</span>
            ) : (
              <span className="absolute top-4 left-4 text-[9px] font-bold text-indigo-600 tracking-wider font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">CUSTOM</span>
            )}

            {/* Celebratory Floating Badge inside Canvas - does NOT cover any pieces, sits elegantly in the corner */}
            <AnimatePresence>
              {isCorrect && (
                <motion.div
                  initial={{ scale: 0, rotate: -15, y: -5 }}
                  animate={{ scale: 1, rotate: 0, y: 0 }}
                  exit={{ scale: 0 }}
                  className="absolute top-4 right-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[11px] px-3 py-1 rounded-full shadow-md z-30 flex items-center gap-1 border border-white/40 tracking-wider"
                >
                  <Sparkles size={11} className="fill-white animate-pulse" />
                  <span>正解！ CLEAR</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tray Title */}
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-extrabold text-gray-400 tracking-widest pointer-events-none select-none">
              漢字組立エリア (DRAG & ARRANGE CHIPS)
            </span>

            {/* Interactive Piece list */}
            <div
              className="absolute inset-0"
              ref={playZoneRef}
              id="playtable-board"
              onPointerDown={handleBoardPointerDown}
            >
              {/* Debug Guidelines (Rendered underneath the actual pieces) */}
              {showDebugMarkers && pieces.length > 0 && (() => {
                const offsets = pieces.map((piece) => ({
                  dx: piece.x - piece.correctX,
                  dy: piece.y - piece.correctY,
                }));
                const avgDx = offsets.reduce((sum, o) => sum + o.dx, 0) / offsets.length;
                const avgDy = offsets.reduce((sum, o) => sum + o.dy, 0) / offsets.length;
                const { maxThreshold } = getThresholds(pieces.length);

                return pieces.map((piece) => {
                  const targetX = piece.correctX + avgDx;
                  const targetY = piece.correctY + avgDy;
                  const dev = Math.hypot(piece.x - targetX, piece.y - targetY);
                  const isWithin = dev <= maxThreshold;

                  return (
                    <React.Fragment key={`debug-${piece.id}`}>
                      {/* 1. Absolute correct layout guidance marker */}
                      <div
                        className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full border border-dashed border-gray-400 bg-gray-50/75 flex items-center justify-center pointer-events-none z-10"
                        style={{ left: `${piece.correctX}%`, top: `${piece.correctY}%` }}
                      >
                        <span className="text-[10px] font-sans font-bold text-gray-500">{piece.char}基準</span>
                      </div>

                      {/* 2. Connection lines: Absolute target to dynamic target, and dynamic target to current coordinate */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                        {/* Perfect template reference to relative matching center */}
                        <line
                          x1={`${piece.correctX}%`}
                          y1={`${piece.correctY}%`}
                          x2={`${targetX}%`}
                          y2={`${targetY}%`}
                          stroke="#6366f1"
                          strokeWidth="1.5"
                          strokeDasharray="4,4"
                          opacity="0.6"
                        />
                        {/* Relative center to current piece placement */}
                        <line
                          x1={`${targetX}%`}
                          y1={`${targetY}%`}
                          x2={`${piece.x}%`}
                          y2={`${piece.y}%`}
                          stroke={isWithin ? '#10b981' : '#f43f5e'}
                          strokeWidth="2"
                          strokeDasharray="2,2"
                        />
                      </svg>

                      {/* 3. Relative correctness matching radius (Target Zone) */}
                      <div
                        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 pointer-events-none z-10 flex items-center justify-center transition-colors duration-200 ${
                          isWithin
                            ? 'bg-emerald-500/10 border-emerald-500/40'
                            : 'bg-rose-500/10 border-rose-500/40'
                        }`}
                        style={{
                          left: `${targetX}%`,
                          top: `${targetY}%`,
                          width: `${maxThreshold * 2}%`,
                          height: `${maxThreshold * 2}%`,
                        }}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${isWithin ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'} shadow-sm border border-white`} />
                      </div>

                      {/* 4. Display of precise drift values */}
                      <div
                        className={`absolute px-2 py-0.5 rounded text-[9px] font-mono font-bold pointer-events-none z-30 select-none shadow-xs border transition-colors ${
                          isWithin
                            ? 'bg-emerald-50 border-emerald-250 text-emerald-800'
                            : 'bg-rose-50 border-rose-250 text-rose-800'
                        }`}
                        style={{
                          left: `${piece.x}%`,
                          top: `${piece.y - 12}%`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        {piece.char}: {dev.toFixed(1)}% / 許容: {maxThreshold.toFixed(1)}% {isWithin ? 'OK' : '❌'}
                      </div>
                    </React.Fragment>
                  );
                });
              })()}

              <AnimatePresence>
                {pieces.map((piece) => (
                  <KanjiPiece
                    key={piece.id}
                    piece={piece}
                    playZoneRef={playZoneRef}
                    onTranspClick={handleTransparentClick}
                    pieceDragHandlesRef={pieceDragHandlesRef}
                    onPieceDragEnd={handlePieceDragEnd}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Tray Quick Controls */}
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleShuffle}
              className="flex-1 bg-white hover:bg-gray-100 text-gray-700 font-semibold text-xs px-4 py-2.5 rounded-lg border border-gray-200 flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>パーツをシャッフル（再配置）</span>
            </button>
            <button
              onClick={() => setShowDebugMarkers(!showDebugMarkers)}
              className={`flex-1 font-semibold text-xs px-4 py-2.5 rounded-lg border flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                showDebugMarkers
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
              id="playtable-btn-debug-markers"
              title="デバッグ用：各パーツの正解目標位置と許容範囲を可視化します"
            >
              <HelpCircle size={13} className={showDebugMarkers ? 'text-amber-500 animate-pulse' : 'text-gray-400'} />
              <span>判定ガイド (デバッグ): {showDebugMarkers ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Right Side: Progressive toggle between input mode and solved-explanation results */}
        <div className="lg:col-span-5 flex flex-col gap-6 relative">
          <AnimatePresence mode="wait">
            {!isCorrect ? (
              <motion.div
                key="playtable-input-panel"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6"
              >
                {/* Answer Area */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">回答用紙</h4>
                  <div className="space-y-4">
                    <input
                      type="text"
                      maxLength={4}
                      value={guess}
                      onChange={handleInputChange}
                      placeholder="漢字一文字を記入..."
                      className="w-full bg-gray-50 border-2 border-gray-200 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-50 rounded-xl px-5 py-3.5 text-center text-3xl font-bold text-gray-900 tracking-widest placeholder:text-base placeholder:text-gray-400 shadow-inner font-serif transition-all"
                      id="play-guess-input"
                    />
                    <p className="text-[10px] text-center text-gray-500 leading-relaxed">
                      漢字パーツが合体した「正しい一字」を記入してください。
                    </p>
                  </div>
                </div>

                {/* Progressive Hint Drawer */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex-1 flex flex-col gap-4">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h4 className="text-xs font-bold text-gray-900 tracking-wider flex items-center gap-1.5">
                      <HelpCircle size={15} className="text-indigo-600" />
                      <span>ヒント機能</span>
                    </h4>
                    <span className="text-xs font-mono text-indigo-600 font-bold">INFO LEVEL: {hintLevel} / 3</span>
                  </div>

                  {/* Stepper buttons and hints details */}
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      {/* Level 1: Reading */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                        <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-gray-600 flex items-center gap-1">
                            <BookOpen size={12} className="text-indigo-500" />
                            <span>第一の契機：漢字の読み（音・訓）</span>
                          </span>
                          {hintLevel >= 1 ? (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">公開中</span>
                          ) : (
                            <span className="text-[9px] font-bold text-gray-400">未公開</span>
                          )}
                        </div>
                        {hintLevel >= 1 ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-3 bg-white font-serif font-bold text-sm text-gray-900 leading-relaxed"
                          >
                            {quiz.reading}
                          </motion.div>
                        ) : (
                          <div className="p-3 text-center text-gray-400 select-none">
                            鍵が掛かっています
                          </div>
                        )}
                      </div>

                      {/* Level 2: Meaning */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                        <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-gray-600 flex items-center gap-1">
                            <Sparkles size={12} className="text-indigo-500" />
                            <span>第二の契機：語意・英語表記</span>
                          </span>
                          {hintLevel >= 2 ? (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">公開中</span>
                          ) : (
                            <span className="text-[9px] font-bold text-gray-400">未公開</span>
                          )}
                        </div>
                        {hintLevel >= 2 ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-3 bg-white font-bold text-gray-800"
                          >
                            {quiz.meaning}
                          </motion.div>
                        ) : (
                          <div className="p-3 text-center text-gray-400 select-none">
                            鍵が掛かっています
                          </div>
                        )}
                      </div>

                      {/* Level 3: Written hint text */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                        <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-gray-600 flex items-center gap-1">
                            <Eye size={12} className="text-indigo-500" />
                            <span>第三の契機：詳細ヒントテキスト</span>
                          </span>
                          {hintLevel >= 3 ? (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">公開中</span>
                          ) : (
                            <span className="text-[9px] font-bold text-gray-400">未公開</span>
                          )}
                        </div>
                        {hintLevel >= 3 ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-3 bg-white leading-relaxed text-gray-700 font-sans"
                          >
                            {quiz.hint}
                          </motion.div>
                        ) : (
                          <div className="p-3 text-center text-gray-400 select-none">
                            鍵が掛かっています
                          </div>
                        )}
                      </div>
                    </div>

                    {hintLevel < 3 && (
                      <button
                        onClick={revealNextHint}
                        className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 font-bold text-white text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        id="btn-reveal-hint"
                      >
                        <Eye size={13} />
                        <span>ヒントを解放 ({hintLevel + 1}/3)</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="playtable-celebration-panel"
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="bg-white rounded-2xl border-2 border-emerald-500 p-6 shadow-md flex-1 flex flex-col gap-5 justify-start relative overflow-hidden"
              >
                {/* Decorative Kanji glyph element in the background */}
                <div className="absolute -bottom-8 -right-10 opacity-5 pointer-events-none select-none font-serif text-9xl font-black text-emerald-900 leading-none">
                  {quiz.kanji}
                </div>

                {/* "Next Question" button placed prominently at the top */}
                <div className="pb-3 border-b border-gray-150 flex flex-col gap-2 z-10">
                  <button
                    onClick={onNext}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 font-bold text-white text-xs py-3.5 rounded-lg flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer animate-pulse"
                  >
                    <span>次の問題へ進む</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Status header with dynamic trophy icon */}
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 flex items-center justify-center bg-emerald-600 text-white w-12 h-12 rounded-full shadow-lg border border-emerald-400 animate-bounce">
                      <Trophy className="text-yellow-300 w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl font-black text-emerald-900 tracking-wide select-none">
                        正解 達成！
                      </h3>
                      <p className="text-[10px] text-emerald-600 font-bold tracking-widest font-mono">PUZZLE SOLVED SUCCESSFULLY</p>
                    </div>
                  </div>

                  {/* Character card details */}
                  <div className="bg-emerald-50/40 rounded-xl p-4 border border-emerald-100 shadow-3xs text-left relative">
                    <div className="relative text-center mb-3">
                      <div className="text-center text-5xl md:text-6xl font-black font-serif text-emerald-950 tracking-normal drop-shadow-xs select-all">
                        {quiz.kanji}
                      </div>
                      <button
                        onClick={() => speakReading(quiz)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white hover:bg-emerald-50 text-emerald-600 active:scale-95 p-2 rounded-full border border-emerald-100 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                        title="読み声を再生"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>

                    <div className="space-y-3.5 border-t border-emerald-100/60 pt-3">
                      {/* Onyomi / Kunyomi grid */}
                      <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-emerald-100/50 shadow-3xs">
                        <div>
                          <span className="text-[8px] md:text-[9px] uppercase tracking-wider text-emerald-600 font-extrabold block">音読み (ONYOMI)</span>
                          <span className="font-extrabold text-gray-900 text-xs md:text-sm">
                            {quiz.onyomi || quiz.reading.split(/[、/,\s]/)[0] || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] md:text-[9px] uppercase tracking-wider text-emerald-600 font-extrabold block">訓読み (KUNYOMI)</span>
                          <span className="font-extrabold text-gray-900 text-xs md:text-sm">
                            {quiz.kunyomi || quiz.reading.split(/[、/,\s]/).slice(1).join('、') || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-700 leading-relaxed font-sans px-1">
                        <span className="font-bold text-emerald-950">意味:</span> {quiz.meaning}
                      </div>

                      {/* Grade restricted vocabulary snippets */}
                      {quiz.exampleWords && quiz.exampleWords.length > 0 && (
                        <div className="border-t border-emerald-100/40 pt-2.5">
                          <span className="text-[9px] uppercase tracking-widest text-emerald-600 font-extrabold block mb-1.5">
                            📖 この学年までの漢字で読めることば
                          </span>
                          <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                            {quiz.exampleWords.map((wordObj, wIdx) => (
                              <div key={wIdx} className="bg-white/80 border border-emerald-100/30 p-2 rounded-lg flex flex-col leading-snug">
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-emerald-950 text-xs md:text-sm">{wordObj.word}</span>
                                  <span className="text-[9px] md:text-[10px] text-emerald-600">（{wordObj.reading}）</span>
                                </div>
                                {wordObj.meaning && (
                                  <span className="text-[8px] md:text-[9px] text-gray-500 mt-0.5">{wordObj.meaning}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
