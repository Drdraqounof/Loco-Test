/**
 * Chess Game Component
 * A simple playable chess game for Loco experimental features
 * Play with full board, piece movement, and game state management
 */

// In plain terms: this file contains the main chess game logic and interface for the experimental chess feature.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Position {
  x: number;
  y: number;
}

type PieceColor = 'white' | 'black';
type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

interface Piece {
  type: PieceType;
  color: PieceColor;
  position: Position;
  hasMoved?: boolean;
}

interface GameState {
  pieces: Map<string, Piece>;
  selectedSquare: Position | null;
  validMoves: Position[];
  turn: PieceColor;
  gameStatus: 'playing' | 'checkmate' | 'stalemate' | 'draw';
  score: { white: number; black: number };
  moveHistory: string[];
  winner: PieceColor | null;
}

interface PieceEntry {
  key: string;
  piece: Piece;
}

interface MoveOption {
  pieceKey: string;
  piece: Piece;
  to: Position;
  capturedPiece: Piece | null;
}

type ChessTheme = 'classic' | 'modern' | 'dark';
type DifficultyLevel = 'easy' | 'medium' | 'hard';

const BOARD_SIZE = 8;

const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 100,
};

const AI_THINK_DELAY: Record<DifficultyLevel, number> = {
  easy: 250,
  medium: 450,
  hard: 700,
};

const isInsideBoard = (x: number, y: number) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

const positionsMatch = (left: Position, right: Position) => left.x === right.x && left.y === right.y;

const toSquareNotation = ({ x, y }: Position) => `${String.fromCharCode(97 + x)}${BOARD_SIZE - y}`;

const getPieceEntryAt = (pieces: Map<string, Piece>, position: Position): PieceEntry | null => {
  for (const [key, piece] of pieces) {
    if (positionsMatch(piece.position, position)) {
      return { key, piece };
    }
  }

  return null;
};

const buildMoveNotation = (piece: Piece, from: Position, to: Position, capturedPiece: Piece | null, promoted: boolean) => {
  const piecePrefix = piece.type === 'pawn' ? '' : piece.type[0].toUpperCase();
  const separator = capturedPiece ? 'x' : '-';
  const promotionSuffix = promoted ? '=Q' : '';

  return `${piecePrefix}${toSquareNotation(from)}${separator}${toSquareNotation(to)}${promotionSuffix}`;
};

const calculateValidMoves = (pieces: Map<string, Piece>, piece: Piece): Position[] => {
  const moves: Position[] = [];
  const { x, y } = piece.position;
  const getOccupant = (targetX: number, targetY: number) => getPieceEntryAt(pieces, { x: targetX, y: targetY })?.piece ?? null;

  const addDirectionalMoves = (directions: Array<[number, number]>, maxDistance = BOARD_SIZE) => {
    for (const [dx, dy] of directions) {
      for (let step = 1; step <= maxDistance; step++) {
        const targetX = x + dx * step;
        const targetY = y + dy * step;

        if (!isInsideBoard(targetX, targetY)) {
          break;
        }

        const occupant = getOccupant(targetX, targetY);

        if (!occupant) {
          moves.push({ x: targetX, y: targetY });
          continue;
        }

        if (occupant.color !== piece.color) {
          moves.push({ x: targetX, y: targetY });
        }

        break;
      }
    }
  };

  switch (piece.type) {
    case 'pawn': {
      const direction = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;
      const oneStepY = y + direction;

      if (isInsideBoard(x, oneStepY) && !getOccupant(x, oneStepY)) {
        moves.push({ x, y: oneStepY });

        const twoStepY = y + direction * 2;
        if (y === startRow && isInsideBoard(x, twoStepY) && !getOccupant(x, twoStepY)) {
          moves.push({ x, y: twoStepY });
        }
      }

      for (const deltaX of [-1, 1]) {
        const targetX = x + deltaX;
        const targetY = y + direction;
        if (!isInsideBoard(targetX, targetY)) {
          continue;
        }

        const occupant = getOccupant(targetX, targetY);
        if (occupant && occupant.color !== piece.color) {
          moves.push({ x: targetX, y: targetY });
        }
      }
      break;
    }
    case 'knight': {
      const knightOffsets: Array<[number, number]> = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];

      for (const [dx, dy] of knightOffsets) {
        const targetX = x + dx;
        const targetY = y + dy;

        if (!isInsideBoard(targetX, targetY)) {
          continue;
        }

        const occupant = getOccupant(targetX, targetY);
        if (!occupant || occupant.color !== piece.color) {
          moves.push({ x: targetX, y: targetY });
        }
      }
      break;
    }
    case 'bishop':
      addDirectionalMoves([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]);
      break;
    case 'rook':
      addDirectionalMoves([
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]);
      break;
    case 'queen':
      addDirectionalMoves([
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ]);
      break;
    case 'king':
      addDirectionalMoves([
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ], 1);
      break;
  }

  return moves;
};

