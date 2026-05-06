import { TYPE_META, itemSubtitle } from '../lib/constants';

export default function ItemCard({ item, selected, onOpen, onFav }) {
  const m   = TYPE_META[item.type] || TYPE_META.password;
  const sub = itemSubtitle(item);
  const tags = (item.tags || []).slice(0, 2);

  return (
    <div
      className={`item-card t-${item.type} ${selected ? 'selected' : ''}`}
      onClick={() => onOpen(item.id)}
    >
      <div className="card-head">
        <div className={`type-badge tb-${item.type}`}>{m.icon}</div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div className="card-title">{item.title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
      </div>
      <div className="card-foot">
        <div className="tags">
          {tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
        <button
          className={`fav-btn ${item.is_favorite ? 'on' : ''}`}
          onClick={e => { e.stopPropagation(); onFav(item.id, !item.is_favorite); }}
        >★</button>
      </div>
    </div>
  );
}
