export function FlameSVG({ size = 90, animated = true, dim = false }) {
  const id = `fg${size}${animated}`
  return (
    <div
      className={animated && !dim ? 'flame-anim' : ''}
      style={{ opacity: dim ? 0.22 : 1, display: 'inline-block' }}
    >
      <svg width={size} height={size * 1.2} viewBox="0 0 100 120">
        <defs>
          <radialGradient id={id} cx="50%" cy="70%" r="60%">
            <stop offset="0%"   stopColor="#F5D77A" />
            <stop offset="45%"  stopColor="#E8943A" />
            <stop offset="100%" stopColor="#E0632A" />
          </radialGradient>
        </defs>
        <path
          d="M50 8 C62 30 82 40 82 72 a32 32 0 0 1-64 0 C18 52 30 44 38 30 C40 44 50 46 50 38 C48 28 50 18 50 8 Z"
          fill={`url(#${id})`}
        />
      </svg>
    </div>
  )
}
