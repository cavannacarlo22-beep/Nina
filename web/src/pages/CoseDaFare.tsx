import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, ArrowRightLeft, Bell, CalendarDays, CalendarClock, CheckCheck, ChevronDown, ChevronRight, Copy, GripVertical, Inbox, ListChecks,
  MoreHorizontal, Pencil, Pin, Plus, Repeat, Search, StickyNote, Sun, Trash2, X,
} from 'lucide-react';
import { db, uid } from '../db/db';
import type { ListKind, QuickNote, Task, TodoList } from '../db/types';
import { addDays, fromISO, toISO, todayISO } from '../lib/dates';
import { blankTask, CATEGORIES, categoryInfo, dueLabel, PRIORITIES, saveTask, toggleTask } from '../lib/tasks';
import * as voce from '../content/voce';
import { Empty, Modal, Progress, Swatches, Switch, useMenu, useUI } from '../components/ui';

export const LIST_KINDS: { id: ListKind; label: string; emoji: string; color: string }[] = [
  { id: 'personale', label: 'Personale', emoji: '🌸', color: '#f39cc0' },
  { id: 'studio', label: 'Studio', emoji: '📚', color: '#bfa8e8' },
  { id: 'lavoro', label: 'Lavoro', emoji: '💼', color: '#7fbfe8' },
  { id: 'casa', label: 'Casa', emoji: '🏡', color: '#8fd0b0' },
  { id: 'spesa', label: 'Spesa', emoji: '🛒', color: '#f6bf95' },
  { id: 'viaggi', label: 'Viaggi', emoji: '✈️', color: '#5fa8dc' },
  { id: 'beauty', label: 'Beauty', emoji: '💄', color: '#e88aa3' },
  { id: 'altro', label: 'Altro', emoji: '✨', color: '#e46f8e' },
];
const EMOJIS = ['📚', '📝', '💼', '🏡', '🌸', '🛒', '✈️', '✨', '💖', '🧘‍♀️', '🏋️‍♀️', '🎁', '💄', '🍰', '🐾', '🎬', '📖', '💡', '🧺', '🌷', '☕', '🎀', '💰', '💅'];

type View = 'oggi' | 'programma' | 'ricordare' | 'tutte' | 'completate';
const VIEWS: { id: View; label: string; icon: typeof Sun }[] = [
  { id: 'oggi', label: 'Oggi', icon: Sun },
  { id: 'programma', label: 'In programma', icon: CalendarDays },
  { id: 'ricordare', label: 'Da ricordare', icon: StickyNote },
  { id: 'tutte', label: 'Tutte', icon: Inbox },
  { id: 'completate', label: 'Completate', icon: CheckCheck },
];

