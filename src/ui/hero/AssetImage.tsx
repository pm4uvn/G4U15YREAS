import { useState, type CSSProperties, type ReactNode } from 'react'

interface AssetImageProps {
  src: string
  className?: string
  alt?: string
  /** Rendered only after the file fails to load (missing or undecodable). */
  fallback?: ReactNode
  priority?: boolean
  lazy?: boolean
  style?: CSSProperties
}

/**
 * An <img> that degrades to a built-in fallback if the artwork isn't there.
 * The fallback appears only once the file has failed — when the real asset
 * exists, nothing is drawn behind it.
 */
export function AssetImage({ src, className, alt = '', fallback = null, priority, lazy, style }: AssetImageProps) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  return (
    <img
      className={className}
      style={style}
      src={src}
      alt={alt}
      draggable={false}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      onError={() => setFailed(true)}
    />
  )
}
