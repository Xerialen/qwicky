export default function MaterialIcon({ name, className = '', size, fill, ...props }) {
  const style = {};
  if (size) style.fontSize = typeof size === 'number' ? `${size}px` : size;
  if (fill) {
    style.fontVariationSettings = `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24`;
  }

  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={style}
      {...props}
    >
      {name}
    </span>
  );
}