export default function CoseDaFare() {
  const { listId } = useParams();
  const nav = useNavigate();
  const ui = useUI();
  const [view, setView] = useState<View>('oggi');
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileViewOpen = () => mobileOpen;
  const openMobileView = () => setMobileOpen(true);
  const closeMobileView = () => { setMobileOpen(false); nav('/cose'); };
  const [editList, setEditList] = useState<TodoList | null>(null);
  const lists = useLiveQuery(() => db.lists.orderBy('order').toArray(), []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const notesCount = useLiveQuery(() => db.quickNotes.filter((n) => !n.convertedTaskId).count(), []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  if (!lists || !tasks) return null;

  const today = todayISO();
  const sorted = [...lists].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
  const activeList = lists.find((l) => l.id === listId);
  const wide = window.innerWidth > 1023;
  const counts = (pred: (t: Task) => boolean) => tasks.filter(pred).length;
  const viewCount: Record<View, number> = {
    oggi: counts((t) => !t.isCompleted && !!t.date && t.date <= today),
    programma: counts((t) => !t.isCompleted && !!t.date && t.date > today),
    ricordare: notesCount ?? 0,
    tutte: counts((t) => !t.isCompleted),
    completate: 0,
  };

  const newList = () => setEditList({ id: '', title: '', kind: 'personale', color: '#f39cc0', emoji: '🌸', order: lists.length, pinned: false, createdAt: 0, updatedAt: 0 });
  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = sorted.map((l) => l.id);
    const next = arrayMove(sorted, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    await db.transaction('rw', db.lists, async () => { for (let i = 0; i < next.length; i++) await db.lists.update(next[i].id, { order: i }); });
  };
  const showSide = wide || (!listId && !mobileViewOpen());

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Cose da fare</h1><p>Attività con un giorno, liste senza scadenza e le cose da ricordare: tutto in un posto.</p></div>
        <button className="btn btn-primary" onClick={newList}><Plus size={18} />Nuova lista</button>
      </div>
      <div className="lists-layout">
        {showSide && (
          <div className="card" style={{ padding: 10 }}>
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button key={id} className={'list-card' + (!listId && view === id ? ' active' : '')} style={{ minHeight: 48 }}
                onClick={() => { setView(id); nav('/cose'); openMobileView(); }}>
                <span className="list-emoji" style={{ background: 'var(--primary-soft)', width: 34, height: 34 }}><Icon size={17} color="var(--primary-strong)" /></span>
                <b className="grow">{label}</b>
                {viewCount[id] > 0 && <span className="badge soft">{viewCount[id]}</span>}
              </button>
            ))}
            <div className="nav-section" style={{ padding: '14px 12px 6px' }}>Le mie liste</div>
            {sorted.length === 0 && <p className="small muted" style={{ padding: '0 12px' }}>Spesa, viaggi, film da vedere… crea tutte le liste che vuoi.</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sorted.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                {sorted.map((l) => (
                  <SortableListCard key={l.id} list={l} active={listId === l.id}
                    count={{ done: counts((t) => t.listId === l.id && t.isCompleted), total: counts((t) => t.listId === l.id) }}
                    onClick={() => nav(`/cose/${l.id}`)} />
                ))}
              </SortableContext>
            </DndContext>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={newList}><Plus size={15} />Nuova lista</button>
          </div>
        )}
        {(wide || listId || mobileViewOpen()) && (
          activeList ? (
            <ListDetail key={activeList.id} list={activeList} tasks={tasks.filter((t) => t.listId === activeList.id)} lists={lists}
              onBack={closeMobileView} onEdit={() => setEditList(activeList)} onDeleted={() => { nav('/cose'); ui.toast('Lista eliminata'); }} />
          ) : view === 'ricordare' ? (
            <QuickNotesView onBack={closeMobileView} />
          ) : (
            <SmartView view={view} tasks={tasks} lists={lists} onBack={closeMobileView} />
          )
        )}
      </div>
      {editList && <ListEditor list={editList} onClose={() => setEditList(null)} onCreated={(id) => nav(`/cose/${id}`)} />}
    </div>
  );
}

function SortableListCard({ list, active, count, onClick }: { list: TodoList; active: boolean; count: { done: number; total: number }; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id });
  const pct = count.total ? count.done / count.total : 0;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} {...attributes} {...listeners}>
      <button className={'list-card' + (active ? ' active' : '')} onClick={onClick}>
        <span className="list-emoji" style={{ background: list.color + '33' }}>{list.emoji}</span>
        <div className="grow">
          <div className="row" style={{ gap: 6 }}><b className="ellipsis">{list.title}</b>{list.pinned && <Pin size={12} color="var(--primary)" />}</div>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <div className="grow"><div className="progress" style={{ height: 6 }}><div style={{ width: `${pct * 100}%`, background: list.color }} /></div></div>
            <span className="tiny muted">{count.done}/{count.total}</span>
          </div>
        </div>
      </button>
    </div>
  );
}

function useCompletion() {
  const ui = useUI();
  return async (t: Task, remainingToday?: number) => {
    const r = await toggleTask(t);
    if (r === 'done') ui.toast(remainingToday === 1 ? voce.tutteFatte() : voce.attivitaFatta());
  };
}

