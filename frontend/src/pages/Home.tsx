import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import { useApp } from '../store'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

type ThemeType = 'synthwave' | 'win95' | 'terminal'
type GameType = 'space' | 'snake'
type PageView = 'hub' | 'snake-page'
type Widget3Tab = 'ladder' | 'guestbook'
type LadderEntry = { username: string; rating: number; avatar?: string }

export function Home() {
	const { t } = useTranslation()
	const { user } = useApp()

	// ------------------------------------------------------------------------
	// 1. PAGE VIEW (HUB vs FULL SNAKE PAGE)
	// ------------------------------------------------------------------------
	const [pageView, setPageView] = useState<PageView>('hub')
	const [widget3Tab, setWidget3Tab] = useState<Widget3Tab>('ladder')

	// ------------------------------------------------------------------------
	// 2. LIVE LEADERBOARD LADDER API
	// ------------------------------------------------------------------------
	const [ladder, setLadder] = useState<LadderEntry[] | null>(null)
	const [isLadderLoading, setIsLadderLoading] = useState(false)

	useEffect(() => {
		let cancelled = false
		setIsLadderLoading(true)
		fetch('/api/leaderboard?mode=global&limit=4', { credentials: 'include' })
			.then((r) => (r.ok ? (r.json() as Promise<{ entries: LadderEntry[] }>) : Promise.reject(r.status)))
			.then((body) => {
				if (!cancelled) {
					setLadder(body.entries)
					setIsLadderLoading(false)
				}
			})
			.catch((e) => {
				console.error(e)
				if (!cancelled) {
					setLadder([])
					setIsLadderLoading(false)
				}
			})
		return () => {
			cancelled = true
		}
	}, [])

	// ------------------------------------------------------------------------
	// 3. THEME & CRT CONTROLS
	// ------------------------------------------------------------------------
	const [theme, setTheme] = useState<ThemeType>('synthwave')
	const [isThemePopoverOpen, setIsThemePopoverOpen] = useState(false)
	const [crtEnabled, setCrtEnabled] = useState(true)

	const applyTheme = (newTheme: ThemeType) => {
		setTheme(newTheme)
		document.documentElement.setAttribute('data-theme', newTheme)
		document.body.setAttribute('data-theme', newTheme)
		localStorage.setItem('retro_theme', newTheme)
		retroAudio.playUiBeep(880, 0.05)
	}

	useEffect(() => {
		const savedTheme = (localStorage.getItem('retro_theme') as ThemeType) || 'synthwave'
		setTheme(savedTheme)
		document.documentElement.setAttribute('data-theme', savedTheme)
		document.body.setAttribute('data-theme', savedTheme)

		const savedCrt = localStorage.getItem('retro_crt')
		if (savedCrt === 'false') {
			setCrtEnabled(false)
		}
	}, [])

	const toggleCrt = () => {
		const next = !crtEnabled
		setCrtEnabled(next)
		localStorage.setItem('retro_crt', next ? 'true' : 'false')
		retroAudio.playUiBeep(440, 0.05)
	}

	// ------------------------------------------------------------------------
	// 4. CHIPTUNE BOOMBOX
	// ------------------------------------------------------------------------
	const [isPlayingAudio, setIsPlayingAudio] = useState(false)
	const [currentTrack, setCurrentTrack] = useState("SYNTHWAVE NIGHTS '84")
	const [isMuted, setIsMuted] = useState(false)
	const [spectrumHeights, setSpectrumHeights] = useState<number[]>([
		20, 45, 70, 30, 85, 60, 40, 90, 55, 35, 75, 50,
	])

	const handleToggleAudio = () => {
		const playing = retroAudio.togglePlay()
		setIsPlayingAudio(playing)
	}

	const handleNextTrack = () => {
		const name = retroAudio.nextTrack()
		setCurrentTrack(name)
		retroAudio.playUiBeep(1200, 0.08)
	}

	const handleToggleMute = () => {
		retroAudio.muted = !retroAudio.muted
		setIsMuted(retroAudio.muted)
	}

	useEffect(() => {
		if (typeof window !== 'undefined') {
			;(window as unknown as { updateSpectrumBars?: () => void }).updateSpectrumBars = () => {
				setSpectrumHeights(
					Array.from({ length: 12 }, () => Math.floor(Math.random() * 85) + 15)
				)
			}
		}
	}, [])

	useEffect(() => {
		if (!isPlayingAudio) {
			setSpectrumHeights([15, 20, 15, 25, 20, 15, 20, 25, 15, 20, 15, 20])
		}
	}, [isPlayingAudio])

	// ------------------------------------------------------------------------
	// 5. STICKY NOTES & GUESTBOOK
	// ------------------------------------------------------------------------
	const [notes, setNotes] = useState<string[]>([
		'Welcome to the Retro Arcade! Press Play to start chiptunes!',
		'High score challenge: Can you beat 1,000 pts in Space Defender?',
		'Retro wave visuals inspired by 1984 arcade culture!',
	])
	const [newNote, setNewNote] = useState('')

	useEffect(() => {
		const saved = localStorage.getItem('retro_sticky_notes')
		if (saved) {
			try {
				setNotes(JSON.parse(saved))
			} catch (e) {
				console.error(e)
			}
		}
	}, [])

	const handleAddNote = () => {
		if (!newNote.trim()) return
		const updated = [newNote.trim(), ...notes]
		setNotes(updated)
		localStorage.setItem('retro_sticky_notes', JSON.stringify(updated))
		setNewNote('')
		retroAudio.playUiBeep(700, 0.08)
	}

	const handleDeleteNote = (index: number) => {
		const updated = [...notes]
		updated.splice(index, 1)
		setNotes(updated)
		localStorage.setItem('retro_sticky_notes', JSON.stringify(updated))
		retroAudio.playUiBeep(300, 0.05)
	}

	// ------------------------------------------------------------------------
	// 6. SYSTEM TELEMETRY & DIGITAL CLOCK
	// ------------------------------------------------------------------------
	const [clockTime, setClockTime] = useState('12:00:00')
	const [cpuWidth, setCpuWidth] = useState(45)
	const [memWidth, setMemWidth] = useState(62)

	useEffect(() => {
		const updateClock = () => {
			const now = new Date()
			const hrs = String(now.getHours()).padStart(2, '0')
			const mins = String(now.getMinutes()).padStart(2, '0')
			const secs = String(now.getSeconds()).padStart(2, '0')
			setClockTime(`${hrs}:${mins}:${secs}`)
		}
		updateClock()
		const clockTimer = setInterval(updateClock, 1000)

		const jitterTimer = setInterval(() => {
			setCpuWidth(Math.floor(Math.random() * 40) + 30)
			setMemWidth(Math.floor(Math.random() * 20) + 55)
		}, 2500)

		return () => {
			clearInterval(clockTimer)
			clearInterval(jitterTimer)
		}
	}, [])

	// ------------------------------------------------------------------------
	// 7. HUB ARCADE CANVAS (SPACE DEFENDER & SNAKE MINI)
	// ------------------------------------------------------------------------
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [activeGame, setActiveGame] = useState<GameType>('space')
	const [score, setScore] = useState(0)
	const [highScore, setHighScore] = useState(0)

	useEffect(() => {
		const saved = parseInt(localStorage.getItem('retro_arcade_highscore') || '0', 10)
		setHighScore(saved)
	}, [])

	useEffect(() => {
		if (pageView !== 'hub') return
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		let isGameOver = false
		let currentScore = 0
		let animId: number

		const keys: Record<string, boolean> = {}
		const onKeyDown = (e: KeyboardEvent) => {
			keys[e.code] = true
			if (e.code === 'KeyR' && isGameOver) {
				restart()
			}
		}
		const onKeyUp = (e: KeyboardEvent) => {
			keys[e.code] = false
		}
		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('keyup', onKeyUp)

		// Space Defender
		let player = {
			x: canvas.width / 2 - 15,
			y: canvas.height - 40,
			w: 30,
			h: 20,
			speed: 5,
		}
		let lasers: Array<{ x: number; y: number; w: number; h: number; speed: number }> = []
		let enemies: Array<{
			x: number
			y: number
			w: number
			h: number
			speed: number
			color: string
		}> = []
		let particles: Array<{
			x: number
			y: number
			vx: number
			vy: number
			life: number
			color: string
		}> = []
		let enemySpawnTimer = 0
		let shootCooldown = 0

		// Snake Mini
		const gridSize = 16
		let snake: Array<{ x: number; y: number }> = [
			{ x: 10, y: 10 },
			{ x: 9, y: 10 },
			{ x: 8, y: 10 },
		]
		let dir = { x: 1, y: 0 }
		let nextDir = { x: 1, y: 0 }
		let food = { x: 15, y: 10 }
		let snakeTick = 0

		const spawnFood = () => {
			const cols = Math.floor(canvas.width / gridSize)
			const rows = Math.floor(canvas.height / gridSize)
			food = {
				x: Math.floor(Math.random() * cols),
				y: Math.floor(Math.random() * rows),
			}
		}
		spawnFood()

		const triggerGameOver = () => {
			isGameOver = true
			retroAudio.playExplosionSound()
		}

		const saveHighScore = (newScore: number) => {
			const best = parseInt(localStorage.getItem('retro_arcade_highscore') || '0', 10)
			if (newScore > best) {
				localStorage.setItem('retro_arcade_highscore', String(newScore))
				setHighScore(newScore)
			}
		}

		const restart = () => {
			isGameOver = false
			currentScore = 0
			setScore(0)
			if (activeGame === 'space') {
				player = {
					x: canvas.width / 2 - 15,
					y: canvas.height - 40,
					w: 30,
					h: 20,
					speed: 5,
				}
				lasers = []
				enemies = []
				particles = []
				enemySpawnTimer = 0
				shootCooldown = 0
			} else {
				snake = [
					{ x: 10, y: 10 },
					{ x: 9, y: 10 },
					{ x: 8, y: 10 },
				]
				dir = { x: 1, y: 0 }
				nextDir = { x: 1, y: 0 }
				spawnFood()
				snakeTick = 0
			}
		}

		const onCanvasClick = () => {
			if (isGameOver) {
				restart()
			}
		}
		canvas.addEventListener('click', onCanvasClick)

		const loop = () => {
			if (activeGame === 'space') {
				if (!isGameOver) {
					if ((keys['ArrowLeft'] || keys['KeyA']) && player.x > 0) {
						player.x -= player.speed
					}
					if ((keys['ArrowRight'] || keys['KeyD']) && player.x + player.w < canvas.width) {
						player.x += player.speed
					}

					if (shootCooldown > 0) shootCooldown--
					if (
						(keys['Space'] || keys['ArrowUp'] || keys['KeyW']) &&
						shootCooldown === 0
					) {
						lasers.push({
							x: player.x + player.w / 2 - 2,
							y: player.y,
							w: 4,
							h: 10,
							speed: 7,
						})
						shootCooldown = 12
						retroAudio.playLaserSound()
					}

					for (let i = lasers.length - 1; i >= 0; i--) {
						lasers[i].y -= lasers[i].speed
						if (lasers[i].y < 0) lasers.splice(i, 1)
					}

					enemySpawnTimer++
					if (enemySpawnTimer > 40) {
						enemySpawnTimer = 0
						enemies.push({
							x: Math.random() * (canvas.width - 24),
							y: -20,
							w: 24,
							h: 20,
							speed: 1.8 + Math.random() * 1.5,
							color: ['#ff007f', '#00f0ff', '#ffe600'][Math.floor(Math.random() * 3)],
						})
					}

					for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
						const enemy = enemies[eIdx]
						enemy.y += enemy.speed

						if (enemy.y > canvas.height) {
							triggerGameOver()
							break
						}

						for (let lIdx = lasers.length - 1; lIdx >= 0; lIdx--) {
							const laser = lasers[lIdx]
							if (
								laser.x < enemy.x + enemy.w &&
								laser.x + laser.w > enemy.x &&
								laser.y < enemy.y + enemy.h &&
								laser.y + laser.h > enemy.y
							) {
								for (let p = 0; p < 8; p++) {
									particles.push({
										x: enemy.x + enemy.w / 2,
										y: enemy.y + enemy.h / 2,
										vx: (Math.random() - 0.5) * 4,
										vy: (Math.random() - 0.5) * 4,
										life: 15,
										color: enemy.color,
									})
								}
								enemies.splice(eIdx, 1)
								lasers.splice(lIdx, 1)
								currentScore += 100
								setScore(currentScore)
								saveHighScore(currentScore)
								retroAudio.playExplosionSound()
								break
							}
						}
					}

					for (let pIdx = particles.length - 1; pIdx >= 0; pIdx--) {
						const part = particles[pIdx]
						part.x += part.vx
						part.y += part.vy
						part.life--
						if (part.life <= 0) particles.splice(pIdx, 1)
					}
				}

				ctx.clearRect(0, 0, canvas.width, canvas.height)

				ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
				for (let i = 0; i < 20; i++) {
					const sx = (Math.sin(i * 99 + Date.now() * 0.001) * 0.5 + 0.5) * canvas.width
					const sy = (Math.cos(i * 33 + Date.now() * 0.0005) * 0.5 + 0.5) * canvas.height
					ctx.fillRect(sx, sy, 2, 2)
				}

				ctx.fillStyle = '#00f0ff'
				ctx.shadowBlur = 10
				ctx.shadowColor = '#00f0ff'
				ctx.beginPath()
				ctx.moveTo(player.x + player.w / 2, player.y)
				ctx.lineTo(player.x + player.w, player.y + player.h)
				ctx.lineTo(player.x, player.y + player.h)
				ctx.closePath()
				ctx.fill()

				ctx.fillStyle = '#ffe600'
				ctx.shadowColor = '#ffe600'
				lasers.forEach((l) => ctx.fillRect(l.x, l.y, l.w, l.h))

				enemies.forEach((e) => {
					ctx.fillStyle = e.color
					ctx.shadowColor = e.color
					ctx.fillRect(e.x, e.y, e.w, e.h)
				})

				particles.forEach((p) => {
					ctx.fillStyle = p.color
					ctx.shadowColor = p.color
					ctx.fillRect(p.x, p.y, 3, 3)
				})

				ctx.shadowBlur = 0
			} else {
				if (!isGameOver) {
					if ((keys['ArrowUp'] || keys['KeyW']) && dir.y === 0) nextDir = { x: 0, y: -1 }
					if ((keys['ArrowDown'] || keys['KeyS']) && dir.y === 0) nextDir = { x: 0, y: 1 }
					if ((keys['ArrowLeft'] || keys['KeyA']) && dir.x === 0) nextDir = { x: -1, y: 0 }
					if ((keys['ArrowRight'] || keys['KeyD']) && dir.x === 0) nextDir = { x: 1, y: 0 }

					snakeTick++
					if (snakeTick >= 6) {
						snakeTick = 0
						dir = nextDir
						const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }

						const cols = Math.floor(canvas.width / gridSize)
						const rows = Math.floor(canvas.height / gridSize)

						if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
							triggerGameOver()
						} else {
							let selfCollision = false
							for (let i = 0; i < snake.length; i++) {
								if (snake[i].x === head.x && snake[i].y === head.y) {
									selfCollision = true
									break
								}
							}
							if (selfCollision) {
								triggerGameOver()
							} else {
								snake.unshift(head)
								if (head.x === food.x && head.y === food.y) {
									currentScore += 50
									setScore(currentScore)
									saveHighScore(currentScore)
									spawnFood()
									retroAudio.playUiBeep(660, 0.1, 'square')
								} else {
									snake.pop()
								}
							}
						}
					}
				}

				ctx.clearRect(0, 0, canvas.width, canvas.height)

				ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)'
				for (let x = 0; x < canvas.width; x += gridSize) {
					ctx.beginPath()
					ctx.moveTo(x, 0)
					ctx.lineTo(x, canvas.height)
					ctx.stroke()
				}

				snake.forEach((seg, idx) => {
					ctx.fillStyle = idx === 0 ? '#ffe600' : '#00f0ff'
					ctx.shadowBlur = 8
					ctx.shadowColor = '#00f0ff'
					ctx.fillRect(seg.x * gridSize + 1, seg.y * gridSize + 1, gridSize - 2, gridSize - 2)
				})

				ctx.fillStyle = '#ff007f'
				ctx.shadowColor = '#ff007f'
				ctx.fillRect(food.x * gridSize + 1, food.y * gridSize + 1, gridSize - 2, gridSize - 2)

				ctx.shadowBlur = 0
			}

			if (isGameOver) {
				ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
				ctx.fillRect(0, 0, canvas.width, canvas.height)
				ctx.fillStyle = '#ff007f'
				ctx.font = '20px "Press Start 2P"'
				ctx.textAlign = 'center'
				ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10)
				ctx.fillStyle = '#00f0ff'
				ctx.font = '10px "Press Start 2P"'
				ctx.fillText('CLICK OR PRESS R TO RESTART', canvas.width / 2, canvas.height / 2 + 25)
			}

			animId = requestAnimationFrame(loop)
		}

		loop()

		return () => {
			cancelAnimationFrame(animId)
			window.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('keyup', onKeyUp)
			canvas.removeEventListener('click', onCanvasClick)
		}
	}, [activeGame, pageView])

	// ------------------------------------------------------------------------
	// 8. DEDICATED FULL SNAKE PAGE & THERMAL RECEIPT PRINTER
	// ------------------------------------------------------------------------
	const snakePageCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const [dedicatedSnakeScore, setDedicatedSnakeScore] = useState(0)
	const [dedicatedSnakeHighScore, setDedicatedSnakeHighScore] = useState(0)
	const [isReceiptPrinting, setIsReceiptPrinting] = useState(false)
	const [receiptStats, setReceiptStats] = useState({
		score: 0,
		highScore: 0,
		apples: 0,
		length: 3,
		time: '0.0',
		rank: 'SNAKE MASTER',
		date: new Date().toISOString().split('T')[0],
	})

	useEffect(() => {
		const saved = parseInt(localStorage.getItem('retro_snake_page_highscore') || '0', 10)
		setDedicatedSnakeHighScore(saved)
	}, [])

	const printReceipt = (finalScore: number, apples: number, length: number, elapsedSec: number) => {
		const best = Math.max(finalScore, dedicatedSnakeHighScore)
		let rank = 'ARCADE NOVICE'
		if (finalScore >= 1000) rank = 'NEON LEGEND'
		else if (finalScore >= 500) rank = 'CYBER MASTER'
		else if (finalScore >= 250) rank = 'SNAKE PRO'

		setReceiptStats({
			score: finalScore,
			highScore: best,
			apples,
			length,
			time: elapsedSec.toFixed(1),
			rank,
			date: new Date().toISOString().split('T')[0],
		})
		setIsReceiptPrinting(true)
		retroAudio.playPrinterSound()
	}

	useEffect(() => {
		if (pageView !== 'snake-page') return
		const canvas = snakePageCanvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		let isGameOver = false
		let isGameStarted = false
		let currentScore = 0
		let applesEaten = 0
		let startTime = Date.now()
		let animId: number

		const gridSize = 20
		let snake: Array<{ x: number; y: number }> = [
			{ x: 15, y: 10 },
			{ x: 14, y: 10 },
			{ x: 13, y: 10 },
		]
		let dir = { x: 1, y: 0 }
		let nextDir = { x: 1, y: 0 }
		let food = { x: 22, y: 10 }
		let snakeTick = 0

		const spawnFood = () => {
			const cols = Math.floor(canvas.width / gridSize)
			const rows = Math.floor(canvas.height / gridSize)
			food = {
				x: Math.floor(Math.random() * cols),
				y: Math.floor(Math.random() * rows),
			}
		}
		spawnFood()

		const keys: Record<string, boolean> = {}
		const onKeyDown = (e: KeyboardEvent) => {
			keys[e.code] = true
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
				if (!isGameStarted && !isGameOver) {
					isGameStarted = true
					startTime = Date.now()
				}
				e.preventDefault()
			}
			if (e.code === 'KeyR' && isGameOver) {
				restart()
			}
		}
		const onKeyUp = (e: KeyboardEvent) => {
			keys[e.code] = false
		}
		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('keyup', onKeyUp)

		const restart = () => {
			isGameOver = false
			isGameStarted = false
			currentScore = 0
			applesEaten = 0
			setIsReceiptPrinting(false)
			setDedicatedSnakeScore(0)
			snake = [
				{ x: 15, y: 10 },
				{ x: 14, y: 10 },
				{ x: 13, y: 10 },
			]
			dir = { x: 1, y: 0 }
			nextDir = { x: 1, y: 0 }
			spawnFood()
			snakeTick = 0
		}

		const triggerGameOver = () => {
			isGameOver = true
			retroAudio.playExplosionSound()
			const elapsed = (Date.now() - startTime) / 1000
			printReceipt(currentScore, applesEaten, snake.length, elapsed)
		}

		const loop = () => {
			if (isGameStarted && !isGameOver) {
				if ((keys['ArrowUp'] || keys['KeyW']) && dir.y === 0) nextDir = { x: 0, y: -1 }
				if ((keys['ArrowDown'] || keys['KeyS']) && dir.y === 0) nextDir = { x: 0, y: 1 }
				if ((keys['ArrowLeft'] || keys['KeyA']) && dir.x === 0) nextDir = { x: -1, y: 0 }
				if ((keys['ArrowRight'] || keys['KeyD']) && dir.x === 0) nextDir = { x: 1, y: 0 }

				snakeTick++
				if (snakeTick >= 6) {
					snakeTick = 0
					dir = nextDir
					const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }

					const cols = Math.floor(canvas.width / gridSize)
					const rows = Math.floor(canvas.height / gridSize)

					if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
						triggerGameOver()
					} else {
						let selfCollision = false
						for (let i = 0; i < snake.length; i++) {
							if (snake[i].x === head.x && snake[i].y === head.y) {
								selfCollision = true
								break
							}
						}
						if (selfCollision) {
							triggerGameOver()
						} else {
							snake.unshift(head)
							if (head.x === food.x && head.y === food.y) {
								currentScore += 50
								applesEaten += 1
								setDedicatedSnakeScore(currentScore)
								const best = Math.max(currentScore, dedicatedSnakeHighScore)
								setDedicatedSnakeHighScore(best)
								localStorage.setItem('retro_snake_page_highscore', String(best))
								spawnFood()
								retroAudio.playUiBeep(660, 0.1, 'square')
							} else {
								snake.pop()
							}
						}
					}
				}
			}

			ctx.clearRect(0, 0, canvas.width, canvas.height)

			// Grid Lines
			ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)'
			for (let x = 0; x < canvas.width; x += gridSize) {
				ctx.beginPath()
				ctx.moveTo(x, 0)
				ctx.lineTo(x, canvas.height)
				ctx.stroke()
			}

			// Snake
			snake.forEach((seg, idx) => {
				ctx.fillStyle = idx === 0 ? '#ffe600' : '#00f0ff'
				ctx.shadowBlur = 8
				ctx.shadowColor = '#00f0ff'
				ctx.fillRect(seg.x * gridSize + 1, seg.y * gridSize + 1, gridSize - 2, gridSize - 2)
			})

			// Food
			ctx.fillStyle = '#ff007f'
			ctx.shadowColor = '#ff007f'
			ctx.fillRect(food.x * gridSize + 1, food.y * gridSize + 1, gridSize - 2, gridSize - 2)

			ctx.shadowBlur = 0

			if (!isGameStarted && !isGameOver) {
				ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
				ctx.fillRect(0, 0, canvas.width, canvas.height)
				ctx.fillStyle = '#ffe600'
				ctx.font = '16px "Press Start 2P"'
				ctx.textAlign = 'center'
				ctx.fillText('PRESS ARROWS / W-A-S-D', canvas.width / 2, canvas.height / 2 - 15)
				ctx.fillStyle = '#00f0ff'
				ctx.font = '10px "Press Start 2P"'
				ctx.fillText('OR CLICK HERE TO START', canvas.width / 2, canvas.height / 2 + 20)
			}

			animId = requestAnimationFrame(loop)
		}

		loop()

		return () => {
			cancelAnimationFrame(animId)
			window.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('keyup', onKeyUp)
		}
	}, [pageView, dedicatedSnakeHighScore])

	const username = user?.username ?? t('common.you')

	return (
		<>
			{/* Animated 3D Synthwave Grid & Sun Background */}
			<div className="grid-background">
				<div className="synthwave-sun" />
				<div className="grid-horizon" />
				<div className="perspective-grid" />
				<div className="win95-starfield" />
				<div className="terminal-vector-core" />
			</div>

			{/* CRT Monitor Overlay FX Container */}
			<div className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`} id="crtScreen">
				<div
					className="crt-scanlines"
					id="crtOverlay"
					style={{ display: crtEnabled ? 'block' : 'none' }}
				/>
				<div className="crt-flicker" />

				{/* Main Content Wrapper */}
				<div className="app-wrapper">
					{/* Navigation Header */}
					<nav className="navbar" id="mainNav">
						<div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							{pageView === 'snake-page' && (
								<button
									className="retro-btn"
									style={{ padding: '6px 12px' }}
									onClick={() => {
										retroAudio.playUiBeep(480, 0.05)
										setPageView('hub')
									}}
								>
									← HUB
								</button>
							)}
							<div
								className="brand-42-logo"
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									cursor: 'pointer',
								}}
								onClick={() => {
									retroAudio.playUiBeep(440, 0.05)
									setPageView('hub')
								}}
								title="42 Hub"
							>
								<svg
									width="38"
									height="38"
									viewBox="0 0 24 24"
									style={{
										fill: 'var(--accent-cyan)',
										filter: 'drop-shadow(0 0 8px var(--accent-cyan)) drop-shadow(0 0 14px var(--accent-pink))',
										transition: 'transform 0.2s ease',
									}}
								>
									<path d="M19.581 16.851H24v-4.439ZM24 3.574h-4.419v4.42l-4.419 4.418v4.44h4.419v-4.44L24 7.993Zm-4.419 0h-4.419v4.42zm-6.324 8.838H4.419l8.838-8.838H8.838L0 12.412v3.595h8.838v4.419h4.419z" />
								</svg>
							</div>
						</div>

						<div className="nav-controls">
							{pageView === 'hub' && (
								<>
									<button
										className="retro-btn theme-trigger-btn"
										style={{ justifyContent: 'center', gap: 8 }}
										onClick={() => {
											retroAudio.playUiBeep(600, 0.05)
											navigate('/lobby')
										}}
									>
										<span className="theme-btn-icon">&gt;_</span>
										<span className="theme-btn-text">LOBBY</span>
									</button>
									<button
										className="retro-btn theme-trigger-btn"
										style={{ justifyContent: 'center', gap: 8 }}
										onClick={() => {
											retroAudio.playUiBeep(600, 0.05)
											navigate('/game')
										}}
									>
										<span className="theme-btn-icon">&#123;&#125;</span>
										<span className="theme-btn-text">GAME</span>
									</button>
									<button
										className="retro-btn theme-trigger-btn"
										style={{ justifyContent: 'center', gap: 8 }}
										onClick={() => {
											retroAudio.playUiBeep(600, 0.05)
											navigate('/leaderboard')
										}}
									>
										<span className="theme-btn-icon">#_</span>
										<span className="theme-btn-text">LADDER</span>
									</button>
									<button
										className="retro-btn theme-trigger-btn"
										style={{ justifyContent: 'center', gap: 8 }}
										onClick={() => {
											retroAudio.playUiBeep(600, 0.05)
											navigate('/profile')
										}}
									>
										<span className="theme-btn-icon">@/</span>
										<span className="theme-btn-text">PROFILE</span>
									</button>
								</>
							)}

							{/* Theme Selector Popover Menu */}
							<div className="theme-popover-wrapper">
								<button
									className={`retro-btn theme-trigger-btn ${isThemePopoverOpen ? 'active' : ''}`}
									id="themeModalBtn"
									aria-label="Toggle Theme Menu"
									onClick={(e) => {
										e.stopPropagation()
										const next = !isThemePopoverOpen
										setIsThemePopoverOpen(next)
										retroAudio.playUiBeep(next ? 960 : 480, 0.05)
									}}
								>
									<span className="theme-btn-icon">&lt;/&gt;</span>
									<span className="theme-btn-text">THEME</span>
									<span className="theme-chevron">▼</span>
								</button>

								<div
									className={`theme-popover-menu ${isThemePopoverOpen ? 'active' : ''}`}
									id="themePopoverMenu"
								>
									<fieldset id="color-scheme">
										<legend>THEME SELECTOR</legend>
										<label htmlFor="theme-synthwave">
											<input
												type="radio"
												id="theme-synthwave"
												name="theme-radio"
												value="synthwave"
												checked={theme === 'synthwave'}
												onChange={() => {
													applyTheme('synthwave')
													setIsThemePopoverOpen(false)
												}}
											/>
											<span>CYBERPUNK</span>
										</label>
										<label htmlFor="theme-win95">
											<input
												type="radio"
												id="theme-win95"
												name="theme-radio"
												value="win95"
												checked={theme === 'win95'}
												onChange={() => {
													applyTheme('win95')
													setIsThemePopoverOpen(false)
												}}
											/>
											<span>WIN95</span>
										</label>
										<label htmlFor="theme-terminal">
											<input
												type="radio"
												id="theme-terminal"
												name="theme-radio"
												value="terminal"
												checked={theme === 'terminal'}
												onChange={() => {
													applyTheme('terminal')
													setIsThemePopoverOpen(false)
												}}
											/>
											<span>TERMINAL</span>
										</label>
									</fieldset>
								</div>
							</div>

							{/* CRT Scanlines Toggle */}
							<div className="control-group">
								<label className="retro-toggle" title="Toggle CRT Screen Scanlines">
									<span>CRT FX</span>
									<input
										type="checkbox"
										id="crtToggle"
										checked={crtEnabled}
										onChange={toggleCrt}
									/>
									<span className="toggle-slider" />
								</label>
							</div>
						</div>
					</nav>

					{pageView === 'hub' ? (
						<>
							{/* Hero Header Banner */}
							<header className="hero-section">
								<h1 className="hero-title">RETROLUDO '42</h1>
								<p className="hero-subtitle">
									WELCOME BACK, PILOT {username.toUpperCase()} // PACE 24
								</p>

								<div className="badge-bar">
									<button
										className="retro-badge"
										style={{
											cursor: 'pointer',
											background: 'var(--bg-secondary)',
											border: isPlayingAudio ? '1px solid var(--accent-pink)' : '1px dashed var(--accent-cyan)',
											color: isPlayingAudio ? 'var(--accent-pink)' : 'var(--accent-cyan)',
											fontFamily: 'var(--font-mono)',
											outline: 'none',
										}}
										onClick={handleToggleAudio}
										title="Click to toggle Chiptune Audio"
									>
										// AUDIO: {isPlayingAudio ? 'PLAYING [PAUSE]' : 'STANDBY [PLAY]'}
									</button>
									<span
										className="retro-badge"
										style={{
											border: '1px solid var(--accent-cyan)',
											color: 'var(--accent-cyan)',
											display: 'inline-flex',
											alignItems: 'center',
											gap: 6,
										}}
									>
										// ONLINE PLAYERS: 42
									</span>
									<span
										className="retro-badge"
										style={{
											border: '1px dashed rgba(255, 255, 255, 0.2)',
											color: 'var(--text-muted)',
											opacity: 0.5,
										}}
									>
										// SLOT_03: [EMPTY]
									</span>
									<span
										className="retro-badge"
										style={{
											border: '1px dashed rgba(255, 255, 255, 0.2)',
											color: 'var(--text-muted)',
											opacity: 0.5,
										}}
									>
										// SLOT_04: [EMPTY]
									</span>
								</div>
							</header>

							{/* Main Interactive Dashboard Grid */}
							<main className="dashboard-grid">
								{/* Widget 1: Playable Retro Arcade Machine */}
								<section className="retro-window col-8" id="arcadeWindow">
									<div className="window-header">
										<span>🎮 RETRO ARCADE CABINET</span>
										<div className="window-controls">
											<span className="window-btn min" />
											<span className="window-btn max" />
										</div>
									</div>
									<div className="window-body arcade-container">
										{/* Game Selection Tabs */}
										<div className="arcade-tabs">
											<button
												className={`tab-btn ${activeGame === 'space' ? 'active' : ''}`}
												id="tabSpace"
												onClick={() => {
													setActiveGame('space')
													retroAudio.playUiBeep(520, 0.05)
												}}
											>
												SPACE DEFENDER
											</button>
											<button
												className={`tab-btn ${activeGame === 'snake' ? 'active' : ''}`}
												id="tabSnake"
												onClick={() => {
													setActiveGame('snake')
													retroAudio.playUiBeep(520, 0.05)
												}}
											>
												RETRO SNAKE
											</button>
											<button
												className="tab-btn"
												style={{
													background: 'var(--accent-pink)',
													color: '#fff',
													display: 'inline-flex',
													alignItems: 'center',
													gap: 4,
													cursor: 'pointer',
												}}
												onClick={() => {
													retroAudio.playUiBeep(700, 0.05)
													setPageView('snake-page')
												}}
											>
												🐍 FULL SNAKE PAGE + RECEIPT PRINTER
											</button>
										</div>

										{/* Arcade Canvas Frame */}
										<div className="arcade-screen-frame">
											<canvas id="arcadeCanvas" ref={canvasRef} width={480} height={280} />
										</div>

										{/* Score Board */}
										<div className="arcade-score-bar">
											<span>
												SCORE: <span id="currentScore">{score}</span>
											</span>
											<span>
												HIGH SCORE: <span id="highScore">{highScore}</span>
											</span>
										</div>
									</div>
								</section>

								{/* Widget 2: Web Audio Chiptune Boombox */}
								<section className="retro-window col-4" id="audioWindow">
									<div className="window-header">
										<span>📻 CHIPTUNE SYNTH BOOMBOX</span>
										<div className="window-controls">
											<span className="window-btn min" />
											<span className="window-btn max" />
										</div>
									</div>
									<div className="window-body synth-panel">
										<div className="track-info">
											<span id="currentTrackLabel">{currentTrack}</span>
										</div>

										{/* Animated Spectrum Visualizer */}
										<div className="spectrum-display" aria-label="Audio Spectrum Visualizer">
											{spectrumHeights.map((h, i) => (
												<div key={i} className="spectrum-bar" style={{ height: `${h}%` }} />
											))}
										</div>

										{/* Playback Buttons */}
										<div className="playback-controls">
											<button
												className="retro-btn"
												id="playAudioBtn"
												style={{
													background: isPlayingAudio ? 'var(--accent-pink)' : 'var(--btn-bg)',
												}}
												onClick={handleToggleAudio}
											>
												{isPlayingAudio ? 'PAUSE' : 'PLAY'}
											</button>
											<button className="retro-btn" id="nextAudioBtn" onClick={handleNextTrack}>
												NEXT TRACK
											</button>
											<button className="retro-btn" id="muteAudioBtn" onClick={handleToggleMute}>
												{isMuted ? 'UNMUTE' : 'MUTE'}
											</button>
										</div>
									</div>
								</section>

								{/* Widget 3: Live Cyber Ladder & Guestbook Tabs */}
								<section className="retro-window col-8" id="guestbookWindow">
									<div className="window-header">
										<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
											<span>🏆 CYBER LADDER & GUESTBOOK</span>
										</div>
										<div className="window-controls">
											<span className="window-btn min" />
											<span className="window-btn max" />
										</div>
									</div>
									<div className="window-body">
										{/* Mode Tabs */}
										<div className="arcade-tabs" style={{ marginBottom: 15 }}>
											<button
												className={`tab-btn ${widget3Tab === 'ladder' ? 'active' : ''}`}
												onClick={() => {
													setWidget3Tab('ladder')
													retroAudio.playUiBeep(520, 0.05)
												}}
											>
												🏆 TOP RANKED PILOTS
											</button>
											<button
												className={`tab-btn ${widget3Tab === 'guestbook' ? 'active' : ''}`}
												onClick={() => {
													setWidget3Tab('guestbook')
													retroAudio.playUiBeep(520, 0.05)
												}}
											>
												📝 GUESTBOOK WALL
											</button>
										</div>

										{widget3Tab === 'ladder' ? (
											/* TAB 1: LIVE LEADERBOARD */
											<div style={{ width: '100%' }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
													<span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
														GLOBAL RANKINGS // TOP PILOTS
													</span>
													<button
														className="retro-btn"
														style={{ padding: '5px 10px', fontSize: '0.6rem' }}
														onClick={() => {
															retroAudio.playUiBeep(600, 0.05)
															navigate('/leaderboard')
														}}
													>
														VIEW ALL RANKINGS →
													</button>
												</div>

												{isLadderLoading ? (
													<div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--accent-yellow)' }}>
														TRANSMITTING LEADERBOARD TELEMETRY...
													</div>
												) : ladder === null || ladder.length === 0 ? (
													<div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
														NO RANKED CYBER PILOTS REGISTERED YET. BE THE FIRST TO WIN IN LOBBY!
													</div>
												) : (
													<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
														{ladder.map((entry, index) => {
															const rankBadge = index === 0 ? '👑 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`
															const isCurrent = entry.username.toLowerCase() === username.toLowerCase()
															return (
																<div
																	key={entry.username}
																	style={{
																		display: 'flex',
																		alignItems: 'center',
																		justifyContent: 'space-between',
																		padding: '10px 14px',
																		background: isCurrent ? 'rgba(0, 240, 255, 0.15)' : 'rgba(25, 10, 56, 0.6)',
																		border: isCurrent ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 0, 127, 0.3)',
																		borderRadius: 4,
																	}}
																>
																	<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
																		<span
																			style={{
																				fontFamily: 'var(--font-heading)',
																				fontSize: '0.75rem',
																				color: index === 0 ? 'var(--accent-yellow)' : 'var(--accent-pink)',
																				minWidth: 45,
																			}}
																		>
																			{rankBadge}
																		</span>
																		<div
																			style={{
																				width: 32,
																				height: 32,
																				borderRadius: '50%',
																				background: 'var(--accent-purple)',
																				border: '1px solid var(--accent-cyan)',
																				display: 'flex',
																				alignItems: 'center',
																				justifyContent: 'center',
																				fontWeight: 'bold',
																				fontSize: '0.75rem',
																				color: '#fff',
																			}}
																		>
																			{entry.username.slice(0, 2).toUpperCase()}
																		</div>
																		<span
																			style={{
																				fontWeight: 'bold',
																				fontSize: '0.85rem',
																				color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-main)',
																			}}
																		>
																			{entry.username} {isCurrent && '(YOU)'}
																		</span>
																	</div>
																	<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
																		<span style={{ color: 'var(--accent-yellow)', fontWeight: 'bold', fontSize: '0.9rem' }}>
																			♛ {entry.rating} PTS
																		</span>
																	</div>
																</div>
															)
														})}
													</div>
												)}
											</div>
										) : (
											/* TAB 2: GUESTBOOK WALL */
											<div>
												<div className="sticky-input-group">
													<textarea
														id="stickyInput"
														className="retro-textarea"
														placeholder="Leave a retro note on the wall..."
														aria-label="Guestbook Note Input"
														value={newNote}
														onChange={(e) => setNewNote(e.target.value)}
													/>
													<button
														className="retro-btn"
														id="addStickyBtn"
														style={{ alignSelf: 'flex-start' }}
														onClick={handleAddNote}
													>
														POST STICKY NOTE
													</button>
												</div>

												<div className="sticky-wall" id="stickyWall">
													{notes.map((txt, index) => (
														<div key={index} className="sticky-note">
															<span
																className="delete-btn"
																data-index={index}
																onClick={() => handleDeleteNote(index)}
															>
																&times;
															</span>
															<p>{txt}</p>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								</section>

								{/* Widget 4: Retro System Status & LED Clock */}
								<section className="retro-window col-4" id="statsWindow">
									<div className="window-header">
										<span>📟 SYSTEM TELEMETRY</span>
										<div className="window-controls">
											<span className="window-btn min" />
											<span className="window-btn max" />
										</div>
									</div>
									<div className="window-body">
										{/* LED Digital Clock */}
										<div className="digital-clock" id="digitalClock">
											{clockTime}
										</div>

										{/* Pilot & System Resource Meters */}
										<div style={{ marginTop: '20px' }}>
											<div className="stat-row">
												<span>PILOT ID:</span>
												<span style={{ color: 'var(--accent-yellow)', fontWeight: 'bold' }}>
													{username.toUpperCase()}
												</span>
											</div>
											<div className="stat-row">
												<span>CPU LOAD:</span>
												<div className="stat-bar-outer">
													<div
														className="stat-bar-inner"
														id="cpuBar"
														style={{ width: `${cpuWidth}%` }}
													/>
												</div>
											</div>
											<div className="stat-row">
												<span>MEM LOAD:</span>
												<div className="stat-bar-outer">
													<div
														className="stat-bar-inner"
														id="memBar"
														style={{ width: `${memWidth}%` }}
													/>
												</div>
											</div>
											<div className="stat-row">
												<span>ONLINE PLAYERS:</span>
												<span style={{ color: 'var(--accent-cyan)' }}>42 ACTIVE</span>
											</div>
										</div>
									</div>
								</section>
							</main>

							{/* Footer */}
							<footer className="retro-footer">
								<p>© 1942-2026 RETROLUDO '42 // 42KL // ALL RIGHTS RESERVED // WEB AUDIO & CANV-ARCADE</p>
							</footer>
						</>
					) : (
						/* FULL PAGE UNIFIED RETRO WINDOW (SNAKE PAGE + PRINTER) */
						<main className="dashboard-grid" style={{ justifyContent: 'center' }}>
							<section
								className="retro-window col-12"
								id="unifiedSnakeWindow"
								style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}
							>
								<div className="window-header">
									<span id="windowHeaderTitle">
										{isReceiptPrinting
											? '🖨️ GAME OVER // THERMAL SCORE RECEIPT PRINTED'
											: '🐍 RETRO SNAKE CABINET // PLAY MODE'}
									</span>
									<div className="window-controls">
										<span className="window-btn min" />
										<span className="window-btn max" />
									</div>
								</div>

								<div
									className="window-body"
									style={{
										minHeight: 720,
										position: 'relative',
										display: 'flex',
										flexDirection: 'column',
										justifyContent: 'center',
										alignItems: 'center',
										padding: 25,
									}}
								>
									{!isReceiptPrinting ? (
										/* VIEW 1: GAMEPLAY VIEW */
										<div
											id="snakeGameView"
											className="arcade-container"
											style={{
												width: '100%',
												minHeight: 660,
												display: 'flex',
												flexDirection: 'column',
												justifyContent: 'space-between',
												alignItems: 'center',
											}}
										>
											<div className="arcade-score-bar" style={{ maxWidth: 720, fontSize: '0.95rem' }}>
												<span>
													SCORE: <span id="snakeScore">{dedicatedSnakeScore}</span>
												</span>
												<span>
													HIGH SCORE: <span id="snakeHighScore">{dedicatedSnakeHighScore}</span>
												</span>
											</div>

											<div
												className="arcade-screen-frame"
												style={{ position: 'relative', width: '100%', maxWidth: 720, margin: '10px auto' }}
											>
												<canvas id="snakeCanvas" ref={snakePageCanvasRef} width={680} height={400} />
											</div>

											<div
												className="dpad-container"
												style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}
											>
												<button
													className="retro-btn dpad-btn"
													id="btnUp"
													style={{ padding: '10px 20px', fontSize: '0.75rem' }}
													onClick={() => {
														window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
													}}
												>
													▲ UP
												</button>
												<button
													className="retro-btn dpad-btn"
													id="btnLeft"
													style={{ padding: '10px 20px', fontSize: '0.75rem' }}
													onClick={() => {
														window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
													}}
												>
													◄ LEFT
												</button>
												<button
													className="retro-btn dpad-btn"
													id="btnDown"
													style={{ padding: '10px 20px', fontSize: '0.75rem' }}
													onClick={() => {
														window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }))
													}}
												>
													▼ DOWN
												</button>
												<button
													className="retro-btn dpad-btn"
													id="btnRight"
													style={{ padding: '10px 20px', fontSize: '0.75rem' }}
													onClick={() => {
														window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
													}}
												>
													► RIGHT
												</button>
												<button
													className="retro-btn"
													id="demoPrintBtn"
													style={{ padding: '10px 16px', background: 'var(--accent-pink)', color: '#fff', fontSize: '0.75rem' }}
													onClick={() => {
														printReceipt(dedicatedSnakeScore, 4, 7, 24.5)
													}}
												>
													🖨️ TEST PRINT
												</button>
											</div>

											<div style={{ marginTop: 10, textAlign: 'center', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
												<span>🎮 KEYBOARD: ARROW KEYS / W-A-S-D | RESTART: [R]</span>
											</div>
										</div>
									) : (
										/* VIEW 2: GAME OVER THERMAL RECEIPT VIEW */
										<div id="printerReceiptView" style={{ width: '100%', minHeight: 660 }}>
											<div className="container invoice-container" id="receiptContainer" style={{ maxWidth: 540, margin: '0 auto', height: 660 }}>
												<div className="invoice-slot">
													<div className="slot-label">PRINTER</div>
													<div className="slot-hole" />
												</div>

												<div className="invoice printing-active" id="invoiceCard">
													<div style={{ textAlign: 'center', fontSize: '0.75rem', letterSpacing: 1, marginBottom: 5, opacity: 0.85 }}>
														STORE #01984 // RETROWAVE TERMINAL 84
													</div>

													<div className="title">OFFICIAL GAME OVER RECEIPT</div>

													<div className="amount">
														<span>FINAL SCORE</span>
														<span className="value" id="receiptScore">{receiptStats.score} PTS</span>
													</div>

													<div className="amount">
														<span>HIGH SCORE</span>
														<span className="value" id="receiptHighScore">{receiptStats.highScore} PTS</span>
													</div>

													<div className="status-progress">
														<div className="checkpoint"><span className="circle" /></div>
														<div className="checkpoint"><span className="circle" /></div>
														<div className="checkpoint"><span className="circle" /></div>
														<div className="checkpoint"><span className="circle" /></div>
														<div className="checkpoint"><i className="fa-solid fa-stamp" /></div>
													</div>

													<div className="payment-status">
														<div className="heading">
															<span>PLAYER TELEMETRY & BREAKDOWN</span>
															<i className="fa-solid fa-circle-check" />
														</div>

														<ul className="payers-list">
															<li>
																<div className="payer-image-container">
																	<img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=CyberSnake" alt="Player Avatar" />
																</div>
																<p>
																	<span>CYBER PILOT</span>
																	<span className="pay-tag" id="receiptPlayerTag">VERIFIED</span>
																</p>
															</li>
															<li>
																<p>
																	<span>APPLES CONSUMED</span>
																	<strong id="receiptApples">{receiptStats.apples}</strong>
																</p>
															</li>
															<li>
																<p>
																	<span>SNAKE BODY LENGTH</span>
																	<strong id="receiptSnakeLength">{receiptStats.length} UNITS</strong>
																</p>
															</li>
															<li>
																<p>
																	<span>SURVIVAL TIME</span>
																	<strong id="receiptTime">{receiptStats.time} SEC</strong>
																</p>
															</li>
															<li>
																<p>
																	<span>RANK RATING</span>
																	<strong id="receiptRank" style={{ color: '#ff007f' }}>{receiptStats.rank}</strong>
																</p>
															</li>
														</ul>
													</div>

													<div className="receipt-barcode-section" style={{ textAlign: 'center', margin: '12px 0 8px 0', borderTop: '1px dashed #bbb', paddingTop: 10 }}>
														<div className="receipt-barcode" style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.4rem', letterSpacing: 4, lineHeight: 1 }}>
															||| ||||| || ||||||| ||| ||||
														</div>
														<div style={{ fontSize: '0.68rem', letterSpacing: 2, marginTop: 3, opacity: 0.7 }}>
															SER #8492-RETRO-SNAKE
														</div>
													</div>

													<div className="payment-info">
														<div className="card-info">
															<span className="card-icon" />
															<span id="receiptDate">{receiptStats.date}</span>
														</div>
														<span style={{ color: '#22c55e', fontWeight: 'bold' }}>PAID & VERIFIED</span>
													</div>

													<div className="btn-group" style={{ marginTop: 15 }}>
														<button
															className="btn reminder-btn"
															id="retrySnakeBtn"
															style={{ width: '100%', padding: '0.7em 0', fontSize: '0.95rem' }}
															onClick={() => {
																setIsReceiptPrinting(false)
															}}
														>
															🎮 PLAY AGAIN
														</button>
													</div>

													<div style={{ textAlign: 'center', fontSize: '0.65rem', marginTop: 12, opacity: 0.7, letterSpacing: 0.5 }}>
														*** THANK YOU FOR PLAYING RETROLUDO '42 ***
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</section>

							<footer className="retro-footer">
								<p>© 1942-2026 RETROLUDO '42 // 42KL // THERMAL RECEIPT PRINTER SYSTEM</p>
							</footer>
						</main>
					)}
				</div>
			</div>
		</>
	)
}
