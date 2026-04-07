const variants = {
  lowest:  'bg-surface-container-lowest',
  low:     'bg-surface-container-low',
  default: 'bg-surface-container-high',
  high:    'bg-surface-container-high',
  highest: 'bg-surface-container-highest',
};

const ribbonColors = {
  active:  'border-l-4 border-l-primary-container',
  error:   'border-l-4 border-l-error',
  neutral: 'border-l-4 border-l-outline-variant',
  success: 'border-l-4 border-l-tertiary',
};

export default function HudPanel({
  children,
  variant = 'default',
  ribbon,
  className = '',
  ...props
}) {
  const base = variants[variant] || variants.default;
  const ribbonClass = ribbon ? ribbonColors[ribbon] || '' : '';

  return (
    <div
      className={`${base} ${ribbonClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
