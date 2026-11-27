
import React, { useState, useEffect, useRef } from 'react';
import { Song, Setlist, SetlistTextNote, NotationMode, Group, SongItem, TextItem, SetlistItem, TiptapDoc } from '../types';
import { supabase } from '../lib/supabaseClient';
import {
  Plus,
  Minus,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Play,
  Edit2,
  X,
  Hash,
  Type,
  Heart,
  Copy,
  MoreVertical,
  GripVertical,
  FileDown
} from 'lucide-react';
import SongSheet from './SongSheet';
import SongEditor from './SongEditor';
import { SetlistDocumentEditor } from './setlist-document/SetlistDocumentEditor';
import { TEXT_COLORS, TEXT_SIZES } from '../constants/textNoteStyles';
import { buildInitialDocument } from '../utils/setlistDocument';
import { exportLayoutDocumentToPdf } from '../utils/setlistDocumentPdf';
import { exportSetlistListToPdf } from '../utils/setlistListPdf';
import { transpose as transposeChord } from '../utils/musicLogic';
import { KeyBadge } from './ui/Brand';
import { Segmented } from './ui/Segmented';
import { Modal } from './ui/Modal';
import { inputCls, labelCls, secondaryBtn } from './ui/styles';
import { DEFAULT_SETLIST_ICON, getSetlistIcon } from '../constants/setlistIcons';
import { SetlistIconPicker } from './SetlistIconPicker';

const FAVORITES_ID = 'virtual_favorites';

interface SetlistEditorProps {
  user: any;
  allSongs: Song[];
  groups: Group[];
  onBack: () => void;
  onSaveSong?: (song: Song, onSuccess?: () => void) => Promise<void>;
}

type SetlistWithCount = Setlist & { song_count?: number };

