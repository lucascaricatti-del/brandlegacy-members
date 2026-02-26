'use client'

interface VideoPlayerProps {
  url: string
  type: 'youtube' | 'panda'
  title: string
}

function getYouTubeEmbedUrl(url: string): string {
  // Suporta: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
  const patterns = [
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`
    }
  }

  // Se já for URL de embed direta, retorna como está
  return url
}

export default function VideoPlayer({ url, type, title }: VideoPlayerProps) {
  const embedUrl = type === 'youtube' ? getYouTubeEmbedUrl(url) : url

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
