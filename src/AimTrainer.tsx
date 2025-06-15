import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { toast } from 'sonner';

interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
  createdAt: number;
  velocityX?: number;
  velocityY?: number;
  shrinking?: boolean;
}

interface HitEffect {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  type: 'center' | 'ring' | 'edge';
  score: number;
}

interface MissEffect {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  distance: number;
  direction: string;
}

interface GameSettings {
  targetSize: number;
  targetSpeed: number;
  gameTime: number;
  soundEnabled: boolean;
  soundVolume: number;
}

interface GameStats {
  score: number;
  targetsHit: number;
  targetsMissed: number;
  reactionTimes: number[];
  startTime: number;
  centerHits: number;
  ringHits: number;
  edgeHits: number;
  totalShots: number;
  overshoots: number;
  undershoots: number;
  averageMissDistance: number;
}

interface ShotAnalysis {
  distance: number;
  direction: 'overshoot' | 'undershoot' | 'hit';
  angle: number;
}

type HitZone = 'center' | 'ring' | 'edge';

const AimTrainer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [gameMode, setGameMode] = useState<'classic' | 'speed' | 'precision'>('classic');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [missEffects, setMissEffects] = useState<MissEffect[]>([]);
  const [lastShotAnalysis, setLastShotAnalysis] = useState<ShotAnalysis | null>(null);
  const [gameStats, setGameStats] = useState<GameStats>({
    score: 0,
    targetsHit: 0,
    targetsMissed: 0,
    reactionTimes: [],
    startTime: 0,
    centerHits: 0,
    ringHits: 0,
    edgeHits: 0,
    totalShots: 0,
    overshoots: 0,
    undershoots: 0,
    averageMissDistance: 0,
  });
  const [timeLeft, setTimeLeft] = useState(30);
  const [settings, setSettings] = useState<GameSettings>({
    targetSize: 50,
    targetSpeed: 2000,
    gameTime: 30,
    soundEnabled: true,
    soundVolume: 0.7,
  });

  const saveSession = useMutation(api.aimTraining.saveSession);
  const userStats = useQuery(api.aimTraining.getUserStats);

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current && settings.soundEnabled) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [settings.soundEnabled]);

  // Enhanced hit sound with more satisfying center hit
  const playHitSound = useCallback((hitZone: HitZone, distance: number, targetSize: number) => {
    if (!settings.soundEnabled || !audioContextRef.current) return;

    const audioContext = audioContextRef.current;
    
    if (hitZone === 'center') {
      // Super satisfying center hit sound with multiple layers
      const createCenterHitSound = () => {
        // Main tone
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        const filter1 = audioContext.createBiquadFilter();
        
        // Harmonic
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        
        // Sub bass
        const osc3 = audioContext.createOscillator();
        const gain3 = audioContext.createGain();
        
        // Reverb
        const delay = audioContext.createDelay();
        const delayGain = audioContext.createGain();
        const delayFeedback = audioContext.createGain();
        
        // Connect main tone
        osc1.connect(filter1);
        filter1.connect(gain1);
        gain1.connect(audioContext.destination);
        gain1.connect(delay);
        
        // Connect harmonic
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        
        // Connect sub bass
        osc3.connect(gain3);
        gain3.connect(audioContext.destination);
        
        // Connect reverb
        delay.connect(delayGain);
        delayGain.connect(audioContext.destination);
        delay.connect(delayFeedback);
        delayFeedback.connect(delay);
        
        // Main tone - bright and crisp
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, audioContext.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
        
        // Harmonic - adds richness
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(2400, audioContext.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1600, audioContext.currentTime + 0.2);
        
        // Sub bass - adds punch
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(200, audioContext.currentTime);
        osc3.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.15);
        
        // Filter for main tone
        filter1.type = 'lowpass';
        filter1.frequency.setValueAtTime(4000, audioContext.currentTime);
        filter1.Q.setValueAtTime(2, audioContext.currentTime);
        
        // Volume envelopes
        const baseVolume = settings.soundVolume * 0.4;
        
        // Main tone envelope
        gain1.gain.setValueAtTime(0, audioContext.currentTime);
        gain1.gain.linearRampToValueAtTime(baseVolume, audioContext.currentTime + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
        
        // Harmonic envelope
        gain2.gain.setValueAtTime(0, audioContext.currentTime);
        gain2.gain.linearRampToValueAtTime(baseVolume * 0.3, audioContext.currentTime + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        
        // Sub bass envelope
        gain3.gain.setValueAtTime(0, audioContext.currentTime);
        gain3.gain.linearRampToValueAtTime(baseVolume * 0.2, audioContext.currentTime + 0.005);
        gain3.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
        
        // Reverb settings
        delay.delayTime.setValueAtTime(0.08, audioContext.currentTime);
        delayGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        delayFeedback.gain.setValueAtTime(0.4, audioContext.currentTime);
        
        // Start all oscillators
        const startTime = audioContext.currentTime;
        osc1.start(startTime);
        osc2.start(startTime);
        osc3.start(startTime);
        
        // Stop all oscillators
        osc1.stop(startTime + 0.3);
        osc2.stop(startTime + 0.2);
        osc3.stop(startTime + 0.15);
      };
      
      createCenterHitSound();
    } else {
      // Regular hit sounds for ring and edge
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filterNode = audioContext.createBiquadFilter();

      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioContext.destination);

      let frequency: number;
      let duration: number;
      let filterFreq: number;
      let waveType: OscillatorType;

      switch (hitZone) {
        case 'ring':
          frequency = 500 + Math.random() * 150;
          duration = 0.12;
          filterFreq = 2000;
          waveType = 'triangle';
          break;
        case 'edge':
          frequency = 300 + Math.random() * 100;
          duration = 0.1;
          filterFreq = 1500;
          waveType = 'sawtooth';
          break;
        default:
          frequency = 400;
          duration = 0.1;
          filterFreq = 1500;
          waveType = 'sine';
      }

      frequency += (Math.random() - 0.5) * 50;

      oscillator.type = waveType;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.8, audioContext.currentTime + duration);

      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(filterFreq, audioContext.currentTime);
      filterNode.Q.setValueAtTime(1, audioContext.currentTime);

      const baseVolume = settings.soundVolume * 0.3;
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(baseVolume, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    }
  }, [settings.soundEnabled, settings.soundVolume]);

  // Play miss sound
  const playMissSound = useCallback(() => {
    if (!settings.soundEnabled || !audioContextRef.current) return;

    const audioContext = audioContextRef.current;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);

    const baseVolume = settings.soundVolume * 0.2;
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(baseVolume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  }, [settings.soundEnabled, settings.soundVolume]);

  const getCanvasBounds = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 800, height: 600 };
    return { width: canvas.width, height: canvas.height };
  }, []);

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    if (isFullscreen) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    } else {
      canvas.width = 800;
      canvas.height = 600;
    }
  }, [isFullscreen]);

  const getHitZone = (distance: number, targetSize: number): HitZone => {
    const radius = targetSize / 2;
    if (distance <= radius * 0.25) return 'center';
    if (distance <= radius * 0.6) return 'ring';
    return 'edge';
  };

  const getScoreMultiplier = (hitZone: HitZone): number => {
    switch (hitZone) {
      case 'center': return 2.0;
      case 'ring': return 1.5;
      case 'edge': return 1.0;
    }
  };

  const analyzeShot = (clickX: number, clickY: number, targets: Target[]): ShotAnalysis => {
    if (targets.length === 0) {
      return { distance: 0, direction: 'hit', angle: 0 };
    }

    // Find closest target
    let closestTarget = targets[0];
    let minDistance = Math.sqrt(Math.pow(clickX - targets[0].x, 2) + Math.pow(clickY - targets[0].y, 2));

    for (const target of targets) {
      const distance = Math.sqrt(Math.pow(clickX - target.x, 2) + Math.pow(clickY - target.y, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestTarget = target;
      }
    }

    const angle = Math.atan2(clickY - closestTarget.y, clickX - closestTarget.x) * 180 / Math.PI;
    const targetRadius = closestTarget.size / 2;

    if (minDistance <= targetRadius) {
      return { distance: minDistance, direction: 'hit', angle };
    }

    // Determine if overshoot or undershoot based on distance from center
    const direction = minDistance > targetRadius * 1.5 ? 'overshoot' : 'undershoot';
    
    return { distance: minDistance, direction, angle };
  };

  const getDirectionText = (angle: number): string => {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'right';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'bottom-right';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'bottom';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'bottom-left';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'left';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'top-left';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'top';
    return 'top-right';
  };

  const spawnTarget = useCallback(() => {
    const bounds = getCanvasBounds();
    const margin = settings.targetSize;
    
    let newTarget: Target = {
      id: Date.now() + Math.random(),
      x: margin + Math.random() * (bounds.width - 2 * margin),
      y: margin + Math.random() * (bounds.height - 2 * margin),
      size: settings.targetSize,
      createdAt: Date.now(),
    };

    switch (gameMode) {
      case 'speed':
        const speed = 50 + Math.random() * 100;
        const angle = Math.random() * 2 * Math.PI;
        newTarget.velocityX = Math.cos(angle) * speed;
        newTarget.velocityY = Math.sin(angle) * speed;
        newTarget.size = Math.max(20, settings.targetSize - 15);
        break;
      
      case 'precision':
        newTarget.shrinking = true;
        newTarget.size = settings.targetSize + 20;
        break;
      
      default:
        newTarget.size = settings.targetSize + (Math.random() - 0.5) * 10;
        break;
    }

    setTargets(prev => [...prev, newTarget]);

    setTimeout(() => {
      setTargets(prev => {
        const filtered = prev.filter(t => t.id !== newTarget.id);
        if (prev.length > filtered.length) {
          setGameStats(stats => ({
            ...stats,
            targetsMissed: stats.targetsMissed + 1,
          }));
        }
        return filtered;
      });
    }, getTargetLifetime());
  }, [settings, getCanvasBounds, gameMode]);

  const getTargetLifetime = () => {
    switch (gameMode) {
      case 'speed': return Math.max(800, settings.targetSpeed - 500);
      case 'precision': return settings.targetSpeed + 1000;
      default: return settings.targetSpeed;
    }
  };

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;

    initAudioContext();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Analyze the shot
    const shotAnalysis = analyzeShot(clickX, clickY, targets);
    setLastShotAnalysis(shotAnalysis);

    let hitTarget = false;

    setTargets(prev => {
      const newTargets = prev.filter(target => {
        const distance = Math.sqrt(
          Math.pow(clickX - target.x, 2) + Math.pow(clickY - target.y, 2)
        );

        if (distance <= target.size / 2) {
          const reactionTime = Date.now() - target.createdAt;
          const hitZone = getHitZone(distance, target.size);
          const scoreMultiplier = getScoreMultiplier(hitZone);
          const score = Math.floor(getScoreForMode(gameMode, reactionTime, target) * scoreMultiplier);
          
          hitTarget = true;
          
          // Create hit effect
          setHitEffects(prev => [...prev, {
            id: Date.now() + Math.random(),
            x: clickX,
            y: clickY,
            createdAt: Date.now(),
            type: hitZone,
            score: score,
          }]);
          
          playHitSound(hitZone, distance, target.size);
          
          setGameStats(stats => {
            const newStats = {
              ...stats,
              score: stats.score + score,
              targetsHit: stats.targetsHit + 1,
              reactionTimes: [...stats.reactionTimes, reactionTime],
              totalShots: stats.totalShots + 1,
            };

            switch (hitZone) {
              case 'center':
                newStats.centerHits = stats.centerHits + 1;
                break;
              case 'ring':
                newStats.ringHits = stats.ringHits + 1;
                break;
              case 'edge':
                newStats.edgeHits = stats.edgeHits + 1;
                break;
            }

            return newStats;
          });

          return false;
        }
        return true;
      });

      return newTargets;
    });

    if (!hitTarget) {
      playMissSound();
      
      // Create miss effect
      setMissEffects(prev => [...prev, {
        id: Date.now() + Math.random(),
        x: clickX,
        y: clickY,
        createdAt: Date.now(),
        distance: shotAnalysis.distance,
        direction: getDirectionText(shotAnalysis.angle),
      }]);
      
      const penalty = gameMode === 'precision' ? 2 : 1;
      setGameStats(stats => {
        const newMissDistance = (stats.averageMissDistance * stats.targetsMissed + shotAnalysis.distance) / (stats.targetsMissed + 1);
        return {
          ...stats,
          targetsMissed: stats.targetsMissed + penalty,
          totalShots: stats.totalShots + 1,
          overshoots: shotAnalysis.direction === 'overshoot' ? stats.overshoots + 1 : stats.overshoots,
          undershoots: shotAnalysis.direction === 'undershoot' ? stats.undershoots + 1 : stats.undershoots,
          averageMissDistance: newMissDistance,
        };
      });
    }
  }, [isPlaying, gameMode, initAudioContext, playHitSound, playMissSound, targets]);

  const getScoreForMode = (mode: string, reactionTime: number, target: Target): number => {
    switch (mode) {
      case 'speed':
        const speedBonus = target.velocityX || target.velocityY ? 50 : 0;
        return Math.max(150 - Math.floor(reactionTime / 8), 20) + speedBonus;
      case 'precision':
        const sizeBonus = Math.max(0, (settings.targetSize - target.size) * 5);
        const precisionBonus = reactionTime < 300 ? 300 : reactionTime < 600 ? 200 : 100;
        return precisionBonus + sizeBonus;
      default:
        return Math.max(150 - Math.floor(reactionTime / 20), 25);
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!isFullscreen) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      toast.error('Fullscreen not supported');
    }
  };

  const startGame = () => {
    initAudioContext();
    setIsPlaying(true);
    setTimeLeft(settings.gameTime);
    setGameStats({
      score: 0,
      targetsHit: 0,
      targetsMissed: 0,
      reactionTimes: [],
      startTime: Date.now(),
      centerHits: 0,
      ringHits: 0,
      edgeHits: 0,
      totalShots: 0,
      overshoots: 0,
      undershoots: 0,
      averageMissDistance: 0,
    });
    setTargets([]);
    setHitEffects([]);
    setMissEffects([]);
    setLastShotAnalysis(null);
    spawnTarget();
  };

  const stopGame = async () => {
    await endGame();
  };

  const endGame = async () => {
    setIsPlaying(false);
    setTargets([]);

    const totalTargets = gameStats.targetsHit + gameStats.targetsMissed;
    const accuracy = totalTargets > 0 ? (gameStats.targetsHit / totalTargets) * 100 : 0;
    const avgReactionTime = gameStats.reactionTimes.length > 0 
      ? gameStats.reactionTimes.reduce((a, b) => a + b, 0) / gameStats.reactionTimes.length 
      : 0;

    try {
      await saveSession({
        gameMode,
        score: gameStats.score,
        accuracy,
        averageReactionTime: avgReactionTime,
        targetsHit: gameStats.targetsHit,
        targetsMissed: gameStats.targetsMissed,
        duration: settings.gameTime,
        centerHits: gameStats.centerHits,
        ringHits: gameStats.ringHits,
        edgeHits: gameStats.edgeHits,
        settings: {
          targetSize: settings.targetSize,
          targetSpeed: settings.targetSpeed,
          gameTime: settings.gameTime,
        },
      });
      
      const centerPercent = gameStats.targetsHit > 0 ? (gameStats.centerHits / gameStats.targetsHit * 100).toFixed(1) : '0';
      toast.success(`Game saved! Score: ${gameStats.score}, Accuracy: ${accuracy.toFixed(1)}%, Center hits: ${centerPercent}%`);
    } catch (error) {
      toast.error('Failed to save game session');
    }
  };

  // Clean up effects
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setHitEffects(prev => prev.filter(effect => now - effect.createdAt < 1000));
      setMissEffects(prev => prev.filter(effect => now - effect.createdAt < 1500));
    }, 100);

    return () => clearInterval(cleanup);
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Update canvas size when fullscreen changes
  useEffect(() => {
    updateCanvasSize();
    const handleResize = () => updateCanvasSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen, updateCanvasSize]);

  // Game timer
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying]);

  // Target spawning
  useEffect(() => {
    if (!isPlaying) return;

    const spawnInterval = setInterval(() => {
      if (targets.length < getMaxTargets()) {
        spawnTarget();
      }
    }, getSpawnRate());

    return () => clearInterval(spawnInterval);
  }, [isPlaying, targets.length, spawnTarget]);

  // Target movement and shrinking animation
  useEffect(() => {
    if (!isPlaying) return;

    const animationInterval = setInterval(() => {
      setTargets(prev => prev.map(target => {
        const bounds = getCanvasBounds();
        let newTarget = { ...target };

        if (target.velocityX !== undefined && target.velocityY !== undefined) {
          newTarget.x += target.velocityX * 0.016;
          newTarget.y += target.velocityY * 0.016;

          if (newTarget.x <= target.size/2 || newTarget.x >= bounds.width - target.size/2) {
            newTarget.velocityX = -target.velocityX;
          }
          if (newTarget.y <= target.size/2 || newTarget.y >= bounds.height - target.size/2) {
            newTarget.velocityY = -target.velocityY;
          }

          newTarget.x = Math.max(target.size/2, Math.min(bounds.width - target.size/2, newTarget.x));
          newTarget.y = Math.max(target.size/2, Math.min(bounds.height - target.size/2, newTarget.y));
        }

        if (target.shrinking) {
          const age = Date.now() - target.createdAt;
          const maxAge = getTargetLifetime();
          const shrinkFactor = Math.max(0.3, 1 - (age / maxAge) * 0.7);
          newTarget.size = (settings.targetSize + 20) * shrinkFactor;
        }

        return newTarget;
      }));
    }, 16);

    return () => clearInterval(animationInterval);
  }, [isPlaying, settings.targetSize, getCanvasBounds]);

  const getMaxTargets = () => {
    switch (gameMode) {
      case 'speed': return 4;
      case 'precision': return 1;
      default: return 2;
    }
  };

  const getSpawnRate = () => {
    switch (gameMode) {
      case 'speed': return 600;
      case 'precision': return 3000;
      default: return 1200;
    }
  };

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw crosshair
    if (!isPlaying) {
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 2;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 20, centerY);
      ctx.lineTo(centerX + 20, centerY);
      ctx.moveTo(centerX, centerY - 20);
      ctx.lineTo(centerX, centerY + 20);
      ctx.stroke();
    }

    // Draw targets with hit zones
    targets.forEach(target => {
      const age = Date.now() - target.createdAt;
      const maxAge = getTargetLifetime();
      let opacity = Math.max(0.3, 1 - (age / maxAge));

      switch (gameMode) {
        case 'speed':
          const pulse = Math.sin(age * 0.01) * 0.2 + 0.8;
          opacity *= pulse;
          ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`;
          break;
        case 'precision':
          const intensity = Math.max(0.5, 2 - (target.size / (settings.targetSize + 20)));
          ctx.fillStyle = `rgba(59, 130, 246, ${opacity * intensity})`;
          break;
        default:
          ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`;
          break;
      }

      const radius = target.size / 2;
      
      // Outer ring (edge zone)
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Middle ring (ring zone)
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius * 0.6, 0, 2 * Math.PI);
      ctx.fill();

      // Center zone
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius * 0.25, 0, 2 * Math.PI);
      ctx.fill();

      // Target rings for visual clarity
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius * 0.6, 0, 2 * Math.PI);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius * 0.25, 0, 2 * Math.PI);
      ctx.stroke();

      // Movement trail for speed mode
      if (target.velocityX !== undefined && target.velocityY !== undefined) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${opacity * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(target.x - target.velocityX * 0.1, target.y - target.velocityY * 0.1);
        ctx.stroke();
      }
    });

    // Draw hit effects
    hitEffects.forEach(effect => {
      const age = Date.now() - effect.createdAt;
      const progress = age / 1000; // 1 second duration
      const opacity = Math.max(0, 1 - progress);
      const scale = 1 + progress * 2; // Expand over time

      // Color based on hit zone
      let color = '';
      switch (effect.type) {
        case 'center':
          color = `rgba(255, 215, 0, ${opacity})`; // Gold
          break;
        case 'ring':
          color = `rgba(0, 255, 0, ${opacity})`; // Green
          break;
        case 'edge':
          color = `rgba(255, 165, 0, ${opacity})`; // Orange
          break;
      }

      // Draw expanding circle
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 20 * scale, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw score text
      if (progress < 0.5) {
        ctx.fillStyle = color;
        ctx.font = `${16 + scale * 4}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`+${effect.score}`, effect.x, effect.y - 30 * scale);
      }
    });

    // Draw miss effects
    missEffects.forEach(effect => {
      const age = Date.now() - effect.createdAt;
      const progress = age / 1500; // 1.5 second duration
      const opacity = Math.max(0, 1 - progress);

      // Red X for misses
      ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
      ctx.lineWidth = 3;
      const size = 15;
      ctx.beginPath();
      ctx.moveTo(effect.x - size, effect.y - size);
      ctx.lineTo(effect.x + size, effect.y + size);
      ctx.moveTo(effect.x + size, effect.y - size);
      ctx.lineTo(effect.x - size, effect.y + size);
      ctx.stroke();

      // Miss distance text
      if (progress < 0.7) {
        ctx.fillStyle = `rgba(255, 100, 100, ${opacity})`;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${effect.distance.toFixed(0)}px ${effect.direction}`, effect.x, effect.y + 25);
      }
    });

    // Fullscreen UI overlay
    if (isFullscreen && isPlaying) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 350, 140);
      ctx.fillStyle = 'white';
      ctx.font = '18px Arial';
      ctx.fillText(`Score: ${gameStats.score}`, 20, 35);
      ctx.fillText(`Time: ${timeLeft}s`, 20, 55);
      ctx.fillText(`Accuracy: ${((gameStats.targetsHit / Math.max(1, gameStats.targetsHit + gameStats.targetsMissed)) * 100).toFixed(1)}%`, 20, 75);
      ctx.fillText(`Center: ${gameStats.centerHits} | Ring: ${gameStats.ringHits} | Edge: ${gameStats.edgeHits}`, 20, 95);
      
      if (lastShotAnalysis) {
        ctx.font = '14px Arial';
        ctx.fillText(`Last shot: ${lastShotAnalysis.direction} (${lastShotAnalysis.distance.toFixed(0)}px)`, 20, 115);
      }
    }
  }, [targets, isPlaying, settings.targetSpeed, gameMode, gameStats, timeLeft, isFullscreen, hitEffects, missEffects, lastShotAnalysis]);

  const totalTargets = gameStats.targetsHit + gameStats.targetsMissed;
  const accuracy = totalTargets > 0 ? (gameStats.targetsHit / totalTargets) * 100 : 0;

  const getModeDescription = (mode: string) => {
    switch (mode) {
      case 'speed':
        return 'Fast-moving targets, quick reactions required';
      case 'precision':
        return 'Shrinking targets, accuracy over speed';
      default:
        return 'Balanced gameplay for general training';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-2">🎯 AimLab Pro</h1>
        <p className="text-gray-400">Train your aim for competitive FPS gaming</p>
      </div>

      {/* Game Mode Selection */}
      <div className="space-y-4">
        <div className="flex justify-center space-x-4">
          {(['classic', 'speed', 'precision'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setGameMode(mode)}
              disabled={isPlaying}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                gameMode === mode
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } disabled:opacity-50`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-400">{getModeDescription(gameMode)}</p>
        </div>
      </div>

      {/* Settings */}
      {!isPlaying && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Target Size</label>
              <input
                type="range"
                min="30"
                max="80"
                value={settings.targetSize}
                onChange={(e) => setSettings(prev => ({ ...prev, targetSize: parseInt(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-400">{settings.targetSize}px</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Target Duration</label>
              <input
                type="range"
                min="1000"
                max="4000"
                step="100"
                value={settings.targetSpeed}
                onChange={(e) => setSettings(prev => ({ ...prev, targetSpeed: parseInt(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-400">{settings.targetSpeed}ms</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Game Time</label>
              <input
                type="range"
                min="15"
                max="120"
                step="15"
                value={settings.gameTime}
                onChange={(e) => setSettings(prev => ({ ...prev, gameTime: parseInt(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-400">{settings.gameTime}s</span>
            </div>
          </div>
          
          {/* Audio Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="soundEnabled"
                checked={settings.soundEnabled}
                onChange={(e) => setSettings(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="soundEnabled" className="text-sm font-medium">Enable Hit Sounds</label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sound Volume</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.soundVolume}
                onChange={(e) => setSettings(prev => ({ ...prev, soundVolume: parseFloat(e.target.value) }))}
                disabled={!settings.soundEnabled}
                className="w-full"
              />
              <span className="text-sm text-gray-400">{Math.round(settings.soundVolume * 100)}%</span>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-400">
            <p><strong>Hit Zones:</strong> Center (2x score) • Ring (1.5x score) • Edge (1x score)</p>
            <p><strong>Effects:</strong> Visual hit feedback • Enhanced center hit sound • Shot analysis</p>
          </div>
        </div>
      )}

      {/* Game Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{gameStats.score}</div>
          <div className="text-sm text-gray-400">Score</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-500">{accuracy.toFixed(1)}%</div>
          <div className="text-sm text-gray-400">Accuracy</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">{gameStats.targetsHit}</div>
          <div className="text-sm text-gray-400">Hits</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-500">{timeLeft}s</div>
          <div className="text-sm text-gray-400">Time Left</div>
        </div>
      </div>

      {/* Live Shot Analysis */}
      {isPlaying && (
        <div className="space-y-4">
          {/* Hit Zone Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-yellow-400">{gameStats.centerHits}</div>
              <div className="text-xs text-gray-400">Center (2x)</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-400">{gameStats.ringHits}</div>
              <div className="text-xs text-gray-400">Ring (1.5x)</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-400">{gameStats.edgeHits}</div>
              <div className="text-xs text-gray-400">Edge (1x)</div>
            </div>
          </div>

          {/* Shot Analysis */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-center">Live Shot Analysis</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-400">{gameStats.totalShots}</div>
                <div className="text-xs text-gray-400">Total Shots</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-400">{gameStats.overshoots}</div>
                <div className="text-xs text-gray-400">Overshoots</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-cyan-400">{gameStats.undershoots}</div>
                <div className="text-xs text-gray-400">Undershoots</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-pink-400">{gameStats.averageMissDistance.toFixed(0)}px</div>
                <div className="text-xs text-gray-400">Avg Miss</div>
              </div>
            </div>
            
            {lastShotAnalysis && (
              <div className="mt-3 text-center">
                <div className="text-sm">
                  <span className="text-gray-400">Last shot: </span>
                  <span className={`font-semibold ${
                    lastShotAnalysis.direction === 'hit' ? 'text-green-400' :
                    lastShotAnalysis.direction === 'overshoot' ? 'text-orange-400' : 'text-cyan-400'
                  }`}>
                    {lastShotAnalysis.direction === 'hit' ? 'HIT!' : 
                     lastShotAnalysis.direction === 'overshoot' ? 'OVERSHOOT' : 'UNDERSHOOT'}
                  </span>
                  {lastShotAnalysis.direction !== 'hit' && (
                    <span className="text-gray-400"> ({lastShotAnalysis.distance.toFixed(0)}px off)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Canvas */}
      <div className="flex justify-center">
        <div 
          ref={containerRef}
          className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : ''}`}
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onClick={handleCanvasClick}
            className={`border-2 border-gray-700 rounded-lg cursor-crosshair bg-gray-800 ${
              isFullscreen ? 'w-full h-full' : ''
            }`}
            style={{ cursor: isPlaying ? 'crosshair' : 'default' }}
          />
          
          {/* Control Buttons */}
          <div className="absolute top-4 right-4 flex space-x-2">
            {isPlaying && (
              <button
                onClick={stopGame}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-semibold"
              >
                Stop Game
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          </div>

          {/* Start Game Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <button
                  onClick={startGame}
                  className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-lg transition-colors mb-4"
                >
                  Start Training
                </button>
                <p className="text-gray-400 text-sm">
                  Click the fullscreen button for immersive training
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  🎵 Enhanced audio feedback • 💥 Visual hit effects • 📊 Live shot analysis
                </p>
              </div>
            </div>
          )}

          {/* Exit Fullscreen Hint */}
          {isFullscreen && isPlaying && (
            <div className="absolute top-4 left-4 text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded">
              Press ESC to exit fullscreen
            </div>
          )}
        </div>
      </div>

      {/* User Stats */}
      {userStats && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Your Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-500">{userStats.totalSessions}</div>
              <div className="text-sm text-gray-400">Total Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-500">{userStats.bestScore}</div>
              <div className="text-sm text-gray-400">Best Score</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-500">{userStats.averageAccuracy.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">Avg Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-500">{userStats.averageReactionTime.toFixed(0)}ms</div>
              <div className="text-sm text-gray-400">Avg Reaction</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AimTrainer;
