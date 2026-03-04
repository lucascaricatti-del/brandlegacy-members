"use client"

import { useState, useEffect, useRef } from "react"

const AGENTS = [
  {
    id: "cmo",
    label: "CMO",
    sublabel: "Orquestra tudo",
    icon: "◈",
    color: "#ECA206",
    glow: "#ECA206",
    description: "Visão completa de todos os mentorados. Identifica padrões, prioriza foco e alerta sobre riscos.",
    status: "active",
    x: 50,
    y: 8,
  },
  {
    id: "diagnostico",
    label: "Diagnóstico",
    sublabel: "Hub central",
    icon: "⬡",
    color: "#FCBB13",
    glow: "#FCBB13",
    description: "Presente em toda reunião. Prepara pauta antes, processa transcrição depois. Maior alimentador do banco.",
    status: "active",
    x: 50,
    y: 35,
  },
  {
    id: "projetos",
    label: "Projetos",
    sublabel: "Gera tarefas",
    icon: "◫",
    color: "#4ade80",
    glow: "#4ade80",
    description: "Transforma diagnósticos em tarefas concretas e organizadas para o mentorado executar.",
    status: "active",
    x: 20,
    y: 58,
  },
  {
    id: "cx",
    label: "CX",
    sublabel: "Evolução do mentorado",
    icon: "◎",
    color: "#60a5fa",
    glow: "#60a5fa",
    description: "Monitora tarefas pendentes, tempo sem reunião, evolução geral. Detecta churn antes de acontecer.",
    status: "active",
    x: 80,
    y: 58,
  },
  {
    id: "performance",
    label: "Performance",
    sublabel: "Meta Ads / BM",
    icon: "◬",
    color: "#f87171",
    glow: "#f87171",
    description: "Analisa Meta Ads direto na BM via API. ROAS, CPA, campanhas e criativos em tempo real.",
    status: "active",
    x: 10,
    y: 82,
  },
  {
    id: "influencia",
    label: "Influência",
    sublabel: "Busca micros",
    icon: "◉",
    color: "#c084fc",
    glow: "#c084fc",
    description: "Busca perfis de micro influencers no Instagram/TikTok baseado no nicho do mentorado.",
    status: "active",
    x: 35,
    y: 82,
  },
  {
    id: "conteudo",
    label: "Conteúdo",
    sublabel: "Copy / Roteiros",
    icon: "◪",
    color: "#34d399",
    glow: "#34d399",
    description: "Gera roteiros, copies e conteúdo de social com base no contexto do produto e público.",
    status: "active",
    x: 62,
    y: 82,
  },
  {
    id: "apresentacao",
    label: "Apresentação",
    sublabel: "Templates",
    icon: "▣",
    color: "#fb923c",
    glow: "#fb923c",
    description: "Pega o output do Diagnóstico e gera apresentações via templates automaticamente.",
    status: "active",
    x: 87,
    y: 82,
  },
]

const CONNECTIONS = [
  { from: "cmo", to: "diagnostico", strength: 1 },
  { from: "diagnostico", to: "projetos", strength: 0.9 },
  { from: "diagnostico", to: "cx", strength: 0.9 },
  { from: "diagnostico", to: "performance", strength: 0.8 },
  { from: "diagnostico", to: "influencia", strength: 0.8 },
  { from: "diagnostico", to: "conteudo", strength: 0.8 },
  { from: "diagnostico", to: "apresentacao", strength: 0.8 },
  { from: "projetos", to: "cx", strength: 0.6 },
  { from: "cmo", to: "cx", strength: 0.5 },
]

function getPos(id: string, containerWidth: number, containerHeight: number) {
  const agent = AGENTS.find((a) => a.id === id)!
  return {
    x: (agent.x / 100) * containerWidth,
    y: (agent.y / 100) * containerHeight,
  }
}