function SmartView({ view, tasks, lists, onBack }: { view: View; tasks: Task[]; lists: TodoList[]; onBack: () => void }) {
  const [edit, setEdit] = useState<Task | null>(null);
  const [q, setQ] = useState('');
  const complete = useCompletion();
  const today = todayISO();
  const listMap = new Map(lists.map((l) => [l.id, l]));
  const needle = q.trim().toLowerCase();
  const match = (t: Task) => !needle || t.title.toLowerCase().includes(needle) || (t.notes ?? '').toLowerCase().includes(needle);
  const byDate = (a: Task, b: Task) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99');

  let groups: { title: string; items: Task[]; tone?: string }[] = [];
  let subtitle = '';
  if (view === 'oggi') {
    const overdue = tasks.filter((t) => !t.isCompleted && t.date && t.date < today).sort(byDate);
    const todays = tasks.filter((t) => t.date === today && !t.isCompleted).sort(byDate);
    const doneToday = tasks.filter((t) => t.date === today && t.isCompleted);
    groups = [
      { title: 'Rimaste indietro', items: overdue, tone: 'late' },
      { title: 'Oggi', items: todays },
      { title: 'Fatte oggi', items: doneToday },
    ];
    const left = overdue.length + todays.length;
    subtitle = left ? voce.rimaste(left) : doneToday.length ? voce.tutteFatte() : voce.nienteAttivitaOggi();
  } else if (view === 'programma') {
    const upcoming = tasks.filter((t) => !t.isCompleted && t.date && t.date > today).sort(byDate);
    const map = new Map<string, Task[]>();
    for (const t of upcoming) map.set(t.date!, [...(map.get(t.date!) ?? []), t]);
    groups = [...map.entries()].map(([d, items]) => ({ title: d === toISO(addDays(new Date(), 1)) ? 'Domani' : fromISO(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }), items }));
    subtitle = upcoming.length ? `${upcoming.length} cose nei prossimi giorni` : 'Niente in programma. Che leggerezza 😌';
  } else if (view === 'tutte') {
    const open = tasks.filter((t) => !t.isCompleted);
    groups = [
      { title: 'Con una data', items: open.filter((t) => t.date).sort(byDate) },
      { title: 'Senza data', items: open.filter((t) => !t.date).sort((a, b) => a.sortOrder - b.sortOrder) },
    ];
    subtitle = `${open.length} da fare`;
  } else {
    const done = tasks.filter((t) => t.isCompleted).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    groups = [{ title: 'Completate', items: done.slice(0, 300) }];
    subtitle = `${done.length} cose fatte. Brava 💗`;
  }
  groups = groups.map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length);
  const remainingToday = view === 'oggi' ? tasks.filter((t) => !t.isCompleted && t.date && t.date <= today).length : undefined;

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="icon-btn mobile-only" onClick={onBack} aria-label="Indietro"><ArrowLeft size={20} /></button>
        <div className="grow"><h2>{VIEWS.find((v) => v.id === view)?.label}</h2><div className="small muted">{subtitle}</div></div>
        {view !== 'completate' && <button className="btn btn-primary btn-sm" onClick={() => setEdit(blankTask({ date: view === 'oggi' ? today : view === 'programma' ? toISO(addDays(new Date(), 1)) : null }))}><Plus size={16} />Aggiungi</button>}
      </div>
      {view !== 'completate' && <QuickAdd defaults={{ date: view === 'oggi' ? today : view === 'programma' ? toISO(addDays(new Date(), 1)) : null }} />}
      {tasks.length > 8 && <div className="search" style={{ margin: '10px 0' }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca" /></div>}
      {groups.length === 0 && <Empty title={view === 'oggi' ? voce.nienteAttivitaOggi() : 'Qui non c’è niente'} />}
      {groups.map((g) => (
        <div key={g.title} style={{ marginTop: 14 }}>
          <div className="label" style={{ marginBottom: 8, color: g.tone === 'late' ? 'var(--danger)' : undefined, textTransform: 'capitalize' }}>{g.title}{g.tone === 'late' ? ` · ${voce.attivitaScaduta()}` : ''}</div>
          {g.items.map((t) => (
            <TaskRow key={t.id} task={t} list={t.listId ? listMap.get(t.listId) : undefined} sortable={false}
              onToggle={() => complete(t, remainingToday)} onOpen={() => setEdit(t)} late={!t.isCompleted && !!t.date && t.date < today} />
          ))}
        </div>
      ))}
      {edit && <TaskEditor task={edit} lists={lists} onClose={() => setEdit(null)} />}
    </div>
  );
}

function QuickAdd({ defaults }: { defaults: Partial<Task> }) {
  const [text, setText] = useState('');
  const add = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const title of lines) await saveTask(blankTask({ ...defaults, title }));
    setText('');
  };
  return (
    <form className="row" style={{ alignItems: 'flex-start' }} onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <textarea className="textarea" style={{ minHeight: 44, height: 44 }} rows={1} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void add(); } }}
        placeholder="Aggiungi un’attività…" title="Puoi incollare più righe per aggiungere tante attività insieme" />
      <button className="btn btn-soft" type="submit" aria-label="Aggiungi"><Plus size={18} /></button>
    </form>
  );
}

