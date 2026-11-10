import type { MilitaryCommand, WorldState } from '../../../../shared/types';
import type { GeoInfo } from '../../lib/api';
import { ArmyTab } from './ArmyTab';
import { BattlesTab } from './BattlesTab';
import { DivisionDesigner } from './DivisionDesigner';
import { JetDesigner } from './JetDesigner';
import { ProductionTab } from './ProductionTab';
import { ResearchTab } from './ResearchTab';
import { TankDesigner } from './TankDesigner';

export type MilTab = 'army' | 'research' | 'divisions' | 'tanks' | 'jets' | 'production' | 'battles';
const TABS: { id: MilTab; label: string }[] = [
  { id: 'army', label: 'Army' },
  { id: 'battles', label: 'Battles' },
  { id: 'research', label: 'Research' },
  { id: 'divisions', label: 'Division Designer' },
  { id: 'tanks', label: 'Tank Designer' },
  { id: 'jets', label: 'Jet Designer' },
  { id: 'production', label: 'Production' },
];

interface Props {
  state: WorldState;
  tab: MilTab;
  onTab: (t: MilTab) => void;
  onClose: () => void;
  run: (cmd: MilitaryCommand) => Promise<boolean>;
  busy: boolean;
  geo: GeoInfo | null;
  onLocate: (province: string) => void;
}

export function MilitaryScreen({ state, tab, onTab, onClose, run, busy, geo, onLocate }: Props) {
  const nm = state.military!.nations[state.playerNation];
  const props = { state, nm, run, busy };
  const battles = state.military!.battles.length;
  return (
    <div className="military">
      <header className="mil-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => onTab(t.id)}>
            {t.label}{t.id === 'battles' && battles > 0 ? ` (${battles})` : ''}
            {t.id === 'research' && nm.research.some((s) => !s) ? <span className="dot" title="Free research slot" /> : null}
          </button>
        ))}
        <div className="spacer" />
        <button className="btn" onClick={onClose}>Back to map ✕</button>
      </header>
      <div className="mil-body scroll">
        {tab === 'army' && <ArmyTab {...props} geo={geo} onLocate={onLocate} />}
        {tab === 'battles' && <BattlesTab state={state} onLocate={onLocate} />}
        {tab === 'research' && <ResearchTab {...props} />}
        {tab === 'divisions' && <DivisionDesigner {...props} />}
        {tab === 'tanks' && <TankDesigner {...props} />}
        {tab === 'jets' && <JetDesigner {...props} />}
        {tab === 'production' && <ProductionTab {...props} />}
      </div>
    </div>
  );
}
