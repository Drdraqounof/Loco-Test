/**
 * Chess Game Component
 * A simple playable chess game for Loco experimental features
 * Play with full board, piece movement, and game state management
 */

// In plain terms: this file contains the main chess game logic and interface for the experimental chess feature.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Position {
  x: number;
  y: number;
}

interface Piece {
  type: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
  color: 'white' | 'black';
  position: Position;
  hasMoved?: boolean;
}

interface GameState {
  pieces: Map<string, Piece>;
  selectedSquare: Position | null;
  validMoves: Position[];
  turn: 'white' | 'black';
  gameStatus: 'playing' | 'checkmate' | 'stalemate' | 'draw';
  score: { white: number; black: number };
  moveHistory: string[];
}

type ChessTheme = 'classic' | 'modern' | 'dark';
type DifficultyLevel = 'easy' | 'medium' | 'hard';

export default function ChessGame() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [theme, setTheme] = useState<ChessTheme>('classic');
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');

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

  const handleSquareClick = (x: number, y: number) => {
    if (!gameState || gameState.gameStatus !== 'playing') return;

    // Check if there's a piece at this square
    let clickedPiece: Piece | null = null;
    let clickedPieceKey: string | null = null;

    for (const [key, piece] of gameState.pieces) {
      if (piece.position.x === x && piece.position.y === y) {
        clickedPiece = piece;
        clickedPieceKey = key;
        break;
      }
    }

    // If clicking a piece of current player, select it
    if (clickedPiece && clickedPiece.color === gameState.turn) {
      setGameState({
        ...gameState,
        selectedSquare: { x, y },
        validMoves: calculateValidMoves(gameState.pieces, clickedPiece),
      });
    } else if (gameState.selectedSquare && clickedPieceKey) {
      // Try to move to this square
      const newPieces = new Map(gameState.pieces);
      const nextScore = { ...gameState.score };

      // Remove captured piece if any
      for (const [key, piece] of newPieces) {
        if (piece.position.x === x && piece.position.y === y && piece.color !== gameState.turn) {
          newPieces.delete(key);
          nextScore[gameState.turn] += 1;
          break;
        }
      }

      // Move the piece
      const movingPiece = Array.from(newPieces.entries()).find(
        ([, piece]) => piece.position.x === gameState.selectedSquare!.x && piece.position.y === gameState.selectedSquare!.y,
      );

      if (movingPiece) {
        const [key, piece] = movingPiece;
        const newPiece = { ...piece, position: { x, y }, hasMoved: true };
        newPieces.set(key, newPiece);

        const moveNotation = `${String.fromCharCode(97 + gameState.selectedSquare.x)}${8 - gameState.selectedSquare.y}${String.fromCharCode(97 + x)}${8 - y}`;

        setGameState({
          ...gameState,
          pieces: newPieces,
          selectedSquare: null,
          validMoves: [],
          turn: gameState.turn === 'white' ? 'black' : 'white',
          moveHistory: [...gameState.moveHistory, moveNotation],
          score: nextScore,
        });
      }
    }
  };

  const calculateValidMoves = (pieces: Map<string, Piece>, piece: Piece): Position[] => {
    const moves: Position[] = [];
    const { x, y } = piece.position;
    const { type } = piece;

    // Helper to check if square is occupied
    const isOccupied = (px: number, py: number, byColor?: string): Piece | null => {
      for (const p of pieces.values()) {
        if (p.position.x === px && p.position.y === py) {
          if (byColor && p.color !== byColor) return null;
          return p;
        }
      }
      return null;
    };

    // Helper to add moves in direction
    const addDirectionMoves = (directions: number[][], maxDistance: number = 8) => {
      for (const [dx, dy] of directions) {
        for (let i = 1; i <= maxDistance; i++) {
          const nx = x + dx * i;
          const ny = y + dy * i;

          if (nx < 0 || nx > 7 || ny < 0 || ny > 7) break;

          const occupied = isOccupied(nx, ny, piece.color);
          if (occupied && occupied.color === piece.color) break;

          moves.push({ x: nx, y: ny });
          if (occupied) break;
        }
      }
    };

    // Piece-specific moves
    if (type === 'pawn') {
      const direction = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;

      // Forward move
      if (!isOccupied(x, y + direction)) {
        moves.push({ x, y: y + direction });

        // Double move on first move
        if (y === startRow && !isOccupied(x, y + 2 * direction)) {
          moves.push({ x, y: y + 2 * direction });
        }
      }

      // Captures
      if (isOccupied(x - 1, y + direction) && isOccupied(x - 1, y + direction)?.color !== piece.color) {
        moves.push({ x: x - 1, y: y + direction });
      }
      if (isOccupied(x + 1, y + direction) && isOccupied(x + 1, y + direction)?.color !== piece.color) {
        moves.push({ x: x + 1, y: y + direction });
      }
    } else if (type === 'knight') {
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dx, dy] of knightMoves) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx <= 7 && ny >= 0 && ny <= 7) {
          const occupied = isOccupied(nx, ny);
          if (!occupied || occupied.color !== piece.color) {
            moves.push({ x: nx, y: ny });
          }
        }
      }
    } else if (type === 'bishop') {
      addDirectionMoves([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    } else if (type === 'rook') {
      addDirectionMoves([[0, -1], [0, 1], [-1, 0], [1, 0]]);
    } else if (type === 'queen') {
      addDirectionMoves([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);
    } else if (type === 'king') {
      addDirectionMoves([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]], 1);
    }

    return moves;
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
          <h1 style={{ fontSize: '48px', margin: 0, marginBottom: '10px' }}>♟️ Chess</h1>
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
          Turn: <strong>{gameState?.turn?.toUpperCase()}</strong> | Status: {gameState?.gameStatus}
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
                  cursor: 'pointer',
                  fontSize: '32px',
                  transition: 'all 0.15s ease',
                  boxShadow: isValid ? 'inset 0 0 10px rgba(255, 107, 107, 0.5)' : 'none',
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
        Click on a piece to select it. Valid moves will be highlighted. Click on a highlighted square to move.
      </div>
    </div>
  );
}
