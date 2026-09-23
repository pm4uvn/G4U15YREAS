/**
 * A single acoustic guitar drawn upright in local coordinates (neck up, body
 * down, centred on x = 0), then tilted as one piece — so the neck, body and
 * strings can never come apart. Local y: nut -420, body top -20, bridge 270.
 */
const NUT_Y = -420
const BODY_TOP_Y = -20
const BRIDGE_Y = 270

const BODY =
  'M -95 -20 C -132 -10 -142 40 -118 75 C -100 105 -96 122 -126 160 ' +
  'C -178 218 -162 332 -70 352 C -30 361 30 361 70 352 ' +
  'C 162 332 178 218 126 160 C 96 122 100 105 118 75 C 142 40 132 -10 95 -20 Z'

const HALF_WIDTH_AT_BODY = 30
const HALF_WIDTH_AT_NUT = 26

const neckHalfWidth = (y: number) =>
  HALF_WIDTH_AT_BODY + ((HALF_WIDTH_AT_NUT - HALF_WIDTH_AT_BODY) * (y - BODY_TOP_Y)) / (NUT_Y - BODY_TOP_Y)

// Equal-temperament fret spacing; the 12th fret lands exactly where the neck meets the body.
const SCALE_LENGTH = (BODY_TOP_Y - NUT_Y) * 2
const FRETS = Array.from({ length: 12 }, (_, i) => NUT_Y + SCALE_LENGTH * (1 - Math.pow(2, -(i + 1) / 12)))
const INLAY_FRETS = [3, 5, 7, 9]

const STRINGS = Array.from({ length: 6 }, (_, i) => {
  const k = i - 2.5
  return { x1: k * 8, x2: k * 16, w: 2 - i * 0.28 }
})

/** Vector stand-in for hero-guitar. */
export function Guitar() {
  return (
    <svg className="hero-guitar-fallback" viewBox="0 0 560 900" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="guitarEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a6320" />
          <stop offset="0.55" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#f0b552" />
        </linearGradient>
        <linearGradient id="guitarWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#24140b" />
          <stop offset="1" stopColor="#0b0604" />
        </linearGradient>
        <filter id="guitarGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <g transform="translate(205 461) rotate(-35) scale(1.3)">
        {/* Body: soft glow, fill, crisp edge, inner binding */}
        <path d={BODY} fill="none" stroke="#f0b552" strokeWidth="12" filter="url(#guitarGlow)" opacity="0.65" />
        <path d={BODY} fill="url(#guitarWood)" stroke="url(#guitarEdge)" strokeWidth="2.6" />
        <path d={BODY} fill="none" stroke="#d9b062" strokeWidth="0.8" opacity="0.55" transform="translate(0 176) scale(0.93) translate(0 -176)" />

        {/* Neck */}
        <polygon
          points={`${-HALF_WIDTH_AT_BODY},${BODY_TOP_Y} ${HALF_WIDTH_AT_BODY},${BODY_TOP_Y} ${HALF_WIDTH_AT_NUT},${NUT_Y} ${-HALF_WIDTH_AT_NUT},${NUT_Y}`}
          fill="#150c07"
          stroke="url(#guitarEdge)"
          strokeWidth="1.6"
        />
        {FRETS.map((y, i) => (
          <line key={i} x1={-neckHalfWidth(y)} y1={y} x2={neckHalfWidth(y)} y2={y} stroke="#d9b062" strokeWidth="1.3" opacity="0.8" />
        ))}
        {INLAY_FRETS.map((n) => (
          <circle key={n} cx="0" cy={(FRETS[n - 1] + FRETS[n - 2]) / 2} r="3.4" fill="#f0c060" opacity="0.85" />
        ))}
        <circle cx="-7" cy={(FRETS[11] + FRETS[10]) / 2} r="3.4" fill="#f0c060" opacity="0.85" />
        <circle cx="7" cy={(FRETS[11] + FRETS[10]) / 2} r="3.4" fill="#f0c060" opacity="0.85" />

        {/* Headstock + tuning pegs */}
        <polygon
          points={`${-HALF_WIDTH_AT_NUT},${NUT_Y} ${HALF_WIDTH_AT_NUT},${NUT_Y} 38,${NUT_Y - 86} -38,${NUT_Y - 86}`}
          fill="#150c07"
          stroke="url(#guitarEdge)"
          strokeWidth="1.6"
        />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <circle cx="-48" cy={NUT_Y - 18 - i * 26} r="5" fill="#d9b062" opacity="0.9" />
            <circle cx="48" cy={NUT_Y - 18 - i * 26} r="5" fill="#d9b062" opacity="0.9" />
          </g>
        ))}

        {/* Sound hole + rosette */}
        <circle cx="0" cy="95" r="47" fill="#050304" stroke="#f0c060" strokeWidth="2" />
        <circle cx="0" cy="95" r="58" fill="none" stroke="#d9b062" strokeWidth="1.2" strokeDasharray="2 5" opacity="0.85" />
        <circle cx="0" cy="95" r="64" fill="none" stroke="#d9b062" strokeWidth="0.8" opacity="0.5" />

        {/* Bridge */}
        <rect x="-58" y={BRIDGE_Y} width="116" height="15" rx="5" fill="#26160c" stroke="#d9b062" strokeWidth="1.2" />
        {STRINGS.map((s, i) => (
          <circle key={i} cx={s.x2 * 1.25} cy={BRIDGE_Y + 7.5} r="1.6" fill="#f0c060" />
        ))}

        {/* Strings run nut -> bridge across the neck, sound hole and body */}
        {STRINGS.map((s, i) => (
          <line
            key={i}
            x1={s.x1}
            y1={NUT_Y}
            x2={s.x2}
            y2={BRIDGE_Y + 3}
            stroke="#f4dfa6"
            strokeWidth={s.w * 0.75}
            opacity="0.9"
          />
        ))}

        {/* Script along the lower bout */}
        {['More than', 'Music', 'People', 'Journey'].map((line, i) => (
          <text
            key={line}
            transform={`translate(${74 + i * 30} 335) rotate(-90)`}
            fontSize="24"
            fill="#f0c060"
            opacity="0.9"
            style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}
          >
            {line}
          </text>
        ))}
      </g>

    </svg>
  )
}
