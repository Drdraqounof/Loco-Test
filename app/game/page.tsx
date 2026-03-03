"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface GameState {
  playerScore: number;
  aiScore: number;
  gameActive: boolean;
  gameOver: boolean;
  winner: string | null;
}

export default function GamePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    playerScore: 0,
    aiScore: 0,
    gameActive: true,
    gameOver: false,
    winner: null,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Game variables
    const paddleHeight = 100;
    const paddleWidth = 10;
    const ballSize = 8;
    const canvas_width = 800;
    const canvas_height = 400;

    let paddleOneY = 150;
    let paddleTwoY = 150;
    let ballX = 400;
    let ballY = 200;
    let ballSpeedX = 4;
    let ballSpeedY = 4;
    let playerScore = 0;
    let aiScore = 0;
    let gameActive = true;

    const paddleOneX = 20;
    const paddleTwoX = 770;

    const keyState: { [key: string]: boolean } = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keyState[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keyState[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const drawRect = (x: number, y: number, width: number, height: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);
    };

    const drawCircle = (x: number, y: number, radius: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawText = (text: string, x: number, y: number, size: number, color: string) => {
      ctx.fillStyle = color;
      ctx.font = `${size}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(text, x, y);
    };

    const resetBall = () => {
      ballX = 400;
      ballY = 200;
      ballSpeedX = (Math.random() > 0.5 ? 1 : -1) * 4;
      ballSpeedY = (Math.random() - 0.5) * 8;
    };

    const gameLoop = () => {
      if (!gameActive) return;

      // Clear canvas
      drawRect(0, 0, canvas_width, canvas_height, "#0a0e27");

      // Center line
      for (let i = 0; i < canvas_height; i += 15) {
        drawRect(canvas_width / 2 - 1, i, 2, 10, "#4a5595");
      }

      // Player controls (both W/S and Arrow Up/Down)
      if (keyState["w"] || keyState["W"] || keyState["ArrowUp"]) {
        if (paddleOneY > 0) paddleOneY -= 6;
      }
      if (keyState["s"] || keyState["S"] || keyState["ArrowDown"]) {
        if (paddleOneY < canvas_height - paddleHeight) paddleOneY += 6;
      }

      // AI logic
      const aiCenter = paddleTwoY + paddleHeight / 2;
      if (aiCenter < ballY - 35) {
        paddleTwoY += 5;
      } else if (aiCenter > ballY + 35) {
        paddleTwoY -= 5;
      }

      // Ball physics
      ballX += ballSpeedX;
      ballY += ballSpeedY;

      // Ball collision with top/bottom
      if (ballY - ballSize < 0 || ballY + ballSize > canvas_height) {
        ballSpeedY *= -1;
        ballY = Math.max(ballSize, Math.min(canvas_height - ballSize, ballY));
      }

      // Ball collision with paddles
      if (
        ballX - ballSize < paddleOneX + paddleWidth &&
        ballY > paddleOneY &&
        ballY < paddleOneY + paddleHeight
      ) {
        ballSpeedX = Math.abs(ballSpeedX);
        ballSpeedY += (ballY - (paddleOneY + paddleHeight / 2)) * 0.1;
        ballX = paddleOneX + paddleWidth + ballSize;
      }

      if (
        ballX + ballSize > paddleTwoX &&
        ballY > paddleTwoY &&
        ballY < paddleTwoY + paddleHeight
      ) {
        ballSpeedX = -Math.abs(ballSpeedX);
        ballSpeedY += (ballY - (paddleTwoY + paddleHeight / 2)) * 0.1;
        ballX = paddleTwoX - ballSize;
      }

      // Ball out of bounds - scoring
      if (ballX - ballSize < 0) {
        aiScore++;
        if (aiScore >= 5) {
          gameActive = false;
          setGameState({ playerScore, aiScore, gameActive: false, gameOver: true, winner: "AI" });
          return;
        }
        setGameState({ playerScore, aiScore, gameActive: true, gameOver: false, winner: null });
        resetBall();
      }

      if (ballX + ballSize > canvas_width) {
        playerScore++;
        if (playerScore >= 5) {
          gameActive = false;
          setGameState({ playerScore, aiScore, gameActive: false, gameOver: true, winner: "Player" });
          return;
        }
        setGameState({ playerScore, aiScore, gameActive: true, gameOver: false, winner: null });
        resetBall();
      }

      // Draw paddles
      drawRect(paddleOneX, paddleOneY, paddleWidth, paddleHeight, "#00ff88");
      drawRect(paddleTwoX, paddleTwoY, paddleWidth, paddleHeight, "#ff6b6b");

      // Draw ball
      drawCircle(ballX, ballY, ballSize, "#ffd93d");

      // Draw scores
      drawText(playerScore.toString(), 100, 50, 32, "#00ff88");
      drawText(aiScore.toString(), 700, 50, 32, "#ff6b6b");

      requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0a0e27 0%, #16213e 100%)",
      fontFamily: "'Inter', 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "40px 20px",
      position: "relative",
    }}>
      {/* Close button */}
      <button
        onClick={() => router.back()}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%)",
          border: "none",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 600,
          transition: "all 0.2s ease",
          boxShadow: "0 4px 15px rgba(255, 107, 107, 0.3)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(255, 107, 107, 0.4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 15px rgba(255, 107, 107, 0.3)";
        }}
      >
        ← Back to Chat
      </button>

      <div style={{
        position: "relative",
        animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}>
        {/* Game canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          style={{
            border: "3px solid #4a5595",
            borderRadius: "8px",
            display: "block",
            backgroundColor: "#0a0e27",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
          }}
        />

        {/* Game Over Overlay */}
        {gameState.gameOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.85)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              zIndex: 100,
              animation: "fadeIn 0.3s ease-out",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>
              {gameState.winner === "Player" ? "🎉" : "🤖"}
            </div>
            <div style={{ 
              fontSize: "32px", 
              fontWeight: 700, 
              color: gameState.winner === "Player" ? "#00ff88" : "#ff6b6b",
              marginBottom: "12px"
            }}>
              {gameState.winner === "Player" ? "You Won!" : "AI Won!"}
            </div>
            <div style={{ 
              fontSize: "24px",
              color: "#aaa",
              marginBottom: "24px"
            }}>
              {gameState.playerScore} - {gameState.aiScore}
            </div>
            <button
              onClick={() => router.back()}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #4a5595 0%, #7c6ba6 100%)",
                border: "none",
                color: "#fff",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              Back to Chat
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div
        style={{
          marginTop: "40px",
          color: "#aaa",
          fontSize: "14px",
          textAlign: "center",
          fontFamily: "monospace",
          maxWidth: "600px",
        }}
      >
        <div style={{ marginBottom: "12px" }}>
          <strong style={{ color: "#00ff88" }}>You (Green Paddle)</strong> vs <strong style={{ color: "#ff6b6b" }}>AI (Red Paddle)</strong>
        </div>
        <div>Use <strong>W/S</strong> or <strong>Arrow Keys</strong> to move your paddle</div>
        <div style={{ marginTop: "8px", opacity: 0.6 }}>First to 5 points wins!</div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