const collectMovesForColor = (pieces: Map<string, Piece>, color: PieceColor): MoveOption[] => {
  const moves: MoveOption[] = [];

  for (const [key, piece] of pieces) {
    if (piece.color !== color) {
      continue;
    }

    for (const move of calculateValidMoves(pieces, piece)) {
      moves.push({
        pieceKey: key,
        piece,
        to: move,
        capturedPiece: getPieceEntryAt(pieces, move)?.piece ?? null,
      });
    }
  }

  return moves;
};

const applyMoveToGameState = (currentState: GameState, pieceKey: string, destination: Position): GameState => {
  const movingPiece = currentState.pieces.get(pieceKey);
  if (!movingPiece) {
    return currentState;
  }

  const nextPieces = new Map(currentState.pieces);
  let capturedPiece: Piece | null = null;

  for (const [key, piece] of nextPieces) {
    if (positionsMatch(piece.position, destination) && piece.color !== movingPiece.color) {
      capturedPiece = piece;
      nextPieces.delete(key);
      break;
    }
  }

  const promoted = movingPiece.type === 'pawn' && (destination.y === 0 || destination.y === BOARD_SIZE - 1);
  const nextPiece: Piece = {
    ...movingPiece,
    type: promoted ? 'queen' : movingPiece.type,
    position: destination,
    hasMoved: true,
  };

  nextPieces.set(pieceKey, nextPiece);

  const nextScore = { ...currentState.score };
  if (capturedPiece) {
    nextScore[movingPiece.color] += 1;
  }

  const winner = capturedPiece?.type === 'king' ? movingPiece.color : null;
  const nextTurn = winner ? movingPiece.color : movingPiece.color === 'white' ? 'black' : 'white';
  let nextStatus: GameState['gameStatus'] = winner ? 'checkmate' : 'playing';

  if (!winner) {
    const nextMoves = collectMovesForColor(nextPieces, nextTurn);
    if (nextMoves.length === 0) {
      nextStatus = 'stalemate';
    }
  }

  return {
    pieces: nextPieces,
    selectedSquare: null,
    validMoves: [],
    turn: nextTurn,
    gameStatus: nextStatus,
    score: nextScore,
    moveHistory: [
      ...currentState.moveHistory,
      buildMoveNotation(movingPiece, movingPiece.position, destination, capturedPiece, promoted),
    ],
    winner,
  };
};

const chooseAiMove = (moves: MoveOption[], difficulty: DifficultyLevel): MoveOption | null => {
  if (moves.length === 0) {
    return null;
  }

  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const scoredMoves = moves
    .map((move) => {
      const captureScore = move.capturedPiece ? PIECE_VALUES[move.capturedPiece.type] * 10 : 0;
      const promotionScore = move.piece.type === 'pawn' && move.to.y === BOARD_SIZE - 1 ? 12 : 0;
      const centerDistance = Math.abs(3.5 - move.to.x) + Math.abs(3.5 - move.to.y);
      const centerScore = Math.max(0, 4 - centerDistance);
      const forwardScore = move.piece.type === 'pawn' ? move.to.y : BOARD_SIZE - move.to.y;

      return {
        move,
        score: captureScore + promotionScore + centerScore + forwardScore + Math.random(),
      };
    })
    .sort((left, right) => right.score - left.score);

  if (difficulty === 'medium') {
    const mediumPool = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
    return mediumPool[Math.floor(Math.random() * mediumPool.length)].move;
  }

  return scoredMoves[0].move;
};