function ListDetail({ list, tasks, lists, onBack, onEdit, onDeleted }: { list: TodoList; tasks: Task[]; lists: TodoList[]; onBack: () => void; onEdit: () => void; onDeleted: () => void }) {
  const ui = useUI();
  const menu = useMenu();
  const complete = useCompletion();
  const [showDone, setShowDone] = useState(true);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const items = useMemo(() => [...tasks].sort((a, b) => a.sortOrder - b.sortOrder), [tasks]);
  const filtered = q ? items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase())) : items;
  const todo = filtered.filter((i) => !i.isCompleted);
  const done = filtered.filter((i) => i.isCompleted);
  const pct = items.length ? items.filter((i) => i.isCompleted).length / items.length : 0;

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = todo.map((i) => i.id);
    const next = arrayMove(todo, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    await db.transaction('rw', db.tasks, async () => { for (let k = 0; k < next.length; k++) await db.tasks.update(next[k].id, { sortOrder: k }); });
  };

  const openMenu = (e: React.MouseEvent) => menu.open(e, [
    { label: 'Modifica lista', icon: <Pencil size={16} />, onClick: onEdit },
    { label: list.pinned ? 'Rimuovi dai fissati' : 'Fissa in alto', icon: <Pin size={16} />, onClick: () => db.lists.update(list.id, { pinned: !list.pinned }) },
    { label: 'Duplica lista', icon: <Copy size={16} />, onClick: async () => {
      const id = uid();
      await db.lists.add({ ...list, id, title: list.title + ' (copia)', createdAt: Date.now(), updatedAt: Date.now(), order: list.order + 0.5 });
      await db.tasks.bulkAdd(items.map((i) => ({ ...i, id: uid(), listId: id, seriesId: null })));
      ui.toast('Lista duplicata');
    } },
    { label: 'Segna tutto come fatto', icon: <CheckCheck size={16} />, onClick: () => db.tasks.where('listId').equals(list.id).modify({ isCompleted: true, completedAt: new Date().toISOString() }) },
    { label: 'Ripristina tutto (da fare)', icon: <ChevronDown size={16} />, onClick: () => db.tasks.where('listId').equals(list.id).modify({ isCompleted: false, completedAt: null }) },
    { label: 'Elimina completate', icon: <Trash2 size={16} />, onClick: () => db.tasks.where('listId').equals(list.id).filter((i) => i.isCompleted).delete() },
    { divider: true, label: '', onClick: () => {} },
    { label: 'Elimina lista', icon: <Trash2 size={16} />, danger: true, onClick: async () => {
      if (await ui.confirm({ title: `Eliminare “${list.title}”?`, message: `La lista e le sue ${items.length} attività verranno eliminate.`, ok: 'Elimina', danger: true })) {
        await db.transaction('rw', db.lists, db.tasks, async () => {
          await db.tasks.where('listId').equals(list.id).delete();
          await db.lists.delete(list.id);
        });
        onDeleted();
      }
    } },
  ]);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="icon-btn mobile-only" onClick={onBack} aria-label="Indietro"><ArrowLeft size={20} /></button>
        <span className="list-emoji" style={{ background: list.color + '33', width: 48, height: 48, fontSize: '1.5rem' }}>{list.emoji}</span>
        <div className="grow">
          <h2 className="ellipsis">{list.title}</h2>
          <div className="small muted">{items.filter((i) => i.isCompleted).length} di {items.length} completate · {Math.round(pct * 100)}%</div>
        </div>
        <button className="icon-btn" onClick={openMenu} aria-label="Opzioni"><MoreHorizontal size={20} /></button>
      </div>
      <Progress value={pct} />
      <div style={{ marginTop: 16 }}><QuickAdd defaults={{ listId: list.id, category: list.kind === 'studio' ? 'STUDIO' : list.kind === 'lavoro' ? 'LAVORO' : list.kind === 'casa' ? 'CASA' : list.kind === 'spesa' || list.kind === 'beauty' ? 'SHOPPING' : 'PERSONALE' }} /></div>
      {items.length > 6 && <div className="search" style={{ marginTop: 10 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nella lista" /></div>}
      <div style={{ marginTop: 16 }}>
        {todo.length === 0 && done.length === 0 && <Empty title="Lista vuota" text="Scrivi qui sopra la prima cosa." />}
        {todo.length === 0 && done.length > 0 && <p className="small" style={{ textAlign: 'center', color: 'var(--primary-strong)' }}>{voce.tutteFatte()}</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={todo.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {todo.map((i) => <TaskRow key={i.id} task={i} sortable={!q} onToggle={() => complete(i)} onOpen={() => setEdit(i)} late={!!i.date && i.date < todayISO()} />)}
          </SortableContext>
        </DndContext>
        {done.length > 0 && (
          <>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => setShowDone(!showDone)}>
              {showDone ? <ChevronDown size={16} /> : <ChevronRight size={16} />}Completate ({done.length})
            </button>
            {showDone && <div style={{ marginTop: 8 }}>{done.map((i) => <TaskRow key={i.id} task={i} sortable={false} onToggle={() => complete(i)} onOpen={() => setEdit(i)} />)}</div>}
          </>
        )}
      </div>
      {edit && <TaskEditor task={edit} lists={lists} onClose={() => setEdit(null)} />}
      {menu.node}
    </div>
  );
}

export function TaskRow({ task, list, sortable, onToggle, onOpen, late }: { task: Task; list?: TodoList; sortable: boolean; onToggle: () => void; onOpen: () => void; late?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !sortable });
  const [text, setText] = useState(task.title);
  const cat = categoryInfo(task.category);
  const prio = PRIORITIES.find((p) => p.id === task.priority);
  return (
    <div ref={setNodeRef} className={'todo' + (task.isCompleted ? ' done' : '')}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1, zIndex: isDragging ? 2 : undefined, position: 'relative', boxShadow: isDragging ? 'var(--shadow-lg)' : undefined }}>
      {sortable ? <button className="drag-handle" {...attributes} {...listeners} aria-label="Trascina per riordinare"><GripVertical size={18} /></button> : <span style={{ width: 4 }} />}
      <input type="checkbox" className="checkbox" checked={task.isCompleted} onChange={onToggle} aria-label="Completata" />
      {task.priority !== 'MEDIUM' && <span className="prio" style={{ background: prio?.color }} title={'Priorità ' + prio?.label} />}
      <div className="grow">
        <input className="todo-text" value={text} onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && text !== task.title && db.tasks.update(task.id, { title: text.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Testo attività" />
        <div className="tiny row" style={{ gap: 10, paddingLeft: 4, color: late ? 'var(--danger)' : 'var(--muted)', flexWrap: 'wrap' }}>
          {task.date && <span className="row" style={{ gap: 3 }}><CalendarClock size={11} />{dueLabel(task)}</span>}
          {list && <span>{list.emoji} {list.title}</span>}
          {!list && <span>{cat.emoji} {cat.label}</span>}
          {task.repeatType !== 'NEVER' && <Repeat size={11} />}
          {task.notificationEnabled && <Bell size={11} />}
          {task.notes && <span className="row ellipsis" style={{ gap: 3, maxWidth: 220 }}><StickyNote size={11} />{task.notes}</span>}
        </div>
      </div>
      <button className="icon-btn sm" onClick={onOpen} aria-label="Dettagli"><MoreHorizontal size={16} /></button>
    </div>
  );
}

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const REMINDERS: [number, string][] = [[0, 'All’orario'], [5, '5 min prima'], [15, '15 min prima'], [30, '30 min prima'], [60, '1 ora prima'], [1440, '1 giorno prima']];

export function TaskEditor({ task, lists, onClose }: { task: Task; lists: TodoList[]; onClose: () => void }) {
  const ui = useUI();
  const [t, setT] = useState(task);
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setT((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!t.title.trim()) { ui.toast('Scrivi cosa c’è da fare', true); return; }
    await saveTask(t);
    if (!task.id) ui.toast('Aggiunta 💗');
    onClose();
  };
  const remove = async () => {
    const series = t.seriesId ? await db.tasks.filter((x) => x.seriesId === t.seriesId && !x.isCompleted && x.id !== t.id).count() : 0;
    if (await ui.confirm({ title: 'Eliminare l’attività?', message: series ? 'Le altre ripetizioni restano.' : undefined, ok: 'Elimina', danger: true })) {
      await db.tasks.delete(task.id);
      onClose();
    }
  };
  return (
    <Modal title={task.id ? 'Modifica' : 'Nuova attività'} onClose={onClose} footer={<>
      {task.id && <button className="btn btn-danger" onClick={remove}><Trash2 size={16} />Elimina</button>}
      <span className="grow" />
      <button className="btn" onClick={onClose}>Annulla</button>
      <button className="btn btn-primary" onClick={save}>Salva</button>
    </>}>
      <div className="stack">
        <input className="input" autoFocus value={t.title} onChange={(e) => set('title', e.target.value)} placeholder="Cosa c’è da fare?" onKeyDown={(e) => e.key === 'Enter' && save()} />
        <div className="field-row">
          <label className="field"><span>Giorno</span>
            <div className="row"><input className="input" type="date" value={t.date ?? ''} onChange={(e) => set('date', e.target.value || null)} />
              {t.date && <button className="icon-btn sm" onClick={() => set('date', null)} aria-label="Togli il giorno"><X size={14} /></button>}</div>
          </label>
          <label className="field"><span>Ora</span><input className="input" type="time" value={t.time ?? ''} onChange={(e) => set('time', e.target.value || null)} disabled={!t.date} /></label>
          <label className="field"><span>Lista</span>
            <select className="select" value={t.listId ?? ''} onChange={(e) => set('listId', e.target.value || null)}>
              <option value="">Nessuna lista</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.title}</option>)}
            </select>
          </label>
        </div>
        <div className="field"><span>Categoria</span>
          <div className="chips">{CATEGORIES.map((c) => <button key={c.id} className={'chip' + (t.category === c.id ? ' active' : '')} onClick={() => set('category', c.id)}>{c.emoji} {c.label}</button>)}</div>
        </div>
        <div className="field"><span>Priorità</span>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>{PRIORITIES.map((p) => <button key={p.id} className={t.priority === p.id ? 'active' : ''} onClick={() => set('priority', p.id)}>{p.label}</button>)}</div>
        </div>
        <div className="field"><span><Repeat size={13} style={{ verticalAlign: -2 }} /> Ripetizione</span>
          <select className="select" value={t.repeatType} onChange={(e) => set('repeatType', e.target.value as Task['repeatType'])}>
            <option value="NEVER">Non si ripete</option><option value="DAILY">Ogni giorno</option><option value="WEEKLY">Ogni settimana</option>
            <option value="MONTHLY">Ogni mese</option><option value="CUSTOM">Giorni della settimana…</option>
          </select>
          {t.repeatType === 'CUSTOM' && (
            <div className="chips" style={{ marginTop: 6 }}>{WEEKDAYS.map((w, i) => {
              const on = t.repeatDays.includes(i + 1);
              return <button key={i} className={'chip' + (on ? ' active' : '')} onClick={() => set('repeatDays', on ? t.repeatDays.filter((x) => x !== i + 1) : [...t.repeatDays, i + 1].sort())}>{w}</button>;
            })}</div>
          )}
          {t.repeatType !== 'NEVER' && <label className="row small" style={{ marginTop: 6 }}>fino al <input className="input" type="date" style={{ width: 'auto', minHeight: 36 }} value={t.repeatUntil ?? ''} onChange={(e) => set('repeatUntil', e.target.value || null)} /></label>}
        </div>
        {t.date && t.time && (
          <div className="row wrap"><Switch checked={t.notificationEnabled} onChange={(v) => set('notificationEnabled', v)} /><span>Promemoria</span>
            {t.notificationEnabled && <select className="select" style={{ width: 'auto' }} value={t.notificationMinutesBefore} onChange={(e) => set('notificationMinutesBefore', Number(e.target.value))}>
              {REMINDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>}
          </div>
        )}
        <label className="field"><span>Note</span><textarea className="textarea" value={t.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} rows={3} /></label>
        <div className="row"><input type="checkbox" className="checkbox" checked={t.isCompleted} onChange={(e) => set('isCompleted', e.target.checked)} id="dn" /><label htmlFor="dn">Fatta</label></div>
      </div>
    </Modal>
  );
}

