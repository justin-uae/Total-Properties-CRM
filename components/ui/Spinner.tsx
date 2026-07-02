export function Spinner({
  size = 'md',
  color = 'accent'
}: {
  size?: 'sm' | 'md' | 'lg';
  color?: 'accent' | 'white' | 'muted';
}) {
  const sizeClass = {
    sm: 'h-4 w-4 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-8 w-8 border-[3px]'
  }[size];

  const style = {
    accent: { borderColor: '#e2e8f0', borderTopColor: 'rgb(var(--accent))' },
    white: { borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' },
    muted: { borderColor: '#e2e8f0', borderTopColor: '#94a3b8' }
  }[color];

  return (
    <div
      className={`${sizeClass} shrink-0 animate-spin rounded-full`}
      style={style}
    />
  );
}
