import MaterialIcon from './ui/MaterialIcon';

const divisionIcons = [
  'military_tech',
  'workspace_premium',
  'star_half',
  'grade',
  'public',
  'shield',
  'emoji_events',
  'diamond',
];

export default function Sidebar({
  divisions,
  activeDivisionId,
  onSelectDivision,
  onAddDivision,
  activeTab,
  setActiveTab,
}) {
  return (
    <aside className="hidden md:flex flex-col h-full w-64 bg-background border-r-4 border-background shrink-0">
      <div className="px-6 py-4 mb-2">
        <div className="text-primary-container font-bold font-headline uppercase tracking-widest text-[10px]">
          SECTORS
        </div>
        <div className="text-on-surface-variant/50 font-headline uppercase tracking-widest text-[8px]">
          OPERATIONAL RUNTIME
        </div>
      </div>

      {/* Dashboard link */}
      <button
        onClick={() => setActiveTab('info')}
        className={`px-4 py-3 flex items-center gap-3 transition-all text-left ${
          activeTab === 'info' && !activeDivisionId
            ? 'bg-surface-container-high text-primary border-l-4 border-primary-container'
            : 'text-on-surface-variant/60 hover:bg-surface-container-low hover:text-primary/80 border-l-4 border-transparent'
        }`}
      >
        <MaterialIcon name="dashboard" className="text-sm" />
        <span className="font-headline uppercase tracking-widest text-[10px]">
          General Overview
        </span>
      </button>

      {/* Division list */}
      <nav className="flex-1 mt-1 space-y-px overflow-y-auto">
        {divisions.map((div, i) => {
          const isActive = div.id === activeDivisionId && activeTab === 'division';
          return (
            <button
              key={div.id}
              onClick={() => onSelectDivision(div.id)}
              className={`w-full px-4 py-3 flex items-center gap-3 transition-all text-left ${
                isActive
                  ? 'bg-surface-container-high text-primary border-l-4 border-primary-container'
                  : 'text-on-surface-variant/60 hover:bg-surface-container-low hover:text-primary/80 border-l-4 border-transparent'
              }`}
            >
              <MaterialIcon
                name={divisionIcons[i % divisionIcons.length]}
                className="text-[18px]"
              />
              <span className="font-headline uppercase tracking-widest text-[10px] truncate">
                {div.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Add division button */}
      <div className="px-4 py-4 mt-auto">
        <button
          onClick={() => onAddDivision?.('Division ' + (divisions.length + 1))}
          className="w-full bg-surface-container-high border border-outline-variant/15 py-2 flex items-center justify-center gap-2 hover:border-primary hover:text-primary text-on-surface-variant transition-all"
        >
          <MaterialIcon name="add" className="text-[16px]" />
          <span className="font-headline uppercase tracking-widest text-[10px]">
            Add Division
          </span>
        </button>
      </div>
    </aside>
  );
}