function QuickNotesView({ onBack }: { onBack: () => void }) {
  const ui = useUI();
  const notes = useLiveQuery(() => db.quickNotes.orderBy('createdAt').reverse().filter((n) => !n.convertedTaskId).toArray(), []) ?? [];
  const [text, setText] = useState('');
  const convMenu = useMenu();
  const add = async () => {
    if (!text.trim()) return;
    await db.quickNotes.add({ id: uid(), content: text.trim().slice(0, 1000), convertedTaskId: null, createdAt: new Date().toISOString() });
    setText('');
  };
  const convert = async (n: QuickNote, when: 'oggi' | 'domani' | 'nessuna') => {
    const date = when === 'oggi' ? todayISO() : when === 'domani' ? toISO(addDays(new Date(), 1)) : null;
    const id = await saveTask(blankTask({ title: n.content.slice(0, 200), date }));
    await db.quickNotes.update(n.id, { convertedTaskId: id });
    ui.toast('Diventata un’attività ✨');
  };
  const menuConvert = (e: React.MouseEvent, n: QuickNote) => convMenu.open(e, [
    { label: 'Per oggi', icon: <Sun size={16} />, onClick: () => convert(n, 'oggi') },
    { label: 'Per domani', icon: <CalendarDays size={16} />, onClick: () => convert(n, 'domani') },
    { label: 'Senza data', icon: <Inbox size={16} />, onClick: () => convert(n, 'nessuna') },
  ]);
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="icon-btn mobile-only" onClick={onBack} aria-label="Indietro"><ArrowLeft size={20} /></button>
        <div className="grow"><h2>Da ricordare</h2><div className="small muted">{voce.nienteNote()}</div></div>
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Devo ricordarmi di…" />
        <button className="btn btn-primary" type="submit"><Plus size={18} /></button>
      </form>
      <div style={{ marginTop: 14 }}>
        {notes.length === 0 && <Empty icon={<ListChecks size={48} color="var(--primary)" />} title="Niente da ricordare" text="Scrivi qui le cose al volo, senza decidere giorno o lista. Poi le trasformi in attività." />}
        {notes.map((n) => (
          <div key={n.id} className="todo">
            <StickyNote size={18} color="var(--warning)" />
            <div className="grow" style={{ padding: '6px 4px' }}>{n.content}</div>
            <button className="btn btn-sm btn-soft" onClick={(e) => menuConvert(e, n)} title="Trasforma in attività"><ArrowRightLeft size={14} />Attività</button>
            <button className="icon-btn sm danger" onClick={() => db.quickNotes.delete(n.id)} aria-label="Elimina"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      {convMenu.node}
    </div>
  );
}

export function ListEditor({ list, onClose, onCreated }: { list: TodoList; onClose: () => void; onCreated: (id: string) => void }) {
  const ui = useUI();
  const [l, setL] = useState(list);
  const isNew = !list.id;
  const kindInfo = LIST_KINDS.find((k) => k.id === l.kind);
  const save = async () => {
    if (!l.title.trim()) { ui.toast('Dai un nome alla lista', true); return; }
    const now = Date.now();
    const rec = { ...l, title: l.title.trim(), id: l.id || uid(), createdAt: l.createdAt || now, updatedAt: now };
    await db.lists.put(rec);
    onClose();
    if (isNew) onCreated(rec.id);
  };
  return (
    <Modal title={isNew ? 'Nuova lista' : 'Modifica lista'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>{isNew ? 'Crea' : 'Salva'}</button></>}>
      <div className="stack">
        <label className="field"><span>Nome</span><input className="input" autoFocus value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} placeholder="Es. Spesa, Film da vedere, Valigia" onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
        <div className="field"><span>Tipo</span>
          <div className="chips">{LIST_KINDS.map((k) => (
            <button key={k.id} className={'chip' + (l.kind === k.id ? ' active' : '')} onClick={() => setL({ ...l, kind: k.id, emoji: l.emoji === kindInfo?.emoji ? k.emoji : l.emoji, color: l.color === kindInfo?.color ? k.color : l.color })}>{k.emoji} {k.label}</button>
          ))}</div>
        </div>
        <div className="field"><span>Icona</span>
          <div className="chips">{EMOJIS.map((e) => <button key={e} className={'chip' + (l.emoji === e ? ' active' : '')} style={{ fontSize: '1.15rem', padding: '0 10px' }} onClick={() => setL({ ...l, emoji: e })}>{e}</button>)}</div>
        </div>
        <div className="field"><span>Colore</span><Swatches value={l.color} onChange={(c) => setL({ ...l, color: c })} /></div>
      </div>
    </Modal>
  );
}