export default function AgentMap() {
  const [selected, setSelected] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 900, h: 520 })

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({
          w: containerRef.current.offsetWidth,
          h: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60)
    return () => clearInterval(interval)
  }, [])

  const selectedAgent = AGENTS.find((a) => a.id === selected)

  return (
    <div
      style={{
        fontFamily: "'Playfair Display', 'Georgia', serif",
        background: "linear-gradient(135deg, #050D07 0%, #0A1A0C 50%, #050D07 100%)",
        padding: "32px",
        color: "#F8FAF8",
        borderRadius: 20,
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 4,
            height: 40,
            background: "linear-gradient(180deg, #ECA206, #FCBB13)",
            borderRadius: 2,
          }}
        />
        <div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28,
              fontWeight: 700,
              color: "#F8FAF8",
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            Arquitetura de Agentes
          </h1>
          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 13,
              color: "rgba(252,187,19,0.6)",
              margin: "4px 0 0",
              fontStyle: "italic",
            }}
          >
            BrandLegacy Intelligence System · {AGENTS.length} agentes ativos
          </p>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Map container */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            position: "relative",
            height: 520,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(236,162,6,0.12)",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {/* Grid background */}
          <svg
            style={{ position: "absolute", inset: 0, opacity: 0.06 }}
            width="100%"
            height="100%"
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ECA206" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* SVG connections layer */}
          <svg
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            width={dims.w}
            height={dims.h}
          >
            <defs>
              {CONNECTIONS.map((conn) => {
                const from = getPos(conn.from, dims.w, dims.h)
                const to = getPos(conn.to, dims.w, dims.h)
                const id = `grad-${conn.from}-${conn.to}`
                const fromAgent = AGENTS.find((a) => a.id === conn.from)!
                const toAgent = AGENTS.find((a) => a.id === conn.to)!
                return (
                  <linearGradient key={id} id={id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={fromAgent.color} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={toAgent.color} stopOpacity="0.8" />
                  </linearGradient>
                )
              })}
            </defs>

            {/* Connection lines */}
            {CONNECTIONS.map((conn) => {
              const from = getPos(conn.from, dims.w, dims.h)
              const to = getPos(conn.to, dims.w, dims.h)
              const key = `${conn.from}-${conn.to}`
              const isHighlighted = selected === conn.from || selected === conn.to
              const mx = (from.x + to.x) / 2
              const my = (from.y + to.y) / 2 - 30

              return (
                <g key={key}>
                  <path
                    d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
                    fill="none"
                    stroke={`url(#grad-${conn.from}-${conn.to})`}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    opacity={isHighlighted ? 0.9 : 0.25}
                    style={{ transition: "all 0.3s ease" }}
                  />
                </g>
              )
            })}

            {/* Animated pulses */}
            {CONNECTIONS.map((conn, i) => {
              const from = getPos(conn.from, dims.w, dims.h)
              const to = getPos(conn.to, dims.w, dims.h)
              const fromAgent = AGENTS.find((a) => a.id === conn.from)!
              const mx = (from.x + to.x) / 2
              const my = (from.y + to.y) / 2 - 30
              const speed = 0.003 + i * 0.0007
              const t = ((tick * speed) % 1 + 1) % 1
              const bx = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mx + t * t * to.x
              const by = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * my + t * t * to.y

              return (
                <g key={`pulse-${i}`}>
                  <circle cx={bx} cy={by} r={3} fill={fromAgent.color} opacity={0.9} />
                  <circle cx={bx} cy={by} r={6} fill={fromAgent.color} opacity={0.2} />
                </g>
              )
            })}
          </svg>

          {/* Agent nodes */}
          {AGENTS.map((agent) => {
            const pos = getPos(agent.id, dims.w, dims.h)
            const isSelected = selected === agent.id
            const isConnected =
              selected &&
              CONNECTIONS.some(
                (c) =>
                  (c.from === selected && c.to === agent.id) ||
                  (c.to === selected && c.from === agent.id)
              )

            return (
              <div
                key={agent.id}
                onClick={() => setSelected(isSelected ? null : agent.id)}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  transform: "translate(-50%, -50%)",
                  cursor: "pointer",
                  zIndex: isSelected ? 10 : 5,
                  transition: "all 0.3s ease",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: -16,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${agent.color}22 0%, transparent 70%)`,
                    opacity: isSelected ? 1 : 0.5,
                  }}
                />
                <div
                  style={{
                    width: agent.id === "cmo" ? 72 : agent.id === "diagnostico" ? 64 : 54,
                    height: agent.id === "cmo" ? 72 : agent.id === "diagnostico" ? 64 : 54,
                    borderRadius: agent.id === "cmo" ? "50%" : agent.id === "diagnostico" ? "16px" : "12px",
                    background: isSelected
                      ? `linear-gradient(135deg, ${agent.color}33, ${agent.color}22)`
                      : "rgba(10,20,12,0.9)",
                    border: `${isSelected ? 2 : 1.5}px solid ${isSelected ? agent.color : agent.color + "55"}`,
                    boxShadow: isSelected
                      ? `0 0 30px ${agent.color}66, 0 0 60px ${agent.color}22, inset 0 1px 0 ${agent.color}33`
                      : isConnected
                      ? `0 0 15px ${agent.color}44`
                      : `0 0 8px ${agent.color}22`,
                    display: "flex",
                    flexDirection: "column" as const,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    transition: "all 0.3s ease",
                    position: "relative" as const,
                  }}
                >
                  <span style={{ fontSize: agent.id === "cmo" ? 22 : 18, lineHeight: 1, color: agent.color }}>
                    {agent.icon}
                  </span>
                </div>

                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    marginTop: 8,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isSelected ? agent.color : "#F8FAF8",
                      fontFamily: "monospace",
                      letterSpacing: "0.3px",
                      transition: "color 0.3s",
                    }}
                  >
                    {agent.label}
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(248,250,248,0.4)", fontFamily: "monospace", marginTop: 1 }}>
                    {agent.sublabel}
                  </div>
                </div>

                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#4ade80",
                    boxShadow: "0 0 6px #4ade80",
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              background: selectedAgent
                ? `linear-gradient(135deg, ${selectedAgent.color}11, rgba(255,255,255,0.02))`
                : "rgba(255,255,255,0.02)",
              border: `1px solid ${selectedAgent ? selectedAgent.color + "33" : "rgba(236,162,6,0.12)"}`,
              borderRadius: 16,
              padding: 20,
              minHeight: 200,
              transition: "all 0.4s ease",
            }}
          >
            {selectedAgent ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 28, color: selectedAgent.color }}>{selectedAgent.icon}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: selectedAgent.color, fontFamily: "'Playfair Display', serif" }}>
                      {selectedAgent.label}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(248,250,248,0.4)", fontFamily: "monospace" }}>
                      {selectedAgent.sublabel}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(248,250,248,0.75)", fontFamily: "Georgia, serif", margin: 0 }}>
                  {selectedAgent.description}
                </p>
                <div
                  style={{
                    marginTop: 16,
                    padding: "8px 12px",
                    background: `${selectedAgent.color}11`,
                    borderRadius: 8,
                    border: `1px solid ${selectedAgent.color}22`,
                    fontSize: 11,
                    color: selectedAgent.color,
                    fontFamily: "monospace",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
                  Agente ativo · Em construção
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, color: "rgba(248,250,248,0.3)", fontFamily: "monospace", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: 8 }}>
                    Conectado a
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                    {CONNECTIONS.filter((c) => c.from === selectedAgent.id || c.to === selectedAgent.id).map((c) => {
                      const otherId = c.from === selectedAgent.id ? c.to : c.from
                      const other = AGENTS.find((a) => a.id === otherId)!
                      return (
                        <div
                          key={otherId}
                          onClick={(e) => { e.stopPropagation(); setSelected(otherId) }}
                          style={{
                            fontSize: 10,
                            padding: "3px 8px",
                            borderRadius: 20,
                            background: `${other.color}22`,
                            border: `1px solid ${other.color}44`,
                            color: other.color,
                            fontFamily: "monospace",
                            cursor: "pointer",
                          }}
                        >
                          {other.label}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, opacity: 0.4 }}>
                <span style={{ fontSize: 32, color: "#ECA206" }}>◈</span>
                <p style={{ fontSize: 12, textAlign: "center" as const, color: "rgba(248,250,248,0.6)", fontFamily: "Georgia, serif", fontStyle: "italic", margin: 0 }}>
                  Clique em um agente para ver os detalhes
                </p>
              </div>
            )}
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(236,162,6,0.12)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(236,162,6,0.08)", fontSize: 10, fontFamily: "monospace", color: "rgba(252,187,19,0.5)", letterSpacing: "1px", textTransform: "uppercase" as const }}>
              Sistema · {AGENTS.length} agentes
            </div>
            {AGENTS.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setSelected(selected === agent.id ? null : agent.id)}
                style={{
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  background: selected === agent.id ? `${agent.color}11` : "transparent",
                  borderLeft: selected === agent.id ? `3px solid ${agent.color}` : "3px solid transparent",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: 14, color: agent.color, width: 20, textAlign: "center" as const }}>{agent.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: selected === agent.id ? agent.color : "#F8FAF8", fontFamily: "monospace" }}>
                    {agent.label}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(248,250,248,0.35)", fontFamily: "monospace" }}>
                    {agent.sublabel}
                  </div>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 4px #4ade80", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap');
      `}</style>
    </div>
  )
}
