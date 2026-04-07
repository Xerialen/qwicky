export default function SectionLabel({ children, className = '', color = 'text-secondary' }) {
  return (
    <span className={`font-headline font-bold uppercase tracking-widest text-[10px] ${color} ${className}`}>
      {children}
    </span>
  );
}
