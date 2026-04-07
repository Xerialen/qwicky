export default function StatCard({
  label,
  value,
  color = 'text-primary',
  className = '',
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="font-headline uppercase text-[9px] tracking-widest text-on-surface-variant">
        {label}
      </span>
      <span className={`font-mono text-xl font-bold ${color}`}>
        {value}
      </span>
    </div>
  );
}
