import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, postApi } from '../api'
import { UserAvatar } from '../components/UserAvatar'
import { navigate } from '../router'
import { useApp } from '../store'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

type ThemeType = 'synthwave' | 'win95' | 'terminal'
type Friend = {
	id: string
	username: string
	avatarStyle?: any
	rating?: number
	friendsSince?: string
	status?: 'online' | 'playing' | 'offline'
}

export function Home() {
	const { t } = useTranslation()
	const { user, setActiveMatch } = useApp()

	// ------------------------------------------------------------------------
	// 2. LIVE PLAYER CAREER STATS API
	// ------------------------------------------------------------------------
	type PlayerStats = {
		totalGames: number
		wins: number
		losses: number
		totalCaptures: number
		totalPiecesInGoal: number
		avgCapturesPerGame: number
	}
	const [stats, setStats] = useState<PlayerStats | null>(null)
	const [isStatsLoading, setIsStatsLoading] = useState(false)

	useEffect(() => {
		setIsStatsLoading(true)
		getApi<PlayerStats>('/api/stats')
			.then((body) => {
				if (body && typeof body.totalGames === 'number') {
					setStats(body)
				}
			})
			.catch((e) => {
				console.error(e)
			})
			.finally(() => {
				setIsStatsLoading(false)
			})
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
	// 4. CYBER COMM // FRIEND LIST & AUDIO
	// ------------------------------------------------------------------------
	const [friends, setFriends] = useState<Friend[] | null>(null)
	const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
	const [isFriendsLoading, setIsFriendsLoading] = useState(false)
	const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null)

	const fetchFriendsData = () => {
		Promise.all([
			getApi<Friend[]>('/api/friends'),
			getApi<{ received: Array<{ id: string }> }>('/api/friends/requests'),
		])
			.then(([friendsData, reqData]) => {
				const list = Array.isArray(friendsData) ? friendsData : []
				// Sort online and playing friends to the top
				list.sort((a, b) => {
					const scoreA = a.status === 'playing' ? 2 : a.status === 'online' ? 1 : 0
					const scoreB = b.status === 'playing' ? 2 : b.status === 'online' ? 1 : 0
					if (scoreA !== scoreB) return scoreB - scoreA
					return a.username.localeCompare(b.username)
				})
				setFriends(list)
				setPendingRequestsCount(Array.isArray(reqData?.received) ? reqData.received.length : 0)
			})
			.catch((e) => {
				console.error(e)
			})
	}

	useEffect(() => {
		setIsFriendsLoading(true)
		fetchFriendsData()
		setIsFriendsLoading(false)
		const iv = setInterval(fetchFriendsData, 12000)
		return () => clearInterval(iv)
	}, [])

	const handleInviteFriend = async (friendId: string) => {
		if (invitingFriendId) return
		setInvitingFriendId(friendId)
		retroAudio.playUiBeep(800, 0.08)
		try {
			const res = await postApi<{
				gameId: string
				token: string
				engineUrl: string
				color: any
				inviteCode?: string
				mode: 'pvp' | 'pve' | 'hotseat'
				playerCount: number
			}>(`/api/friends/${friendId}/invite`, { clashEnabled: true })
			setActiveMatch(res)
			navigate(`/game?gameId=${res.gameId}`)
		} catch (e) {
			console.error(e)
		} finally {
			setInvitingFriendId(null)
		}
	}

	const [isPlayingAudio, setIsPlayingAudio] = useState(false)
	const handleToggleAudio = () => {
		const playing = retroAudio.togglePlay()
		setIsPlayingAudio(playing)
	}

	// ------------------------------------------------------------------------
	// 5. HUB ARCADE CABINET: 3D ATTRACT MODE & PRESS START
	// ------------------------------------------------------------------------
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [isWarpingToLobby, setIsWarpingToLobby] = useState(false)

	const launchToLobby = () => {
		if (isWarpingToLobby) return
		setIsWarpingToLobby(true)
		// Arcade coin drop and power-up chime
		retroAudio.playUiBeep(987, 0.08)
		setTimeout(() => retroAudio.playUiBeep(1318, 0.12), 90)
		setTimeout(() => retroAudio.playUiBeep(1760, 0.2), 200)

		setTimeout(() => {
			navigate('/gamelobby')
		}, 350)
	}

	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			const activeTag = document.activeElement?.tagName.toLowerCase()
			if (activeTag === 'input' || activeTag === 'textarea') return

			if (e.code === 'Space' || e.code === 'Enter') {
				e.preventDefault()
				launchToLobby()
			}
		}
		window.addEventListener('keydown', handleGlobalKeyDown)
		return () => window.removeEventListener('keydown', handleGlobalKeyDown)
	}, [isWarpingToLobby])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		let animId: number
		let rotX = 0.4
		let rotY = 0.6
		let rotZ = 0.2
		let gridOffset = 0
		let time = 0

		// Theme-specific color palettes
		const themeConfig = {
			synthwave: {
				bgTop: '#070114',
				bgMid: '#160530',
				bgBot: '#05010d',
				hasSun: true,
				sunC1: 'rgba(255, 230, 0, 0.72)',
				sunC2: 'rgba(255, 0, 127, 0.38)',
				sunScanline: '#070114',
				gridColor: 'rgba(0, 240, 255, 0.45)',
				starRgb: '255, 255, 255',
				diceBg: 'rgba(25, 8, 55, 0.32)',
				pipColor: '#ffffff',
				faces: [
					{ v: [4, 5, 6, 7], pips: 1, color: '#ff007f', bg: 'rgba(255, 0, 127, 0.28)' },
					{ v: [1, 0, 3, 2], pips: 6, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.28)' },
					{ v: [0, 1, 5, 4], pips: 2, color: '#ffe600', bg: 'rgba(255, 230, 0, 0.28)' },
					{ v: [3, 7, 6, 2], pips: 5, color: '#9d00ff', bg: 'rgba(157, 0, 255, 0.28)' },
					{ v: [1, 2, 6, 5], pips: 3, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.28)' },
					{ v: [0, 4, 7, 3], pips: 4, color: '#ff007f', bg: 'rgba(255, 0, 127, 0.28)' },
				],
				sparks: ['#00f0ff', '#ff007f'],
				pawns: [
					{ label: 'RED', color: '#ff0055', x: 85, y: 350 },
					{ label: 'GREEN', color: '#00ff88', x: 230, y: 360 },
					{ label: 'YELLOW', color: '#ffe600', x: 490, y: 360 },
					{ label: 'BLUE', color: '#00f0ff', x: 635, y: 350 },
				],
				marquee: '[ TRANSCENDENCE // CYBER LUDO ]',
				marqueeColor: '#00f0ff',
			},
			win95: {
				bgTop: '#000000',
				bgMid: '#000000',
				bgBot: '#000000',
				hasSun: false,
				sunC1: 'rgba(0, 0, 0, 0)',
				sunC2: 'rgba(0, 0, 0, 0)',
				sunScanline: '#000000',
				gridColor: 'rgba(0, 160, 160, 0.65)',
				starRgb: '255, 255, 255',
				diceBg: 'rgba(180, 180, 180, 0.28)',
				pipColor: '#ffffff',
				faces: [
					{ v: [4, 5, 6, 7], pips: 1, color: '#ff4444', bg: 'rgba(230, 30, 30, 0.32)' },
					{ v: [1, 0, 3, 2], pips: 6, color: '#4477ff', bg: 'rgba(30, 90, 255, 0.32)' },
					{ v: [0, 1, 5, 4], pips: 2, color: '#ffdd00', bg: 'rgba(250, 200, 0, 0.32)' },
					{ v: [3, 7, 6, 2], pips: 5, color: '#00dd44', bg: 'rgba(0, 180, 50, 0.32)' },
					{ v: [1, 2, 6, 5], pips: 3, color: '#aa44ff', bg: 'rgba(120, 30, 220, 0.32)' },
					{ v: [0, 4, 7, 3], pips: 4, color: '#00ddff', bg: 'rgba(0, 210, 240, 0.32)' },
				],
				sparks: ['#ffffff', '#00ffff'],
				pawns: [
					{ label: 'P1-RED', color: '#ff2222', x: 85, y: 350 },
					{ label: 'P2-GRN', color: '#00cc33', x: 230, y: 360 },
					{ label: 'P3-YLW', color: '#ffee00', x: 490, y: 360 },
					{ label: 'P4-BLU', color: '#2255ff', x: 635, y: 350 },
				],
				marquee: '[ DIRECTX 3D // CYBER LUDO 95 ]',
				marqueeColor: '#00ffff',
			},
			terminal: {
				bgTop: '#000800',
				bgMid: '#001400',
				bgBot: '#000400',
				hasSun: true,
				sunC1: 'rgba(0, 255, 102, 0.55)',
				sunC2: 'rgba(0, 180, 70, 0.25)',
				sunScanline: '#000800',
				gridColor: 'rgba(0, 255, 102, 0.4)',
				starRgb: '0, 255, 102',
				diceBg: 'rgba(0, 40, 10, 0.32)',
				pipColor: '#00ff66',
				faces: [
					{ v: [4, 5, 6, 7], pips: 1, color: '#00ff66', bg: 'rgba(0, 255, 102, 0.22)' },
					{ v: [1, 0, 3, 2], pips: 6, color: '#33ff88', bg: 'rgba(0, 255, 102, 0.22)' },
					{ v: [0, 1, 5, 4], pips: 2, color: '#00dd55', bg: 'rgba(0, 255, 102, 0.22)' },
					{ v: [3, 7, 6, 2], pips: 5, color: '#00ff66', bg: 'rgba(0, 255, 102, 0.22)' },
					{ v: [1, 2, 6, 5], pips: 3, color: '#33ff88', bg: 'rgba(0, 255, 102, 0.22)' },
					{ v: [0, 4, 7, 3], pips: 4, color: '#00dd55', bg: 'rgba(0, 255, 102, 0.22)' },
				],
				sparks: ['#00ff66', '#33ff88'],
				pawns: [
					{ label: 'NODE:RED', color: '#00ff66', x: 85, y: 350 },
					{ label: 'NODE:GRN', color: '#33ff88', x: 230, y: 360 },
					{ label: 'NODE:YLW', color: '#00ff66', x: 490, y: 360 },
					{ label: 'NODE:BLU', color: '#33ff88', x: 635, y: 350 },
				],
				marquee: '> SYS_EXEC: TRANSCENDENCE_LUDO_CORE.SH',
				marqueeColor: '#00ff66',
			},
		}

		const currentCfg = themeConfig[theme] || themeConfig.synthwave

		// Background stars
		const stars = Array.from({ length: 65 }, () => ({
			x: Math.random() * 720,
			y: Math.random() * 260,
			size: Math.random() * 1.8 + 0.5,
			speed: Math.random() * 0.3 + 0.1,
			alpha: Math.random() * 0.7 + 0.3,
		}))

		// 3D Cube vertices (centered at origin, side length = 108)
		const cubeSize = 54
		const rawVertices = [
			[-cubeSize, -cubeSize, -cubeSize],
			[cubeSize, -cubeSize, -cubeSize],
			[cubeSize, cubeSize, -cubeSize],
			[-cubeSize, cubeSize, -cubeSize],
			[-cubeSize, -cubeSize, cubeSize],
			[cubeSize, -cubeSize, cubeSize],
			[cubeSize, cubeSize, cubeSize],
			[-cubeSize, cubeSize, cubeSize],
		]

		const faces = currentCfg.faces

		const pipPositions: Record<number, number[][]> = {
			1: [[0, 0]],
			2: [[-0.28, -0.28], [0.28, 0.28]],
			3: [[-0.3, -0.3], [0, 0], [0.3, 0.3]],
			4: [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]],
			5: [[-0.28, -0.28], [0.28, -0.28], [0, 0], [-0.28, 0.28], [0.28, 0.28]],
			6: [[-0.28, -0.32], [0.28, -0.32], [-0.28, 0], [0.28, 0], [-0.28, 0.32], [0.28, 0.32]],
		}

		const loop = () => {
			time += 0.02
			rotX += 0.012
			rotY += 0.018
			rotZ += 0.007
			gridOffset = (gridOffset + 1.3) % 26

			ctx.clearRect(0, 0, canvas.width, canvas.height)

			// 1. Deep Canvas Background with theme gradient
			const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
			bgGrad.addColorStop(0, currentCfg.bgTop)
			bgGrad.addColorStop(0.65, currentCfg.bgMid)
			bgGrad.addColorStop(1, currentCfg.bgBot)
			ctx.fillStyle = bgGrad
			ctx.fillRect(0, 0, canvas.width, canvas.height)

			// 2. Distant Sun (only for themes with sun)
			if (currentCfg.hasSun !== false) {
				const sunY = 250
				const sunGrad = ctx.createRadialGradient(360, sunY, 7, 360, sunY, 90)
				sunGrad.addColorStop(0, currentCfg.sunC1)
				sunGrad.addColorStop(0.5, currentCfg.sunC2)
				sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
				ctx.fillStyle = sunGrad
				ctx.beginPath()
				ctx.arc(360, sunY, 90, Math.PI, 0, false)
				ctx.fill()

				// Sun horizon scanlines
				ctx.strokeStyle = currentCfg.sunScanline
				ctx.lineWidth = 2
				for (let sy = sunY - 60; sy < sunY; sy += 8) {
					ctx.beginPath()
					ctx.moveTo(265, sy)
					ctx.lineTo(455, sy)
					ctx.stroke()
				}
			}

			// 3. Floating Stars
			stars.forEach((st) => {
				st.y += st.speed
				if (st.y > 260) st.y = 0
				ctx.fillStyle = `rgba(${currentCfg.starRgb}, ${st.alpha * (0.8 + 0.2 * Math.sin(time * 3 + st.x))})`
				ctx.beginPath()
				ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2)
				ctx.fill()
			})

			// 4. Horizon Perspective Grid
			const horizonY = 260
			ctx.save()
			ctx.strokeStyle = currentCfg.gridColor
			ctx.lineWidth = 1

			// Horizontal grid lines moving toward camera
			for (let gy = 0; gy < 140; gy += 14) {
				const y = horizonY + Math.pow((gy + gridOffset) / 145, 1.8) * 140
				if (y <= canvas.height) {
					ctx.beginPath()
					ctx.moveTo(0, y)
					ctx.lineTo(canvas.width, y)
					ctx.stroke()
				}
			}

			// Perspective radiating vertical lines from vanishing point (360, 260)
			for (let x = -250; x <= canvas.width + 250; x += 45) {
				ctx.beginPath()
				ctx.moveTo(360, horizonY)
				ctx.lineTo(x, canvas.height)
				ctx.stroke()
			}
			ctx.restore()

			// 5. 3D Tumbling Ludo Dice in Center
			const centerX = 360
			const centerY = 135 + Math.sin(time * 2.2) * 10
			const cameraDist = 260

			// 3D rotation matrix calculation
			const cosX = Math.cos(rotX), sinX = Math.sin(rotX)
			const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
			const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ)

			const transformedVertices = rawVertices.map(([x, y, z]) => {
				let x1 = x * cosY + z * sinY
				let y1 = y
				let z1 = -x * sinY + z * cosY

				let x2 = x1
				let y2 = y1 * cosX - z1 * sinX
				let z2 = y1 * sinX + z1 * cosX

				let x3 = x2 * cosZ - y2 * sinZ
				let y3 = x2 * sinZ + y2 * cosZ
				let z3 = z2

				const scale = cameraDist / (cameraDist + z3)
				return {
					px: centerX + x3 * scale,
					py: centerY + y3 * scale,
					z: z3,
					orig: [x, y, z],
					rot: [x3, y3, z3],
				}
			})

			// Render glowing particle sparks behind dice
			for (let i = 0; i < 8; i++) {
				const sparkAngle = time * 3 + (i * Math.PI) / 4
				const sparkR = 74 + Math.sin(time * 4 + i) * 15
				const sx = centerX + Math.cos(sparkAngle) * sparkR
				const sy = centerY + Math.sin(sparkAngle * 1.3) * (sparkR * 0.5)
				const sparkCol = currentCfg.sparks[i % currentCfg.sparks.length]
				ctx.fillStyle = sparkCol
				ctx.shadowColor = sparkCol
				ctx.shadowBlur = 9
				ctx.beginPath()
				ctx.arc(sx, sy, 2.4, 0, Math.PI * 2)
				ctx.fill()
				ctx.shadowBlur = 0
			}

			// Sort faces by average Z depth (Painter's algorithm)
			const faceList = faces.map((face) => {
				const pts = face.v.map((idx) => transformedVertices[idx])
				const avgZ = (pts[0].z + pts[1].z + pts[2].z + pts[3].z) / 4
				const v0 = pts[0], v1 = pts[1], v2 = pts[2]
				const normalZ = (v1.px - v0.px) * (v2.py - v0.py) - (v1.py - v0.py) * (v2.px - v0.px)
				return { ...face, pts, avgZ, normalZ }
			})

			faceList.sort((a, b) => a.avgZ - b.avgZ)

			faceList.forEach((face) => {
				const isBackface = face.normalZ <= 0
				const alpha = isBackface ? 0.35 : 1.0

				ctx.save()
				ctx.globalAlpha = alpha

				// Draw face translucent background
				ctx.beginPath()
				ctx.moveTo(face.pts[0].px, face.pts[0].py)
				for (let i = 1; i < 4; i++) {
					ctx.lineTo(face.pts[i].px, face.pts[i].py)
				}
				ctx.closePath()

				ctx.fillStyle = (face as any).bg || currentCfg.diceBg
				ctx.fill()

				// Draw face edges
				ctx.strokeStyle = theme === 'win95' ? '#dfdfdf' : face.color
				ctx.lineWidth = isBackface ? 1.5 : theme === 'win95' ? 2 : 3
				ctx.shadowColor = theme === 'win95' || isBackface ? 'transparent' : face.color
				ctx.shadowBlur = theme === 'win95' || isBackface ? 0 : 11
				ctx.stroke()
				ctx.shadowBlur = 0

				// Draw Pips on face
				const pips = pipPositions[face.pips] || []
				const p0 = face.pts[0], p1 = face.pts[1], p2 = face.pts[2], p3 = face.pts[3]

				pips.forEach(([u, v]) => {
					const su = u + 0.5
					const sv = v + 0.5
					const topX = p0.px + (p1.px - p0.px) * su
					const topY = p0.py + (p1.py - p0.py) * su
					const botX = p3.px + (p2.px - p3.px) * su
					const botY = p3.py + (p2.py - p3.py) * su
					const pipX = topX + (botX - topX) * sv
					const pipY = topY + (botY - topY) * sv

					ctx.fillStyle = currentCfg.pipColor
					ctx.shadowColor = theme === 'win95' || isBackface ? 'transparent' : face.color
					ctx.shadowBlur = theme === 'win95' || isBackface ? 0 : 8
					ctx.beginPath()
					ctx.arc(pipX, pipY, isBackface ? 2.8 : 4, 0, Math.PI * 2)
					ctx.fill()
					ctx.shadowBlur = 0
				})
				ctx.restore()
			})

			// 6. 4-Player Army Hologram Nodes
			const pawns = currentCfg.pawns

			pawns.forEach((p, idx) => {
				const pulse = Math.sin(time * 3 + idx * 1.5) * 2.4
				ctx.save()
				ctx.fillStyle = p.color
				ctx.shadowColor = theme === 'win95' ? 'transparent' : p.color
				ctx.shadowBlur = theme === 'win95' ? 0 : 11
				ctx.beginPath()
				ctx.arc(p.x, p.y + pulse, 7.5, 0, Math.PI * 2)
				ctx.fill()

				// Base ring
				ctx.strokeStyle = p.color
				ctx.lineWidth = 1.8
				ctx.beginPath()
				ctx.ellipse(p.x, p.y + 12, 15, 5, 0, 0, Math.PI * 2)
				ctx.stroke()

				ctx.font = '8.5px "Press Start 2P", monospace'
				ctx.textAlign = 'center'
				ctx.fillText(p.label, p.x, p.y - 13 + pulse)
				ctx.restore()
			})

			// 7. Marquee Title on Top of Screen
			ctx.save()
			ctx.font = '12px "Press Start 2P", monospace'
			ctx.textAlign = 'center'
			ctx.fillStyle = currentCfg.marqueeColor
			ctx.shadowColor = currentCfg.marqueeColor
			ctx.shadowBlur = 11
			ctx.fillText(currentCfg.marquee, 360, 28)
			ctx.shadowBlur = 0
			ctx.restore()

			animId = requestAnimationFrame(loop)
		}

		loop()

		return () => {
			cancelAnimationFrame(animId)
		}
	}, [theme])

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
							<div
								className="brand-42-logo"
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									cursor: 'pointer',
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
								<>
									<button
										className="retro-btn theme-trigger-btn"
										style={{ justifyContent: 'center', gap: 8 }}
										onClick={() => {
											retroAudio.playUiBeep(600, 0.05)
											navigate('/gamelobby')
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
								{/* Widget 1: 3D Attract Mode Arcade Cabinet & Press Start */}
								<section className="retro-window col-8" id="arcadeWindow">
									<div className="window-header">
										<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
											<span>CYBER LUDO '84 // ARCADE CABINET</span>
										</div>
										<div className="window-controls">
											<span className="window-btn min" />
											<span className="window-btn max" />
										</div>
									</div>
									<div className="window-body arcade-container">
										{/* Arcade Canvas Frame & Interactive Press Start Overlay */}
										<div
											className="arcade-screen-frame"
											style={
												isWarpingToLobby
													? {
															border: '4px solid #ffffff',
															boxShadow: '0 0 35px #ffffff, 0 0 50px var(--accent-cyan)',
													  }
													: undefined
											}
											onClick={launchToLobby}
											title="Click or press Spacebar to enter Ludo Lobby"
										>
											<canvas id="arcadeCanvas" ref={canvasRef} width={720} height={400} />

											{/* Interactive Translucent Press Start Banner Overlay */}
											<div className="arcade-start-overlay">
												<span className="arcade-start-title">
													{theme === 'win95'
														? '▶ START GAME: CYBER LUDO 3D'
														: theme === 'terminal'
														? '[ EXEC: INITIALIZE_LUDO_MATCH ]'
														: '▶ INSERT COIN // PRESS START ◀'}
												</span>
												<span className="arcade-start-sub">
													{theme === 'terminal'
														? '[ CLICK OR PRESS SPACEBAR TO EXECUTE ]'
														: theme === 'win95'
														? '[ CLICK WINDOW OR PRESS SPACEBAR ]'
														: '[ CLICK SCREEN OR PRESS SPACEBAR ]'}
												</span>
											</div>

											{/* Hyperdrive Warp Flash on Launch */}
											{isWarpingToLobby && (
												<div
													style={{
														position: 'absolute',
														inset: 0,
														background: 'rgba(255, 255, 255, 0.85)',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														fontFamily: 'var(--font-heading)',
														fontSize: '1.2rem',
														color: '#0d0221',
														animation: 'pulse 0.2s infinite',
													}}
												>
													WARPING TO ARENA...
												</div>
											)}
										</div>
									</div>
								</section>

								{/* Widget 2: Comrades & Friend List */}
								<section className="retro-window col-4" id="friendsWindow">
									<div className="window-header">
										<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
											<span>FRIENDS</span>
											{pendingRequestsCount > 0 && (
												<button
													style={{
														background: 'var(--accent-pink)',
														color: '#fff',
														fontSize: '0.6rem',
														padding: '2px 6px',
														borderRadius: 3,
														fontWeight: 'bold',
														animation: 'pulse 1.5s infinite',
														cursor: 'pointer',
														border: 'none',
														outline: 'none',
														fontFamily: 'inherit',
														display: 'inline-flex',
														alignItems: 'center',
													}}
													onClick={(e) => {
														e.stopPropagation()
														retroAudio.playUiBeep(650, 0.05)
														navigate('/friends')
													}}
													title={`${pendingRequestsCount} pending friend request${pendingRequestsCount > 1 ? 's' : ''} - Click to review`}
												>
													{pendingRequestsCount} NEW
												</button>
											)}
										</div>
										<div className="window-controls">
											<span className="window-btn min" />
											<span className="window-btn max" />
										</div>
									</div>
									<div
										className="window-body"
										style={{
											display: 'flex',
											flexDirection: 'column',
											gap: 10,
											minHeight: 280,
											boxSizing: 'border-box',
										}}
									>
										{/* Top Sub-Bar: Online status & Manage button */}
										<div
											style={{
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												padding: '6px 10px',
												background: 'rgba(0, 0, 0, 0.4)',
												border: '1px solid rgba(0, 240, 255, 0.25)',
												borderRadius: 4,
											}}
										>
											<span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
												● {friends ? friends.filter((f) => f.status === 'online' || f.status === 'playing').length : 0} ONLINE // {friends ? friends.length : 0} TOTAL
											</span>
											<button
												className="retro-btn"
												style={{ padding: '3px 8px', fontSize: '0.65rem' }}
												onClick={() => {
													retroAudio.playUiBeep(600, 0.05)
													navigate('/friends')
												}}
											>
												MANAGE ↗
											</button>
										</div>

										{/* Friends List Container */}
										<div
											style={{
												flex: 1,
												maxHeight: 215,
												minHeight: 180,
												overflowY: 'auto',
												display: 'flex',
												flexDirection: 'column',
												gap: 8,
												paddingRight: 4,
											}}
										>
											{isFriendsLoading && friends === null ? (
												<div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--accent-yellow)', fontSize: '0.8rem' }}>
													SCANNING COMMS...
												</div>
											) : !friends || friends.length === 0 ? (
												<div
													style={{
														textAlign: 'center',
														padding: '24px 12px',
														display: 'flex',
														flexDirection: 'column',
														alignItems: 'center',
														gap: 10,
														color: 'var(--text-muted)',
													}}
												>
													<div style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
														NO COMRADES LINKED YET
													</div>
													<button
														className="retro-btn"
														style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}
														onClick={() => {
															retroAudio.playUiBeep(600, 0.05)
															navigate('/friends')
														}}
													>
														[+] ADD FRIENDS
													</button>
												</div>
											) : (
												friends.map((friend) => {
													const isOnline = friend.status === 'online'
													const isPlaying = friend.status === 'playing'
													const statusColor = isPlaying
														? 'var(--accent-yellow)'
														: isOnline
														? 'var(--accent-cyan)'
														: 'var(--text-muted)'
													const statusLabel = isPlaying ? 'IN GAME' : isOnline ? 'ONLINE' : 'OFFLINE'

													return (
														<div
															key={friend.id}
															style={{
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'space-between',
																padding: '8px 10px',
																background: isOnline || isPlaying ? 'rgba(25, 10, 56, 0.7)' : 'rgba(10, 5, 25, 0.5)',
																border: isOnline ? '1px solid rgba(0, 240, 255, 0.4)' : isPlaying ? '1px solid rgba(255, 230, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
																borderRadius: 4,
																gap: 8,
															}}
														>
															<div
																style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', overflow: 'hidden', flex: 1 }}
																onClick={() => {
																	retroAudio.playUiBeep(520, 0.05)
																	navigate(`/profile/${encodeURIComponent(friend.username)}`)
																}}
																title={`View ${friend.username}'s profile`}
															>
																<div style={{ position: 'relative', flexShrink: 0 }}>
																	<UserAvatar
																		username={friend.username}
																		size={32}
																		avatarStyle={friend.avatarStyle}
																		style={{ border: `1px solid ${statusColor}` }}
																	/>
																	<span
																		style={{
																			position: 'absolute',
																			bottom: -1,
																			right: -1,
																			width: 8,
																			height: 8,
																			borderRadius: '50%',
																			background: statusColor,
																			border: '1px solid #000',
																		}}
																	/>
																</div>
																<div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
																	<span
																		style={{
																			fontFamily: 'var(--font-mono)',
																			fontWeight: 'bold',
																			fontSize: '0.85rem',
																			color: '#ffffff',
																			whiteSpace: 'nowrap',
																			overflow: 'hidden',
																			textOverflow: 'ellipsis',
																		}}
																	>
																		{friend.username}
																	</span>
																	<span style={{ fontSize: '0.65rem', color: statusColor }}>
																		● {statusLabel} {friend.rating ? `// ${friend.rating} LP` : ''}
																	</span>
																</div>
															</div>

															<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
																{isOnline && (
																	<button
																		className="retro-btn"
																		style={{
																			padding: '4px 8px',
																			fontSize: '0.65rem',
																			background: 'var(--accent-pink)',
																			color: '#fff',
																		}}
																		disabled={invitingFriendId === friend.id}
																		onClick={() => handleInviteFriend(friend.id)}
																	>
																		{invitingFriendId === friend.id ? '...' : 'INVITE'}
																	</button>
																)}
															</div>
														</div>
													)
												})
											)}
										</div>

										{/* Quick Navigation Footer */}
										<div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
											<button
												className="retro-btn"
												style={{ width: '100%', padding: '6px 0', fontSize: '0.7rem', textAlign: 'center' }}
												onClick={() => {
													retroAudio.playUiBeep(600, 0.05)
													navigate('/friends')
												}}
											>
												FULL FRIEND TERMINAL
											</button>
										</div>
									</div>
								</section>

								{/* Widget 3: Pilot Career Dossier & Combat Stats */}
								<section className="retro-window col-8" id="pilotDossierWindow">
									<div className="window-header">
										<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
											<span>PILOT CAREER DOSSIER // COMBAT TELEMETRY</span>
										</div>
										<div className="window-controls">
											<span className="window-btn min" />
											<span className="window-btn max" />
										</div>
									</div>
									<div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
										{/* Top Row: Pilot Profile Identity Header */}
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												padding: '12px 16px',
												background: 'rgba(0, 0, 0, 0.45)',
												border: '1px solid var(--accent-cyan)',
												borderRadius: 4,
												flexWrap: 'wrap',
												gap: 12,
											}}
										>
											<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
												<UserAvatar
													username={username}
													size={48}
												/>
												<div>
													<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
														<span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--accent-yellow)', letterSpacing: 1 }}>
															{username.toUpperCase()}
														</span>
														<span
															style={{
																fontSize: '0.65rem',
																background: 'var(--accent-pink)',
																color: '#fff',
																padding: '2px 8px',
																borderRadius: 3,
																fontWeight: 'bold',
															}}
														>
															{stats && stats.wins >= 10 ? 'CYBER MASTER' : stats && stats.wins >= 5 ? 'CYBER ACE' : stats && stats.wins >= 1 ? 'CYBER VETERAN' : 'CYBER RECRUIT'}
														</span>
													</div>
													<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
														PILOT ID: #{user?.id ? user.id.slice(0, 8).toUpperCase() : 'UNKNOWN'} // RANKED COMBATANT
													</span>
												</div>
											</div>

											<button
												className="retro-btn"
												style={{ padding: '6px 14px', fontSize: '0.72rem' }}
												onClick={() => {
													retroAudio.playUiBeep(600, 0.05)
													navigate('/profile')
												}}
											>
												FULL PROFILE ↗
											</button>
										</div>

										{/* Bottom Row: 4 Retro Stat Metrics */}
										<div
											style={{
												display: 'grid',
												gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
												gap: 12,
											}}
										>
											{/* Stat 1: Total Battles */}
											<div
												style={{
													padding: '12px 14px',
													background: 'rgba(25, 10, 56, 0.5)',
													border: '1px solid rgba(0, 240, 255, 0.3)',
													borderRadius: 4,
													display: 'flex',
													flexDirection: 'column',
													gap: 4,
												}}
											>
												<span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
													TOTAL MATCHES
												</span>
												<span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>
													{isStatsLoading ? '...' : stats ? stats.totalGames : 0}
												</span>
											</div>

											{/* Stat 2: Victories & Defeats */}
											<div
												style={{
													padding: '12px 14px',
													background: 'rgba(25, 10, 56, 0.5)',
													border: '1px solid rgba(255, 0, 127, 0.3)',
													borderRadius: 4,
													display: 'flex',
													flexDirection: 'column',
													gap: 4,
												}}
											>
												<span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
													VICTORIES / DEFEATS
												</span>
												<span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--accent-pink)' }}>
													{isStatsLoading ? '...' : stats ? `${stats.wins}W / ${stats.losses}L` : '0W / 0L'}
												</span>
											</div>

											{/* Stat 3: Win Rate */}
											<div
												style={{
													padding: '12px 14px',
													background: 'rgba(25, 10, 56, 0.5)',
													border: '1px solid rgba(255, 230, 0, 0.3)',
													borderRadius: 4,
													display: 'flex',
													flexDirection: 'column',
													gap: 4,
												}}
											>
												<span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
													WIN RATIO
												</span>
												<span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'var(--accent-yellow)' }}>
													{isStatsLoading ? '...' : stats && stats.totalGames > 0 ? `${Math.round((stats.wins / stats.totalGames) * 100)}%` : '0%'}
												</span>
											</div>

											{/* Stat 4: Total Captures */}
											<div
												style={{
													padding: '12px 14px',
													background: 'rgba(25, 10, 56, 0.5)',
													border: '1px solid rgba(0, 255, 102, 0.3)',
													borderRadius: 4,
													display: 'flex',
													flexDirection: 'column',
													gap: 4,
												}}
											>
												<span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
													PAWNS CAPTURED
												</span>
												<span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#00ff88' }}>
													{isStatsLoading ? '...' : stats ? stats.totalCaptures : 0}
												</span>
											</div>
										</div>
									</div>
								</section>

								{/* Widget 4: Quick Deploy Arena Modes */}
								<section className="retro-window col-4" id="quickDeployWindow">
									<div className="window-header">
										<span>QUICK DEPLOY // ARENA</span>
										<div className="window-controls">
											<span className="window-btn min" />
											<span className="window-btn max" />
										</div>
									</div>
									<div
										className="window-body"
										style={{
											display: 'flex',
											flexDirection: 'column',
											gap: 10,
											justifyContent: 'space-between',
										}}
									>
										{/* Cartridge 1: 1v1 Cyber Duel */}
										<button
											className="retro-btn"
											style={{
												width: '100%',
												padding: '10px 14px',
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												background: 'rgba(0, 240, 255, 0.08)',
												border: '1px solid var(--accent-cyan)',
											}}
											onClick={() => {
												retroAudio.playUiBeep(700, 0.06)
												navigate('/gamelobby')
											}}
										>
											<div style={{ textAlign: 'left' }}>
												<div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
													1v1 CYBER DUEL
												</div>
												<div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
													Fast 2-Player Head-to-Head
												</div>
											</div>
											<span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>DEPLOY →</span>
										</button>

										{/* Cartridge 2: 4-Player Royale */}
										<button
											className="retro-btn"
											style={{
												width: '100%',
												padding: '10px 14px',
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												background: 'rgba(255, 0, 127, 0.08)',
												border: '1px solid var(--accent-pink)',
											}}
											onClick={() => {
												retroAudio.playUiBeep(700, 0.06)
												navigate('/gamelobby')
											}}
										>
											<div style={{ textAlign: 'left' }}>
												<div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', color: 'var(--accent-pink)' }}>
													4-PLAYER ROYALE
												</div>
												<div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
													Full 4-Color Mayhem
												</div>
											</div>
											<span style={{ fontSize: '0.8rem', color: 'var(--accent-pink)' }}>DEPLOY →</span>
										</button>

										{/* Cartridge 3: AI Practice / Local */}
										<button
											className="retro-btn"
											style={{
												width: '100%',
												padding: '10px 14px',
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												background: 'rgba(255, 230, 0, 0.08)',
												border: '1px solid var(--accent-yellow)',
											}}
											onClick={() => {
												retroAudio.playUiBeep(700, 0.06)
												navigate('/game')
											}}
										>
											<div style={{ textAlign: 'left' }}>
												<div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', color: 'var(--accent-yellow)' }}>
													BOT SKIRMISH
												</div>
												<div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
													Offline Practice Arena
												</div>
											</div>
											<span style={{ fontSize: '0.8rem', color: 'var(--accent-yellow)' }}>PLAY →</span>
										</button>

										{/* Global Ladder Footer Link */}
										<button
											className="retro-btn"
											style={{
												width: '100%',
												padding: '8px 12px',
												fontSize: '0.72rem',
												marginTop: 4,
											}}
											onClick={() => {
												retroAudio.playUiBeep(600, 0.05)
												navigate('/leaderboard')
											}}
										>
											VIEW GLOBAL LADDER →
										</button>
									</div>
								</section>
							</main>

							{/* Footer */}
							<footer className="retro-footer">
								<p>© 1942-2026 RETROLUDO '42 // 42KL // ALL RIGHTS RESERVED // WEB AUDIO & CANV-ARCADE</p>
							</footer>
				</div>
			</div>
		</>
	)
}