export default function ChessGame() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [theme, setTheme] = useState<ChessTheme>('classic');
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const isAiThinking = gameState?.turn === 'black' && gameState?.gameStatus === 'playing';

  // Initialize chess board
  const initializeBoard = () => {
    const pieces = new Map<string, Piece>();

    // Black pieces (top)
    const blackBackRow: Piece['type'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    blackBackRow.forEach((type, i) => {
      pieces.set(`b-${type}-${i}`, {
        type,
        color: 'black',
        position: { x: i, y: 0 },
      });
    });

    // Black pawns
    for (let i = 0; i < 8; i++) {
      pieces.set(`b-pawn-${i}`, {
        type: 'pawn',
        color: 'black',
        position: { x: i, y: 1 },
      });
    }

    // White pawns
    for (let i = 0; i < 8; i++) {
      pieces.set(`w-pawn-${i}`, {
        type: 'pawn',
        color: 'white',
        position: { x: i, y: 6 },
      });
    }

    // White pieces (bottom)
    const whiteBackRow: Piece['type'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    whiteBackRow.forEach((type, i) => {
      pieces.set(`w-${type}-${i}`, {
        type,
        color: 'white',
        position: { x: i, y: 7 },
      });
    });

    setGameState({
      pieces,
      selectedSquare: null,
      validMoves: [],
      turn: 'white',
      gameStatus: 'playing',
      score: { white: 0, black: 0 },
      moveHistory: [],
      winner: null,
    });

    setGameStarted(true);
  };

  const getPieceSymbol = (piece: Piece): string => {
    const symbols: Record<Piece['type'], Record<Piece['color'], string>> = {
      pawn: { white: '♙', black: '♟' },
      knight: { white: '♘', black: '♞' },
      bishop: { white: '♗', black: '♝' },
      rook: { white: '♖', black: '♜' },
      queen: { white: '♕', black: '♛' },
      king: { white: '♔', black: '♚' },
    };
    return symbols[piece.type][piece.color];
  };

  const getSquareColor = (x: number, y: number): string => {
    const isLightSquare = (x + y) % 2 === 0;

    switch (theme) {
      case 'classic':
        return isLightSquare ? '#f0d9b5' : '#b58863';
      case 'modern':
        return isLightSquare ? '#eeeed2' : '#769656';
      case 'dark':
        return isLightSquare ? '#3d3d3d' : '#1a1a1a';
    }
  };

  useEffect(() => {
    if (!gameStarted || !gameState || gameState.turn !== 'black' || gameState.gameStatus !== 'playing') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGameState((currentState) => {
        if (!currentState || currentState.turn !== 'black' || currentState.gameStatus !== 'playing') {
          return currentState;
        }

        const availableMoves = collectMovesForColor(currentState.pieces, 'black');
        const selectedMove = chooseAiMove(availableMoves, difficulty);

        if (!selectedMove) {
          return {
            ...currentState,
            selectedSquare: null,
            validMoves: [],
            gameStatus: 'stalemate',
            winner: null,
          };
        }

        return applyMoveToGameState(currentState, selectedMove.pieceKey, selectedMove.to);
      });
    }, AI_THINK_DELAY[difficulty]);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [difficulty, gameStarted, gameState]);

  const handleSquareClick = (x: number, y: number) => {
    if (!gameState || gameState.gameStatus !== 'playing' || gameState.turn !== 'white' || isAiThinking) {
      return;
    }

    const clickedPosition = { x, y };
    const clickedEntry = getPieceEntryAt(gameState.pieces, clickedPosition);

    if (clickedEntry?.piece.color === 'white') {
      const isSameSelectedSquare =
        gameState.selectedSquare !== null && positionsMatch(gameState.selectedSquare, clickedPosition);

      if (isSameSelectedSquare) {
        setGameState({
          ...gameState,
          selectedSquare: null,
          validMoves: [],
        });
        return;
      }

      setGameState({
        ...gameState,
        selectedSquare: clickedPosition,
        validMoves: calculateValidMoves(gameState.pieces, clickedEntry.piece),
      });
      return;
    }

    if (!gameState.selectedSquare) {
      return;
    }

    const isValidMove = gameState.validMoves.some((move) => positionsMatch(move, clickedPosition));
    if (!isValidMove) {
      setGameState({
        ...gameState,
        selectedSquare: null,
        validMoves: [],
      });
      return;
    }

    const movingEntry = getPieceEntryAt(gameState.pieces, gameState.selectedSquare);
    if (!movingEntry) {
      return;
    }

    setGameState(applyMoveToGameState(gameState, movingEntry.key, clickedPosition));
  };

  const resetGame = () => {
    initializeBoard();
  };

  if (!gameStarted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: '#ffffff',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '30px',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', marginTop: 0, marginRight: 0, marginBottom: '10px', marginLeft: 0 }}>♟️ Chess</h1>
          <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '30px' }}>
            A classic strategy game built into Loco
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '30px',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <label style={{ fontSize: '16px' }}>
            Select Difficulty:
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
              style={{
                marginLeft: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: '#00a86b',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label style={{ fontSize: '16px' }}>
            Theme:
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ChessTheme)}
              style={{
                marginLeft: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: '#00a86b',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            onClick={initializeBoard}
            style={{
              padding: '15px 40px',
              fontSize: '16px',
              fontWeight: 'bold',
              background: '#00a86b',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00c878';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#00a86b';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Start Game
          </button>

          <button
            onClick={() => router.push('/')}
            style={{
              padding: '15px 40px',
              fontSize: '16px',
              fontWeight: 'bold',
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ff8787';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ff6b6b';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Back to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: '#ffffff',
        alignItems: 'center',
        padding: '20px',
        gap: '20px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', margin: 0 }}>♟️ Chess Game</h1>
        <p style={{ fontSize: '14px', opacity: 0.8, margin: '5px 0 0 0' }}>
          {gameState?.winner
            ? `Winner: ${gameState.winner.toUpperCase()} | Status: ${gameState.gameStatus}`
            : `Turn: ${gameState?.turn?.toUpperCase()} | Status: ${gameState?.gameStatus}`}
        </p>
        <p style={{ fontSize: '13px', opacity: 0.7, margin: '8px 0 0 0' }}>
          You play as White. {isAiThinking ? 'Black is thinking...' : 'Black is controlled by the AI.'}
        </p>
      </div>

      {/* Score */}
      <div
        style={{
          display: 'flex',
          gap: '30px',
          fontSize: '16px',
          fontWeight: 'bold',
        }}
      >
        <div>White Captured: {gameState?.score.white || 0}</div>
        <div>Black Captured: {gameState?.score.black || 0}</div>
      </div>

      {/* Chess Board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 50px)',
          gap: 0,
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          background: '#000',
        }}
      >
        {Array.from({ length: 8 }).map((_, y) =>
          Array.from({ length: 8 }).map((_, x) => {
            const piece = Array.from(gameState?.pieces.values() || []).find(
              (p) => p.position.x === x && p.position.y === y,
            );
            const isValid = gameState?.validMoves.some((m) => m.x === x && m.y === y);
            const isSelected = gameState?.selectedSquare?.x === x && gameState?.selectedSquare?.y === y;

            return (
              <div
                key={`${x}-${y}`}
                onClick={() => handleSquareClick(x, y)}
                style={{
                  width: '50px',
                  height: '50px',
                  background: isSelected ? '#7da3ff' : getSquareColor(x, y),
                  border: isValid ? '3px solid #ff6b6b' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: gameState?.turn === 'white' && !isAiThinking ? 'pointer' : 'default',
                  fontSize: '32px',
                  transition: 'all 0.15s ease',
                  boxShadow: isValid ? 'inset 0 0 10px rgba(255, 107, 107, 0.5)' : 'none',
                  opacity: gameState?.turn === 'black' && !piece ? 0.95 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {piece ? getPieceSymbol(piece) : ''}
              </div>
            );
          }),
        )}
      </div>

      {/* Move History */}
      {gameState?.moveHistory && gameState.moveHistory.length > 0 && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '15px',
            borderRadius: '8px',
            maxWidth: '400px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Moves:</h3>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
            {gameState.moveHistory.join(' → ')}
          </p>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={resetGame}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            background: '#00a86b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#00c878';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#00a86b';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          New Game
        </button>

        <button
          onClick={() => router.push('/')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#ff8787';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ff6b6b';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Back to Chat
        </button>
      </div>

      {/* Info */}
      <div
        style={{
          fontSize: '12px',
          opacity: 0.7,
          textAlign: 'center',
          maxWidth: '400px',
        }}
      >
        Click a white piece to see legal moves. Empty squares now accept valid moves, black pieces are AI-controlled, and pawns promote to queens automatically.
      </div>
    </div>
  );
}