const generateId = () => `txt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtLong = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
const morceaux = (n: number) => `${n} morceau${n > 1 ? 'x' : ''}`;

const btnSm = 'inline-flex items-center justify-center gap-1.5 h-[38px] px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const iconBtn = 'inline-flex items-center justify-center w-8 h-8 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-ink dark:hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors';
const primarySm = 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors disabled:opacity-50';
const dangerBtn = 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors';

// ──────────────────────────────────────────────────────────────────────────
const SetlistEditor: React.FC<SetlistEditorProps> = ({ user, allSongs, groups, onBack, onSaveSong }) => {
  const [setlists, setSetlists] = useState<SetlistWithCount[]>([]);
  const [currentSetlist, setCurrentSetlist] = useState<Setlist | null>(null);
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);
  const [setlistItemsLoadedFor, setSetlistItemsLoadedFor] = useState<string | null>(null);

  // Index view
  const [indexFilter, setIndexFilter] = useState<'all' | 'personal' | 'group'>('all');
  const [indexQuery, setIndexQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [newSetlistMode, setNewSetlistMode] = useState<'list' | 'document'>('list');
  const [newIcon, setNewIcon] = useState<string>(DEFAULT_SETLIST_ICON);
  const [iconEditId, setIconEditId] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);

  // Detail view
  const [searchQuery, setSearchQuery] = useState('');
  const [librarySource, setLibrarySource] = useState<'all' | 'favorites' | 'group'>('all');
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  const libraryRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const jumpToLibrary = () => {
    libraryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Text block editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [editingTextColor, setEditingTextColor] = useState<string>('amber');
  const [editingTextSize, setEditingTextSize] = useState<'sm' | 'md' | 'lg'>('md');

  const handleAddTextNote = () => {
    setEditingTextId('new');
    setEditingTextValue('');
    setEditingTextColor('amber');
    setEditingTextSize('md');
  };

  const handleEditNote = (item: TextItem) => {
    setEditingTextId(item.id);
    setEditingTextValue(item.content);
    setEditingTextColor(item.color);
    setEditingTextSize(item.size);
  };

  const saveTextNote = () => {
    if (!editingTextValue.trim() || !currentSetlist || currentSetlist.id === FAVORITES_ID) {
      setEditingTextId(null);
      return;
    }

    if (editingTextId === 'new') {
      const newNote: TextItem = {
        type: 'text',
        id: generateId(),
        content: editingTextValue.trim(),
        color: editingTextColor,
        size: editingTextSize
      };
      const newItems = [...setlistItems, newNote];
      setSetlistItems(newItems);
      persistTextNotes(newItems);
    } else {
      const newItems = setlistItems.map(item =>
        item.id === editingTextId && item.type === 'text'
          ? { ...item, content: editingTextValue.trim(), color: editingTextColor, size: editingTextSize }
          : item
      );
      setSetlistItems(newItems);
      persistTextNotes(newItems);
    }
    setEditingTextId(null);
  };

  const [notationMode, setNotationMode] = useState<NotationMode>(NotationMode.LETTERS);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [setlistToDelete, setSetlistToDelete] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [setlistToDuplicate, setSetlistToDuplicate] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [performanceIndex, setPerformanceIndex] = useState(0);
  const [performanceEditingSong, setPerformanceEditingSong] = useState<Song | null>(null);
  const [pendingPerformance, setPendingPerformance] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfTitle, setPdfTitle] = useState('');

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const isVirtual = currentSetlist?.id === FAVORITES_ID;

  useEffect(() => { fetchSetlists(); }, [user]);

  useEffect(() => {
    if (currentSetlist) {
      setEditTitleValue(currentSetlist.title);
      setPdfTitle(`${currentSetlist.title} - ${new Date().toLocaleDateString('fr-FR')}`);
    }
  }, [currentSetlist]);

  // Launched from the index's "Défilement" button: start once the items are loaded.
  useEffect(() => {
    if (pendingPerformance && currentSetlist && setlistItemsLoadedFor === currentSetlist.id) {
      setPendingPerformance(false);
      if (setlistItems.length > 0) { setPerformanceIndex(0); setPerformanceMode(true); }
    }
  }, [pendingPerformance, setlistItemsLoadedFor, currentSetlist, setlistItems.length]);

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchSetlists = async () => {
    setLoading(true);
    let { data, error } = await supabase
      .from('setlists')
      .select('*, setlist_songs(count)')
      .order('created_at', { ascending: false });
    if (error) {
      // Fallback if the embedded count is not available on this schema.
      ({ data, error } = await supabase.from('setlists').select('*').order('created_at', { ascending: false }));
    }
    if (!error && data) {
      setSetlists(data.map((s: any) => {
        const { setlist_songs, ...rest } = s;
        return { ...rest, song_count: setlist_songs?.[0]?.count };
      }));
    }
    setLoading(false);
  };

  const fetchSetlistItems = async (setlistId: string) => {
    if (setlistId === FAVORITES_ID) {
      const favorites = allSongs
        .filter(s => s.is_favorite)
        .map(song => ({
          type: 'song' as const,
          id: `fav_${song.id}`,
          song: song,
          transpose: 0
        }));
      setSetlistItems(favorites);
      setSetlistItemsLoadedFor(setlistId);
      return;
    }

    const [{ data, error }, { data: setlistRow, error: setlistError }] = await Promise.all([
      supabase
        .from('setlist_songs')
        .select('*')
        .eq('setlist_id', setlistId)
        .order('position', { ascending: true }),
      supabase
        .from('setlists')
        .select('text_notes')
        .eq('id', setlistId)
        .single()
    ]);

    if (!error && data && !setlistError) {
      const songItems = data.map((item: any) => {
        const song = allSongs.find(s => s.id === item.song_id);
        if (!song) return null;
        return { type: 'song' as const, id: item.id, song, transpose: item.transpose || 0, position: item.position };
      }).filter(Boolean) as (SongItem & { position: number })[];

      const textItems = ((setlistRow?.text_notes || []) as SetlistTextNote[]).map(note => ({
        type: 'text' as const,
        id: note.id,
        content: note.content,
        color: note.color,
        size: note.size,
        position: note.position,
      }));

      const merged = [...songItems, ...textItems]
        .sort((a, b) => a.position - b.position)
        .map(({ position, ...rest }) => rest as SetlistItem);

      setSetlistItems(merged);
    }
    setSetlistItemsLoadedFor(setlistId);
  };

  // Keep the song counts shown on the index in sync with edits made in the detail view.
  useEffect(() => {
    if (!currentSetlist || isVirtual || setlistItemsLoadedFor !== currentSetlist.id) return;
    const count = setlistItems.filter(i => i.type === 'song').length;
    setSetlists(prev => prev.map(s => s.id === currentSetlist.id && s.song_count !== count ? { ...s, song_count: count } : s));
  }, [setlistItems, setlistItemsLoadedFor, currentSetlist?.id]);

  // ── Text notes persistence ───────────────────────────────────────────────
  const persistTextNotes = async (items: SetlistItem[]) => {
    if (!currentSetlist) return;
    const textNotes: SetlistTextNote[] = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.type === 'text')
      .map(({ item, index }) => {
        const t = item as TextItem;
        return { id: t.id, content: t.content, color: t.color, size: t.size, position: index };
      });
    await supabase.from('setlists').update({ text_notes: textNotes }).eq('id', currentSetlist.id);
    setCurrentSetlist({ ...currentSetlist, text_notes: textNotes });
  };

  // ── Setlist CRUD ─────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setNewTitle('');
    setSelectedGroupId('');
    setNewSetlistMode('list');
    setNewIcon(DEFAULT_SETLIST_ICON);
    setShowCreateModal(true);
  };

  const handleCreateSetlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const payload: any = { title: newTitle.trim(), user_id: user.id, mode: newSetlistMode, icon: newIcon };
    if (selectedGroupId) payload.group_id = selectedGroupId;
    let { data, error } = await supabase.from('setlists').insert([payload]).select().single();
    if (error && /icon/.test(error.message)) {
      // Colonne `icon` pas encore migrée : on crée la setlist sans icône.
      const { icon: _icon, ...rest } = payload;
      ({ data, error } = await supabase.from('setlists').insert([rest]).select().single());
    }
    if (!error && data) {
      setSetlists([{ ...data, song_count: 0 }, ...setlists]);
      setShowCreateModal(false);
      handleSelectSetlist(data);
    }
  };

  const handleUpdateSetlistIcon = async (id: string, icon: string) => {
    setIconError(null);
    const { error } = await supabase.from('setlists').update({ icon }).eq('id', id);
    if (error) {
      setIconError(/icon/.test(error.message)
        ? 'La colonne « icon » n\'existe pas encore en base : appliquez la migration.'
        : 'Impossible d\'enregistrer l\'icône.');
      return;
    }
    setSetlists(prev => prev.map(s => s.id === id ? { ...s, icon } : s));
    setCurrentSetlist(prev => prev && prev.id === id ? { ...prev, icon } : prev);
    setIconEditId(null);
  };

  const handleUpdateSetlistTitle = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentSetlist || currentSetlist.id === FAVORITES_ID || !editTitleValue.trim()) return;

    const title = editTitleValue.trim();
    const { error } = await supabase
      .from('setlists')
      .update({ title })
      .eq('id', currentSetlist.id);

    if (!error) {
      setCurrentSetlist({ ...currentSetlist, title });
      setSetlists(setlists.map(s => s.id === currentSetlist.id ? { ...s, title } : s));
      setShowRenameModal(false);
    }
  };

  const confirmDuplicateSetlist = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (id === FAVORITES_ID) return;
    setSetlistToDuplicate(id);
    setShowDuplicateModal(true);
  };

  const executeDuplicateSetlist = async () => {
    if (!setlistToDuplicate) return;
    const original = setlists.find(s => s.id === setlistToDuplicate);
    if (!original) {
      setShowDuplicateModal(false);
      setSetlistToDuplicate(null);
      return;
    }

    const { data: newSetlist, error } = await supabase
      .from('setlists')
      .insert([{
        title: `${original.title} (copie)`,
        user_id: user.id,
        group_id: original.group_id ?? null,
        ...(original.icon ? { icon: original.icon } : {}),
        mode: original.mode,
        text_notes: original.mode === 'list' ? (original.text_notes || []) : [],
        layout_document: null, // patched below once setlist_songs are duplicated, if mode === 'document'
      }])
      .select()
      .single();

    if (!error && newSetlist) {
      const { data: originalSongs } = await supabase
        .from('setlist_songs')
        .select('id, song_id, position, transpose')
        .eq('setlist_id', original.id)
        .order('position', { ascending: true });

      let idMap = new Map<string, string>();
      if (originalSongs && originalSongs.length > 0) {
        const { data: insertedSongs } = await supabase
          .from('setlist_songs')
          .insert(
            originalSongs.map(s => ({
              setlist_id: newSetlist.id,
              song_id: s.song_id,
              position: s.position,
              transpose: s.transpose,
            }))
          )
          .select('id, song_id, position, transpose')
          .order('position', { ascending: true });

        idMap = new Map(
          originalSongs.map((s, index) => [s.id, insertedSongs?.[index]?.id]).filter(([, v]) => v) as [string, string][]
        );
      }

      if (original.mode === 'document' && original.layout_document) {
        const remapped: TiptapDoc = {
          ...original.layout_document,
          content: original.layout_document.content.map((node) =>
            node.type === 'songBlock'
              ? { ...node, attrs: { ...node.attrs, setlistSongId: idMap.get(node.attrs?.setlistSongId as string) ?? node.attrs?.setlistSongId } }
              : node
          ),
        };
        await supabase.from('setlists').update({ layout_document: remapped }).eq('id', newSetlist.id);
        newSetlist.layout_document = remapped;
      }

      setSetlists([{ ...newSetlist, song_count: originalSongs?.length ?? 0 }, ...setlists]);
      handleSelectSetlist(newSetlist);
    }

    setShowDuplicateModal(false);
    setSetlistToDuplicate(null);
  };

  const confirmDeleteSetlist = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (id === FAVORITES_ID) return;
    setSetlistToDelete(id);
    setShowDeleteModal(true);
  };

  const executeDeleteSetlist = async () => {
    if (!setlistToDelete) return;

    await supabase.from('setlists').delete().eq('id', setlistToDelete);
    setSetlists(setlists.filter(s => s.id !== setlistToDelete));
    if (currentSetlist?.id === setlistToDelete) setCurrentSetlist(null);
    setShowDeleteModal(false);
    setSetlistToDelete(null);
  };

  const handleSelectSetlist = (setlist: Setlist, play = false) => {
    setCurrentSetlist(setlist);
    setSetlistItemsLoadedFor(null);
    setSearchQuery('');
    setLibrarySource('all');
    fetchSetlistItems(setlist.id);
    setPerformanceMode(false);
    setPendingPerformance(play);
  };

  useEffect(() => {
    if (!showActionsMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionsMenu]);

  // ── Song management ──────────────────────────────────────────────────────
  const addSongToSetlist = async (song: Song) => {
    if (!currentSetlist || currentSetlist.id === FAVORITES_ID) return;

    if (setlistItems.some(item => item.type === 'song' && item.song.id === song.id)) return;
    const { data, error } = await supabase.from('setlist_songs')
      .insert({ setlist_id: currentSetlist.id, song_id: song.id, position: setlistItems.length, transpose: 0 })
      .select().single();
    if (!error && data) {
      const newItems = [...setlistItems, { type: 'song' as const, id: data.id, song, transpose: 0 }];
      setSetlistItems(newItems);
    }
  };

  const removeItemFromSetlist = async (itemId: string) => {
    if (currentSetlist?.id === FAVORITES_ID) return;

    const item = setlistItems.find(i => i.id === itemId);
    const newItems = setlistItems.filter(s => s.id !== itemId);
    setSetlistItems(newItems);

    if (item?.type === 'song') {
      await supabase.from('setlist_songs').delete().eq('id', itemId);
    } else if (item?.type === 'text') {
      await persistTextNotes(newItems);
    }
  };

  const updateItemTranspose = async (itemId: string, newTranspose: number) => {
    setSetlistItems(items => items.map(item =>
      item.id === itemId ? { ...item, transpose: newTranspose } : item
    ));

    if (currentSetlist?.id !== FAVORITES_ID) {
      await supabase
        .from('setlist_songs')
        .update({ transpose: newTranspose })
        .eq('id', itemId);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, position: number) => {
    if (isVirtual) return;
    dragItem.current = position;
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnter = (_e: React.DragEvent<HTMLLIElement>, position: number) => {
    if (isVirtual) return;
    dragOverItem.current = position;
  };

  const updateAllPositions = async (items: SetlistItem[]) => {
    if (!currentSetlist) return;
    const songUpdates = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.type === 'song')
      .map(({ item, index }) => {
        const songItem = item as SongItem;
        return {
          id: songItem.id,
          setlist_id: currentSetlist.id,
          song_id: songItem.song.id,
          position: index,
          transpose: songItem.transpose
        };
      });

    await persistTextNotes(items);
    if (songUpdates.length > 0) {
      await supabase.from('setlist_songs').upsert(songUpdates);
    }
  };

  const handleDocumentSongOrderChange = async (orderedSetlistSongIds: string[]) => {
    const songItemsById = new Map(
      setlistItems.filter((item): item is SongItem => item.type === 'song').map((item) => [item.id, item])
    );
    const textItems = setlistItems.filter((item) => item.type === 'text');
    const reorderedSongs = orderedSetlistSongIds
      .map((id) => songItemsById.get(id))
      .filter((item): item is SongItem => item !== undefined);

    const newItems: SetlistItem[] = [...reorderedSongs, ...textItems];
    setSetlistItems(newItems);
    await updateAllPositions(newItems);
  };

  const handleDocumentSongInserted = (newItem: SongItem) => {
    setSetlistItems((items) => [...items, newItem]);
  };

  const handleLayoutDocumentChange = (doc: TiptapDoc) => {
    setCurrentSetlist((prev) => (prev ? { ...prev, layout_document: doc } : prev));
  };

  const handleDragEnd = async (e: React.DragEvent<HTMLLIElement>) => {
    if (isVirtual) return;
    e.currentTarget.classList.remove('opacity-50');
    if (!currentSetlist || dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const newItems = [...setlistItems];
    const draggedItem = newItems[dragItem.current];
    newItems.splice(dragItem.current, 1);
    newItems.splice(dragOverItem.current, 0, draggedItem);

    dragItem.current = null;
    dragOverItem.current = null;
    setSetlistItems(newItems);
    await updateAllPositions(newItems);
  };

  const moveItem = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= setlistItems.length || !currentSetlist || isVirtual) return;
    const newItems = [...setlistItems];
    const item = newItems[fromIndex];
    newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, item);
    setSetlistItems(newItems);
    await updateAllPositions(newItems);
  };

  const startPerformance = () => {
    if (setlistItems.length > 0) { setPerformanceIndex(0); setPerformanceMode(true); }
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const exportToPDF = () => {
    if (!currentSetlist || setlistItems.length === 0) return;
    setShowPdfModal(false);

    const doc = currentSetlist.mode === 'document'
      ? exportLayoutDocumentToPdf(currentSetlist.layout_document ?? buildInitialDocument(setlistItems), setlistItems, pdfTitle)
      : exportSetlistListToPdf(setlistItems, pdfTitle);
    doc.save(`${pdfTitle}.pdf`);
  };

  const favoriteSetlist: Setlist = {
    id: FAVORITES_ID,
    user_id: user.id,
    title: 'Mes favoris',
    created_at: new Date().toISOString(),
    mode: 'list'
  };
  const favoriteCount = allSongs.filter(s => s.is_favorite).length;
  const groupName = (id?: string | null) => (id ? groups.find(g => g.id === id)?.name : undefined);

  // ── Shared dialogs ────────────────────────────────────────────────────────
  const iconEditSetlist = iconEditId ? setlists.find(s => s.id === iconEditId) : undefined;
  const dialogs = (
    <>
      {iconEditSetlist && (
        <Modal title="Changer l'icône" onClose={() => setIconEditId(null)} width="md">
          <SetlistIconPicker
            value={iconEditSetlist.icon || DEFAULT_SETLIST_ICON}
            onChange={(name) => handleUpdateSetlistIcon(iconEditSetlist.id, name)}
          />
          {iconError && <p role="alert" className="m-0 px-3 py-2.5 rounded-md bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300 text-sm">{iconError}</p>}
        </Modal>
      )}
      {showDeleteModal && (
        <Modal
          title="Supprimer la setlist ?"
          onClose={() => setShowDeleteModal(false)}
          footer={<>
            <button type="button" onClick={() => setShowDeleteModal(false)} className={secondaryBtn + ' h-11'}>Annuler</button>
            <button type="button" onClick={executeDeleteSetlist} className={dangerBtn}>Supprimer</button>
          </>}
        >
          <p className="m-0 text-slate-600 dark:text-slate-400">Les chansons restent dans la bibliothèque. Cette action est définitive.</p>
        </Modal>
      )}

      {showDuplicateModal && (
        <Modal
          title="Dupliquer la setlist ?"
          onClose={() => setShowDuplicateModal(false)}
          footer={<>
            <button type="button" onClick={() => setShowDuplicateModal(false)} className={secondaryBtn + ' h-11'}>Annuler</button>
            <button type="button" onClick={executeDuplicateSetlist} className={primarySm}>Dupliquer</button>
          </>}
        >
          <p className="m-0 text-slate-600 dark:text-slate-400">Une copie sera créée avec tous ses morceaux, leurs tons et ses notes.</p>
        </Modal>
      )}
    </>
  );

  // ── Performance mode ──────────────────────────────────────────────────────
  if (performanceMode && currentSetlist) {
    const currentItem = setlistItems[performanceIndex];

    if (performanceEditingSong && onSaveSong) {
      const existingTags = [...new Set(allSongs.flatMap(s => s.tags || []))];
      return (
        <div className="fixed inset-0 bg-slate-100 dark:bg-slate-950 z-50 flex flex-col">
          <div className="h-16 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 shrink-0">
            <button onClick={() => setPerformanceEditingSong(null)} className="text-slate-600 dark:text-slate-400 hover:text-ink dark:hover:text-white shrink-0 flex items-center gap-2">
              <ChevronLeft size={24} />
              <span className="text-sm">Retour au mode scène</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SongEditor
              initialSong={performanceEditingSong}
              groups={groups}
              existingTags={existingTags}
              onSave={(song) => {
                onSaveSong(song, () => {
                  setSetlistItems(items =>
                    items.map(item =>
                      item.type === 'song' && item.song.id === song.id
                        ? { ...item, song }
                        : item
                    )
                  );
                  setPerformanceEditingSong(null);
                });
              }}
              onCancel={() => setPerformanceEditingSong(null)}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-slate-100 dark:bg-slate-950 z-50 flex flex-col">
        <div className="h-16 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button onClick={() => setPerformanceMode(false)} aria-label="Quitter le mode scène" className="text-slate-600 dark:text-slate-400 hover:text-ink dark:hover:text-white shrink-0"><X size={24} /></button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-ink dark:text-white leading-tight truncate">{currentSetlist.title}</h2>
              <div className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">{performanceIndex + 1} / {setlistItems.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentItem.type === 'song' && onSaveSong && (
              <button
                onClick={() => setPerformanceEditingSong(currentItem.song)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-ink dark:hover:text-white transition-colors"
              >
                <Edit2 size={18} />
                <span className="hidden sm:inline">Modifier</span>
              </button>
            )}
            <button
              onClick={() => setNotationMode(m => m === NotationMode.LETTERS ? NotationMode.DEGREES : NotationMode.LETTERS)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-ink dark:hover:text-white transition-colors"
            >
              {notationMode === NotationMode.LETTERS ? <Hash size={18} /> : <Type size={18} />}
              <span className="hidden sm:inline">{notationMode === NotationMode.LETTERS ? 'Lettres' : 'Degrés'}</span>
            </button>
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800 mx-2" />
            <button disabled={performanceIndex === 0} onClick={() => setPerformanceIndex(p => p - 1)} aria-label="Morceau précédent"
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-ink dark:text-white disabled:opacity-30 hover:bg-cyan-600 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div className="text-xl font-mono text-cyan-600 dark:text-cyan-400 font-bold w-8 text-center">{performanceIndex + 1}</div>
            <button disabled={performanceIndex === setlistItems.length - 1} onClick={() => setPerformanceIndex(p => p + 1)} aria-label="Morceau suivant"
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-ink dark:text-white disabled:opacity-30 hover:bg-cyan-600 transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-slate-100 dark:bg-slate-950">
          <div className="max-w-4xl mx-auto">
            {currentItem.type === 'song' ? (
              <SongSheet
                song={currentItem.song}
                transposeSemitones={currentItem.transpose}
                notationMode={notationMode}
              />
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 min-h-[400px] flex items-center justify-center text-center">
                <div className="max-w-2xl">
                  <div className={`text-2xl font-bold mb-4 ${TEXT_SIZES[currentItem.size]?.uiClass || ''}`} style={{ color: TEXT_COLORS[currentItem.color]?.hex || '#fff' }}>
                    {currentItem.content}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Index: toutes les setlists ────────────────────────────────────────────
  if (!currentSetlist) {
    const q = indexQuery.trim().toLowerCase();
    const visible = setlists.filter(s => {
      if (indexFilter === 'personal' && s.group_id) return false;
      if (indexFilter === 'group' && !s.group_id) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q) || (groupName(s.group_id) || '').toLowerCase().includes(q);
    });
    const showFavorites = indexFilter !== 'group' && (!q || 'mes favoris'.includes(q));
    const groupCount = setlists.filter(s => s.group_id).length;

    return (
      <div className="max-w-[1080px] mx-auto flex flex-col gap-6">
        {dialogs}

        {showCreateModal && (
          <Modal title="Nouvelle setlist" onClose={() => setShowCreateModal(false)} width="md">
            <form onSubmit={handleCreateSetlist} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Nom</span>
                <input autoFocus type="text" placeholder="Répétition jeudi" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={inputCls} />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className={labelCls} id="lbl-mode">Présentation</span>
                <Segmented
                  label="Présentation"
                  value={newSetlistMode}
                  onChange={setNewSetlistMode}
                  options={[{ value: 'list', label: 'Liste' }, { value: 'document', label: 'Document' }]}
                  className="self-start"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {newSetlistMode === 'list' ? 'Les morceaux et les notes s\'enchaînent dans l\'ordre.' : 'Mise en page libre, avec texte riche entre les morceaux.'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={labelCls} id="lbl-icon">Icône</span>
                <SetlistIconPicker value={newIcon} onChange={setNewIcon} labelledBy="lbl-icon" />
              </div>
              {groups.length > 0 && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Partager avec</span>
                  <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className={inputCls}>
                    <option value="">Personne (setlist personnelle)</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowCreateModal(false)} className={secondaryBtn + ' h-11'}>Annuler</button>
                <button type="submit" disabled={!newTitle.trim()} className={primarySm}>Créer</button>
              </div>
            </form>
          </Modal>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 font-display font-extrabold text-4xl leading-tight" style={{ letterSpacing: '-0.025em' }}>Setlists</h1>
            <p className="mt-1.5 mb-0 text-slate-600 dark:text-slate-400">
              {loading ? 'Chargement…' : setlists.length === 0 ? 'Préparez l\'ordre de vos concerts et répétitions.' : `${plural(setlists.length, 'setlist')}${groupCount ? `, dont ${groupCount} de groupe` : ''}.`}
            </p>
          </div>
          <button type="button" onClick={openCreateModal} className={primarySm}>
            <Plus size={18} /> Nouvelle setlist
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Segmented
            label="Filtrer"
            value={indexFilter}
            onChange={setIndexFilter}
            options={[
              { value: 'all', label: 'Toutes' },
              { value: 'personal', label: 'Personnelles' },
              { value: 'group', label: 'Groupes' }
            ]}
          />
          <label className="flex-[1_1_240px] flex items-center gap-2.5 h-10 px-3 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:border-cyan-600 dark:focus-within:border-cyan-400">
            <Search size={16} className="text-slate-500 shrink-0" aria-hidden="true" />
            <input
              type="search"
              aria-label="Filtrer les setlists"
              placeholder="Filtrer par nom ou groupe"
              value={indexQuery}
              onChange={(e) => setIndexQuery(e.target.value)}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none placeholder:text-slate-500"
            />
          </label>
        </div>

        <ul className="list-none m-0 p-0 border-t-[1.5px] border-ink dark:border-slate-300">
          {showFavorites && (
            <li className="flex flex-wrap items-center gap-x-5 gap-y-3 px-1 py-4 border-b border-slate-200 dark:border-slate-800">
              <span aria-hidden="true" className="w-16 h-[58px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-red-50 dark:bg-red-900 text-red-500 dark:text-red-400">
                <Heart size={22} fill="currentColor" />
              </span>
              <button type="button" onClick={() => handleSelectSetlist(favoriteSetlist)} className="flex-[1_1_260px] min-w-0 flex flex-col gap-0.5 text-left">
                <span className="font-display font-bold text-[21px] leading-tight hover:underline underline-offset-[3px] decoration-1">Mes favoris</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">Liste dynamique · {plural(favoriteCount, 'chanson')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectSetlist(favoriteSetlist, true)}
                disabled={favoriteCount === 0}
                aria-label="Défilement, ouvrir Mes favoris en mode scène"
                title="Défilement"
                className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-red-500 text-red-600 dark:border-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 disabled:opacity-40"
              >
                <Play size={12} fill="currentColor" />
              </button>
            </li>
          )}

          {visible.map(s => {
            const SetlistIcon = getSetlistIcon(s.icon);
            const meta = [
              `Créée le ${fmtShort(s.created_at)}`,
              groupName(s.group_id) || 'Personnelle',
              s.song_count !== undefined ? morceaux(s.song_count) : null,
              s.mode === 'document' ? 'Document' : null
            ].filter(Boolean).join(' · ');
            return (
              <li key={s.id} className="group flex flex-wrap items-center gap-x-5 gap-y-3 px-1 py-4 border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIconError(null); setIconEditId(s.id); }}
                  aria-label={`Changer l'icône de ${s.title}`}
                  title="Changer l'icône"
                  className="w-16 h-[58px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 hover:border-cyan-600 dark:hover:border-cyan-400 transition-colors"
                >
                  <SetlistIcon size={24} />
                </button>
                <button type="button" onClick={() => handleSelectSetlist(s)} className="flex-[1_1_260px] min-w-0 flex flex-col gap-0.5 text-left">
                  <span className="font-display font-bold text-[21px] leading-tight hover:underline underline-offset-[3px] decoration-1 break-words">{s.title}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{meta}</span>
                </button>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={(e) => confirmDuplicateSetlist(s.id, e)} aria-label={`Dupliquer ${s.title}`} title="Dupliquer" className={iconBtn + ' w-10 h-10'}>
                    <Copy size={17} />
                  </button>
                  <button type="button" onClick={(e) => confirmDeleteSetlist(s.id, e)} aria-label={`Supprimer ${s.title}`} title="Supprimer" className={iconBtn + ' w-10 h-10 hover:text-red-600 dark:hover:text-red-400'}>
                    <Trash2 size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSetlist(s, true)}
                    disabled={s.song_count === 0}
                    aria-label={`Défilement, ouvrir ${s.title} en mode scène`}
                    title="Défilement"
                    className="ml-1 inline-flex items-center justify-center w-10 h-10 rounded-md border border-red-500 text-red-600 dark:border-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 disabled:opacity-40"
                  >
                    <Play size={12} fill="currentColor" />
                  </button>
                </span>
              </li>
            );
          })}

          {!loading && visible.length === 0 && (
            <li className="py-10 px-1 flex flex-col items-start gap-3">
              {setlists.length === 0 ? (
                <>
                  <h2 className="m-0 font-display font-extrabold text-[28px] leading-tight" style={{ letterSpacing: '-0.02em' }}>Aucune setlist pour l'instant</h2>
                  <p className="m-0 text-slate-600 dark:text-slate-400">Une setlist, c'est l'ordre de passage d'un concert ou d'une répétition. Vous pourrez la jouer en mode scène.</p>
                  <button type="button" onClick={openCreateModal} className={primarySm}><Plus size={18} /> Créer une setlist</button>
                </>
              ) : (
                <>
                  <h2 className="m-0 font-display font-bold text-[21px]">Aucune setlist ne correspond</h2>
                  <button type="button" onClick={() => { setIndexQuery(''); setIndexFilter('all'); }} className={btnSm}>Effacer les filtres</button>
                </>
              )}
            </li>
          )}
        </ul>
      </div>
    );
  }

  // ── Detail ────────────────────────────────────────────────────────────────
  const songCount = setlistItems.filter(i => i.type === 'song').length;
  const detailMeta = isVirtual
    ? `Liste dynamique · ${plural(songCount, 'chanson')}`
    : [
        `Créée le ${fmtLong(currentSetlist.created_at)}`,
        groupName(currentSetlist.group_id) || 'Personnelle',
        morceaux(songCount)
      ].join(' · ');

  const inSetlist = new Set(setlistItems.filter((i): i is SongItem => i.type === 'song').map(i => i.song.id));
  const lq = searchQuery.trim().toLowerCase();
  const librarySongs = allSongs
    .filter(s => {
      if (librarySource === 'favorites' && !s.is_favorite) return false;
      if (librarySource === 'group' && s.shared_with_group_id !== currentSetlist.group_id) return false;
      if (!lq) return true;
      return s.title.toLowerCase().includes(lq) || (s.artist || '').toLowerCase().includes(lq);
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    .slice(0, 40);

  let songNumber = 0;

  return (
    <div className="flex flex-col gap-5">
      {dialogs}

      {showRenameModal && (
        <Modal title="Renommer la setlist" onClose={() => setShowRenameModal(false)}>
          <form onSubmit={handleUpdateSetlistTitle} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Nom</span>
              <input autoFocus type="text" value={editTitleValue} onChange={(e) => setEditTitleValue(e.target.value)} className={inputCls} />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowRenameModal(false)} className={secondaryBtn + ' h-11'}>Annuler</button>
              <button type="submit" disabled={!editTitleValue.trim()} className={primarySm}>Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}

      {editingTextId !== null && (
        <Modal
          title={editingTextId === 'new' ? 'Ajouter une note' : 'Modifier la note'}
          onClose={() => setEditingTextId(null)}
          width="md"
          footer={<>
            <button type="button" onClick={() => setEditingTextId(null)} className={secondaryBtn + ' h-11'}>Annuler</button>
            <button type="button" onClick={saveTextNote} disabled={!editingTextValue.trim()} className={primarySm}>Enregistrer</button>
          </>}
        >
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Texte</span>
            <textarea
              autoFocus
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              placeholder="Pause, Théo passe à la mandoline"
              className={inputCls + ' h-24 py-2 resize-none'}
            />
          </label>
          <div className="flex gap-4">
            <label className="flex-1 flex flex-col gap-1.5">
              <span className={labelCls}>Taille (PDF)</span>
              <select value={editingTextSize} onChange={(e) => setEditingTextSize(e.target.value as any)} className={inputCls}>
                {Object.entries(TEXT_SIZES).map(([key, size]) => (
                  <option key={key} value={key}>{size.description}</option>
                ))}
              </select>
            </label>
            <label className="flex-1 flex flex-col gap-1.5">
              <span className={labelCls}>Couleur (PDF)</span>
              <select value={editingTextColor} onChange={(e) => setEditingTextColor(e.target.value)} className={inputCls}>
                {Object.entries(TEXT_COLORS).map(([key, color]) => (
                  <option key={key} value={key}>{color.label}</option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      )}

      {showPdfModal && (
        <Modal
          title="Exporter en PDF"
          onClose={() => setShowPdfModal(false)}
          footer={<>
            <button type="button" onClick={() => setShowPdfModal(false)} className={secondaryBtn + ' h-11'}>Annuler</button>
            <button type="button" onClick={exportToPDF} className={primarySm}><FileDown size={16} /> Exporter</button>
          </>}
        >
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Titre du document</span>
            <input type="text" value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} className={inputCls} />
          </label>
          <p className="m-0 text-sm text-slate-600 dark:text-slate-400">
            Les chansons et les notes s'enchaînent en continu. Une chanson qui ne tient pas sur la page commence sur la suivante.
          </p>
        </Modal>
      )}

      <nav aria-label="Fil d'Ariane" className="text-sm text-slate-500 dark:text-slate-400">
        <button type="button" onClick={() => setCurrentSetlist(null)} className="text-slate-600 dark:text-slate-400 underline underline-offset-[3px] decoration-1 hover:text-ink dark:hover:text-slate-100">Setlists</button>
        <span aria-hidden="true"> / </span>
        <span className="text-ink dark:text-slate-100 font-semibold">{currentSetlist.title}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b-[1.5px] border-ink dark:border-slate-300">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="m-0 font-display font-extrabold text-3xl md:text-4xl leading-[1.05] flex items-center gap-3 break-words" style={{ letterSpacing: '-0.025em' }}>
            {isVirtual && <Heart size={28} className="text-red-500 dark:text-red-400 shrink-0" fill="currentColor" aria-hidden="true" />}
            {currentSetlist.title}
          </h1>
          <p className="m-0 text-slate-600 dark:text-slate-400 first-letter:uppercase">{detailMeta}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Segmented
            label="Notation"
            value={notationMode}
            onChange={setNotationMode}
            options={[{ value: NotationMode.LETTERS, label: 'Lettres' }, { value: NotationMode.DEGREES, label: 'Degrés' }]}
          />
          {!isVirtual && (
            <button type="button" onClick={() => confirmDuplicateSetlist(currentSetlist.id)} className={btnSm}>Dupliquer</button>
          )}
          <button type="button" onClick={() => setShowPdfModal(true)} disabled={setlistItems.length === 0} className={btnSm}>Export PDF</button>
          {!isVirtual && (
            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setShowActionsMenu(v => !v)}
                aria-label="Autres actions"
                aria-expanded={showActionsMenu}
                className={btnSm + ' w-[38px] px-0'}
              >
                <MoreVertical size={18} />
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 mt-1.5 w-48 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xl z-40">
                  <button
                    type="button"
                    onClick={() => { setShowActionsMenu(false); setShowRenameModal(true); }}
                    className="w-full flex items-center gap-2.5 px-3 h-10 text-sm font-semibold text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit2 size={15} /> Renommer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowActionsMenu(false); confirmDeleteSetlist(currentSetlist.id); }}
                    className="w-full flex items-center gap-2.5 px-3 h-10 text-sm font-semibold text-left text-red-700 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Trash2 size={15} /> Supprimer
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={startPerformance}
            disabled={setlistItems.length === 0}
            aria-label="Défilement, ouvrir le mode scène"
            title="Défilement"
            className="inline-flex items-center justify-center gap-2 h-[38px] px-4 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={12} fill="currentColor" /> <span className="hidden sm:inline">Défilement</span>
          </button>
        </div>
      </header>

      {currentSetlist.mode === 'list' || isVirtual ? (
        <div className="flex flex-wrap items-start gap-6 lg:gap-8">
          <section aria-label="Ordre de passage" className="flex-[999_1_520px] min-w-0 flex flex-col gap-4">
            {!isVirtual && (
              <button type="button" onClick={jumpToLibrary} className={btnSm + ' self-start lg:hidden'}>
                <Plus size={16} /> Ajouter une chanson
              </button>
            )}

            <ol className="list-none m-0 p-0 flex flex-col">
              {setlistItemsLoadedFor !== currentSetlist.id && (
                <li className="py-10 text-slate-500 text-sm">Chargement…</li>
              )}

              {setlistItemsLoadedFor === currentSetlist.id && setlistItems.length === 0 && (
                isVirtual ? (
                  <li className="py-8 text-slate-600 dark:text-slate-400">Aucune chanson en favori pour l'instant. Ajoutez-en depuis la fiche d'une chanson.</li>
                ) : (
                  <>
                    <li className="flex items-center gap-3.5 min-h-[52px] border-b border-dashed border-slate-400 text-slate-500">
                      <span className="w-7 text-right font-mono font-bold">1</span>
                      <span className="hidden lg:inline">Ajoutez une chanson depuis la bibliothèque, à droite</span>
                      <span className="lg:hidden">Ajoutez une chanson depuis la bibliothèque</span>
                    </li>
                    <li className="flex items-center gap-3.5 min-h-[52px] border-b border-dashed border-slate-400 text-slate-400">
                      <span className="w-7 text-right font-mono font-bold">2</span>
                    </li>
                  </>
                )
              )}

              {setlistItemsLoadedFor === currentSetlist.id && setlistItems.map((item, index) => {
                const reorder = !isVirtual && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <button type="button" onClick={() => moveItem(index, index - 1)} disabled={index === 0} aria-label="Monter" className={iconBtn}><ChevronUp size={18} /></button>
                    <button type="button" onClick={() => moveItem(index, index + 1)} disabled={index === setlistItems.length - 1} aria-label="Descendre" className={iconBtn}><ChevronDown size={18} /></button>
                    <button type="button" onClick={() => removeItemFromSetlist(item.id)} aria-label="Retirer de la setlist" className={iconBtn + ' hover:text-red-600 dark:hover:text-red-400'}><X size={18} /></button>
                  </span>
                );

                if (item.type === 'text') {
                  return (
                    <li
                      key={item.id}
                      draggable={!isVirtual}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className="border-b border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3.5 gap-y-1 min-h-[44px] py-1.5 pl-3 sm:pl-16 pr-1 bg-slate-100 dark:bg-slate-950">
                        <span className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400 shrink-0" style={{ letterSpacing: '0.08em' }}>Note</span>
                        <span aria-hidden="true" className="w-2 h-2 rounded-sm shrink-0" style={{ background: TEXT_COLORS[item.color]?.hex }} />
                        <span className="flex-1 min-w-0 max-sm:order-last max-sm:basis-full max-sm:pb-1 italic text-slate-600 dark:text-slate-400 break-words">{item.content}</span>
                        {!isVirtual && (
                          <button type="button" onClick={() => handleEditNote(item)} aria-label="Modifier la note" className={iconBtn + ' max-sm:ml-auto'}><Edit2 size={15} /></button>
                        )}
                        {reorder}
                      </div>
                    </li>
                  );
                }

                songNumber += 1;
                const shownKey = item.song.key ? transposeChord(item.song.key, item.transpose) : '';
                return (
                  <li
                    key={item.id}
                    draggable={!isVirtual}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-b border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3.5 gap-y-1 min-h-[56px] py-1.5 px-1">
                      {!isVirtual && <GripVertical size={16} className="hidden sm:block text-slate-400 cursor-grab shrink-0" aria-hidden="true" />}
                      <span className="w-7 text-right font-mono font-bold text-slate-500 shrink-0">{songNumber}</span>
                      <span className="flex-1 min-w-0 max-sm:basis-[calc(100%-3rem)] flex flex-col leading-tight">
                        <span className="font-semibold break-words">{item.song.title}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{item.song.artist}</span>
                      </span>
                      <span className="flex items-center gap-0.5 shrink-0 max-sm:ml-[2.6rem] max-sm:mr-auto" role="group" aria-label={`Ton de ${item.song.title}`}>
                        <button type="button" onClick={() => updateItemTranspose(item.id, item.transpose - 1)} aria-label="Baisser d'un demi-ton" className={iconBtn + ' w-7 h-7'}><Minus size={14} /></button>
                        <span title={item.transpose !== 0 ? `${item.transpose > 0 ? '+' : ''}${item.transpose} demi-ton(s), original en ${item.song.key}` : 'Ton original'}>
                          {shownKey ? <KeyBadge outlined={item.transpose !== 0}>{shownKey}</KeyBadge> : <span className="font-mono text-sm text-slate-500">{item.transpose > 0 ? '+' : ''}{item.transpose}</span>}
                        </span>
                        <button type="button" onClick={() => updateItemTranspose(item.id, item.transpose + 1)} aria-label="Monter d'un demi-ton" className={iconBtn + ' w-7 h-7'}><Plus size={14} /></button>
                      </span>
                      {reorder}
                    </div>
                  </li>
                );
              })}
            </ol>

            {!isVirtual && (
              <button
                type="button"
                onClick={handleAddTextNote}
                className="self-start inline-flex items-center gap-1.5 h-[38px] px-3 rounded-md border border-dashed border-slate-400 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:border-slate-600 hover:text-ink dark:hover:text-slate-100"
              >
                <Plus size={16} /> Ajouter une note
              </button>
            )}
          </section>

          {!isVirtual ? (
            <aside
              ref={libraryRef}
              aria-label="Ajouter depuis la bibliothèque"
              className="flex-[1_1_300px] min-w-0 lg:max-w-[380px] lg:sticky lg:top-6 flex flex-col gap-3.5 p-6 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
            >
              <h2 className="m-0 font-display font-bold text-lg">Bibliothèque</h2>
              <label className="flex items-center gap-2 h-10 px-3 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:border-cyan-600 dark:focus-within:border-cyan-400">
                <Search size={16} className="text-slate-500 shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Chercher dans la bibliothèque"
                  placeholder="Chercher"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none placeholder:text-slate-500"
                />
              </label>
              <Segmented
                label="Source"
                size="sm"
                value={librarySource}
                onChange={setLibrarySource}
                className="self-start"
                options={[
                  { value: 'all', label: 'Toutes' },
                  { value: 'favorites', label: 'Favoris' },
                  ...(currentSetlist.group_id ? [{ value: 'group' as const, label: 'Groupe' }] : [])
                ]}
              />
              <div className="flex flex-col lg:max-h-[60vh] lg:overflow-y-auto">
                {librarySongs.length === 0 && (
                  <p className="m-0 py-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">Aucune chanson trouvée.</p>
                )}
                {librarySongs.map(song => {
                  const added = inSetlist.has(song.id);
                  return (
                    <div key={song.id} className="flex items-center gap-2.5 py-2.5 border-t border-slate-200 dark:border-slate-800">
                      <span className="flex-1 min-w-0 flex flex-col leading-tight">
                        <span className="font-semibold truncate">{song.title}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {song.artist}
                          {song.key && <> · <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{song.key}</span></>}
                        </span>
                      </span>
                      {added ? (
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">Ajoutée</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addSongToSetlist(song)}
                          aria-label={`Ajouter ${song.title} à la setlist`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-cyan-600 hover:text-cyan-600 dark:hover:border-cyan-400 dark:hover:text-cyan-400"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          ) : (
            <aside className="flex-[1_1_300px] min-w-0 lg:max-w-[380px] flex flex-col gap-2 p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
              <h2 className="m-0 font-display font-bold text-lg">Liste dynamique</h2>
              <p className="m-0 text-sm text-slate-600 dark:text-slate-400">
                Elle se met à jour quand vous ajoutez ou retirez une chanson de vos favoris. Les changements de ton faits ici ne sont pas enregistrés.
              </p>
            </aside>
          )}
        </div>
      ) : setlistItemsLoadedFor === currentSetlist.id ? (
        <SetlistDocumentEditor
          key={currentSetlist.id}
          setlist={currentSetlist}
          setlistItems={setlistItems}
          allSongs={allSongs}
          onSongOrderChange={handleDocumentSongOrderChange}
          onSongRemoved={removeItemFromSetlist}
          onSongTransposeChange={updateItemTranspose}
          onSongInserted={handleDocumentSongInserted}
          onLayoutDocumentChange={handleLayoutDocumentChange}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-20">
          Chargement du document…
        </div>
      )}
    </div>
  );
};

export default SetlistEditor;
