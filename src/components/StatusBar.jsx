import MaterialIcon from './ui/MaterialIcon';
import useSyncStatusStore from '../stores/syncStatusStore';

const statusLabels = {
  synced:     'Auto-Save: Synced',
  saving:     'Saving...',
  unsaved:    'Unsaved Changes',
  error:      'Sync Error',
  local_only: 'Local Only',
};

export default function StatusBar() {
  const { status } = useSyncStatusStore();
  const label = statusLabels[status] || 'Auto-Save';
  const isSaving = status === 'saving';

  return (
    <footer className="bg-surface-container-lowest border-t-2 border-surface-container-high flex justify-between items-center px-8 py-1 h-8 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-on-surface-variant/40 hover:text-on-surface-variant cursor-default transition-colors">
          <MaterialIcon name="terminal" className="text-[14px]" />
          <span className="font-mono text-[9px] uppercase">Log</span>
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant/40 hover:text-on-surface-variant cursor-default transition-colors">
          <MaterialIcon name="lan" className="text-[14px]" />
          <span className="font-mono text-[9px] uppercase">Network</span>
        </div>
        <div className="flex items-center gap-2 text-primary font-bold">
          <MaterialIcon name="sensors" className="text-[14px]" />
          <span className="font-mono text-[9px] uppercase">Status</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-on-surface-variant/40">
          <MaterialIcon
            name="sync"
            className={`text-[14px] ${isSaving ? 'animate-spin-slow' : ''}`}
          />
          <span className="font-mono text-[9px] uppercase">{label}</span>
        </div>
        <div className="h-3 w-px bg-surface-container-high" />
        <div className="font-mono text-[8px] text-on-surface-variant/30 uppercase tracking-tighter">
          QWICKY v1.0.0
        </div>
      </div>
    </footer>
  );
}
