const base = 'font-headline font-black uppercase tracking-widest text-xs transition-all active:scale-95 duration-100 cursor-pointer inline-flex items-center gap-2';

const variants = {
  primary:   `${base} heat-gradient text-on-primary-fixed px-6 py-3 shadow-heat hover:brightness-110`,
  secondary: `${base} bg-surface-container-high border border-outline-variant text-on-surface px-4 py-2 hover:border-primary hover:text-primary`,
  ghost:     `${base} text-on-surface-variant px-3 py-2 hover:text-on-surface hover:bg-surface-container-high`,
  danger:    `${base} bg-transparent border border-error/30 text-error px-4 py-2 hover:bg-error/10`,
};

export default function HudButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}) {
  return (
    <button
      className={`${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
