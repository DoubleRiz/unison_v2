import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Group, GroupMember, Song } from '../types';
import { Loader2, Send, X } from 'lucide-react';
import { Eyebrow, Initials } from './ui/Brand';
import { Modal } from './ui/Modal';
import { alertCls, inputCls, labelCls, secondaryBtn } from './ui/styles';
import { notifyError, errorMessage, UserFacingError } from './ui/Toast';

interface GroupManagerProps {
  user: any;
  songs?: Song[];
  onClose: () => void;
}

type Membership = GroupMember & { groups?: Group };

interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

const primaryBtn = 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors disabled:opacity-50';
const smallBtn = 'inline-flex items-center justify-center h-9 px-3.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50';
const linkDanger = 'h-9 px-2 text-sm font-semibold text-red-700 dark:text-red-400 underline underline-offset-[3px] decoration-1 disabled:opacity-50';

const GroupManager: React.FC<GroupManagerProps> = ({ user, songs = [] }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Membership[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const [newGroupName, setNewGroupName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [setlistCount, setSetlistCount] = useState<number | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createMessage, setCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup.id);
      fetchSetlistCount(selectedGroup.id);
      setEditNameValue(selectedGroup.name);
      setIsEditingName(false);
      setInviteUsername('');
    } else {
      setGroupMembers([]);
    }
  }, [selectedGroup?.id]);

  const flash = (setter: typeof setMessage, type: 'success' | 'error', text: string) => {
    setter({ type, text });
    if (type === 'success') setTimeout(() => setter(null), 3000);
  };

  const fetchData = async (selectId?: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: myMemberships, error: memError } = await supabase
        .from('group_members')
        .select('*, groups(*)')
        .eq('user_id', user.id);

      if (memError) throw memError;

      const accepted = (myMemberships || []).filter((m: any) => m.status === 'accepted') as Membership[];
      const pending = (myMemberships || []).filter((m: any) => m.status === 'pending') as Membership[];

      setMemberships(accepted);
      setInvitations(pending);

      const myGroups = accepted.map(m => m.groups).filter(Boolean) as Group[];
      myGroups.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      setGroups(myGroups);

      if (myGroups.length > 0) {
        const { data: rows } = await supabase
          .from('group_members')
          .select('group_id')
          .in('group_id', myGroups.map(g => g.id))
          .eq('status', 'accepted');
        const counts: Record<string, number> = {};
        (rows || []).forEach((r: any) => { counts[r.group_id] = (counts[r.group_id] || 0) + 1; });
        setMemberCounts(counts);
      }

      setSelectedGroup(prev => {
        const wanted = selectId ?? prev?.id;
        return myGroups.find(g => g.id === wanted) || myGroups[0] || null;
      });
    } catch (error: any) {
      console.error('Error fetching groups:', error.message || error);
      setFetchError(error.message || 'Impossible de charger les groupes');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('*, user:users(username, avatar_url)')
      .eq('group_id', groupId);

    if (!error && data) {
      setGroupMembers(data);
    }
  };

  const fetchSetlistCount = async (groupId: string) => {
    setSetlistCount(null);
    const { count, error } = await supabase
      .from('setlists')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId);
    if (!error) setSetlistCount(count ?? 0);
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setActionLoading(true);
    setCreateMessage(null);

    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({ name: newGroupName.trim(), created_by: user.id })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
          status: 'accepted',
          role: 'admin'
        });

      if (memError) throw memError;

      setNewGroupName('');
      await fetchData(groupData.id);
      flash(setCreateMessage, 'success', 'Groupe créé.');
    } catch (error: any) {
      console.error(error);
      flash(setCreateMessage, 'error', errorMessage('Impossible de créer le groupe.', error));
    } finally {
      setActionLoading(false);
    }
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = inviteUsername.trim();
    if (!selectedGroup || !username) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const { data: foundUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (userError || !foundUser) throw new UserFacingError(`Aucun compte ne porte le nom « ${username} ».`);

      const existing = groupMembers.find(m => m.user_id === foundUser.id);
      if (existing) {
        throw new UserFacingError(existing.status === 'pending' ? `${username} a déjà une invitation en attente.` : `${username} fait déjà partie du groupe.`);
      }

      const { error: inviteError } = await supabase
        .from('group_members')
        .insert({
          group_id: selectedGroup.id,
          user_id: foundUser.id,
          status: 'pending',
          role: 'member'
        });

      if (inviteError) throw inviteError;

      setInviteUsername('');
      fetchGroupMembers(selectedGroup.id);
      flash(setMessage, 'success', `Invitation envoyée à ${username}.`);
    } catch (error: any) {
      console.error(error);
      flash(setMessage, 'error', errorMessage('Impossible d\'envoyer l\'invitation.', error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvitation = async (memberId: string, accept: boolean, groupId?: string) => {
    setActionLoading(true);
    try {
      const { error } = accept
        ? await supabase.from('group_members').update({ status: 'accepted' }).eq('id', memberId)
        : await supabase.from('group_members').delete().eq('id', memberId);
      if (error) throw error;
      await fetchData(accept ? groupId : undefined);
    } catch (error) {
      notifyError(accept ? 'Impossible d\'accepter l\'invitation.' : 'Impossible de refuser l\'invitation.', error);
    } finally {
      setActionLoading(false);
    }
  };

  const updateGroupName = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = editNameValue.trim();
    if (!selectedGroup || !name) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('groups').update({ name }).eq('id', selectedGroup.id);
      if (error) throw error;

      setSelectedGroup({ ...selectedGroup, name });
      setGroups(groups.map(g => (g.id === selectedGroup.id ? { ...g, name } : g)));
      setIsEditingName(false);
      flash(setMessage, 'success', 'Groupe renommé.');
    } catch (error: any) {
      console.error(error);
      flash(setMessage, 'error', errorMessage('Impossible de renommer le groupe.', error));
    } finally {
      setActionLoading(false);
    }
  };

  const removeMember = (memberId: string, memberName: string, pending: boolean) => {
    setConfirm({
      title: pending ? 'Annuler l\'invitation ?' : `Retirer ${memberName} ?`,
      body: pending
        ? `${memberName} ne pourra plus rejoindre le groupe avec cette invitation.`
        : `${memberName} n'aura plus accès aux chansons et aux setlists du groupe.`,
      confirmLabel: pending ? 'Annuler l\'invitation' : 'Retirer',
      action: async () => {
        const { error } = await supabase.from('group_members').delete().eq('id', memberId);
        if (error) throw error;
        setGroupMembers(members => members.filter(m => m.id !== memberId));
        if (!pending && selectedGroup) {
          setMemberCounts(c => ({ ...c, [selectedGroup.id]: Math.max(0, (c[selectedGroup.id] || 1) - 1) }));
        }
        flash(setMessage, 'success', pending ? 'Invitation annulée.' : `${memberName} a été retiré du groupe.`);
      }
    });
  };

  const leaveGroup = (memberId: string) => {
    if (!selectedGroup) return;
    setConfirm({
      title: 'Quitter le groupe ?',
      body: `Vous n'aurez plus accès aux chansons et aux setlists de ${selectedGroup.name}. Un membre devra vous réinviter pour revenir.`,
      confirmLabel: 'Quitter le groupe',
      action: async () => {
        const { error } = await supabase.from('group_members').delete().eq('id', memberId);
        if (error) throw error;
        setSelectedGroup(null);
        await fetchData();
      }
    });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setActionLoading(true);
    try {
      await confirm.action();
      setConfirm(null);
    } catch (error: any) {
      setConfirm(null);
      console.error(error);
      flash(setMessage, 'error', errorMessage('L\'action a échoué.', error));
    } finally {
      setActionLoading(false);
    }
  };

  const isCreator = !!selectedGroup && selectedGroup.created_by === user.id;
  const myMember = groupMembers.find(m => m.user_id === user.id);
  const acceptedMembers = groupMembers
    .filter(m => m.status === 'accepted')
    .sort((a, b) => {
      const rank = (m: GroupMember) => (m.user_id === user.id ? 0 : m.role === 'admin' ? 1 : 2);
      return rank(a) - rank(b) || (a.user?.username || '').localeCompare(b.user?.username || '', 'fr');
    });
  const pendingMembers = groupMembers.filter(m => m.status === 'pending');
  const sharedSongs = selectedGroup ? songs.filter(s => s.shared_with_group_id === selectedGroup.id).length : 0;
  const roleOf = (groupId: string) => memberships.find(m => m.group_id === groupId)?.role;

  const createForm = (
    <form onSubmit={createGroup} className="flex flex-col gap-2">
      <label htmlFor="new-group" className={labelCls}>Créer un groupe</label>
      <div className="flex gap-2">
        <input
          id="new-group"
          type="text"
          placeholder="Nom du groupe"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          className={inputCls + ' h-10 flex-1 min-w-0'}
        />
        <button type="submit" disabled={actionLoading || !newGroupName.trim()} className={secondaryBtn}>
          Créer
        </button>
      </div>
      {createMessage && <p role="status" className={alertCls(createMessage.type)}>{createMessage.text}</p>}
    </form>
  );

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-7">
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => setConfirm(null)}
          footer={<>
            <button type="button" onClick={() => setConfirm(null)} className={secondaryBtn + ' h-11'}>Annuler</button>
            <button type="button" onClick={runConfirm} disabled={actionLoading} className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50">
              {actionLoading && <Loader2 size={16} className="animate-spin" />} {confirm.confirmLabel}
            </button>
          </>}
        >
          <p className="m-0 text-slate-600 dark:text-slate-400">{confirm.body}</p>
        </Modal>
      )}

      <div>
        <h1 className="m-0 font-display font-extrabold text-4xl leading-tight" style={{ letterSpacing: '-0.025em' }}>Groupes</h1>
        <p className="mt-1.5 mb-0 text-slate-600 dark:text-slate-400">Partagez vos chansons et vos setlists avec les membres du groupe.</p>
      </div>

      {fetchError && (
        <p role="alert" className={alertCls('error')}>
          <b>Impossible de charger les groupes.</b> {fetchError}
        </p>
      )}

      <div className="flex flex-wrap gap-8 items-start">
        {/* Colonne gauche : mes groupes, invitations, création */}
        <div className="flex-[1_1_260px] min-w-0 flex flex-col gap-5">
          <section className="flex flex-col gap-1">
            <Eyebrow as="h2" className="mb-1.5">Mes groupes</Eyebrow>
            {loading && (
              <p className="m-0 py-2 text-sm text-slate-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Chargement…</p>
            )}
            {!loading && groups.length === 0 && (
              <p className="m-0 py-2 text-slate-600 dark:text-slate-400">Vous n'êtes dans aucun groupe pour l'instant.</p>
            )}
            {groups.map(group => {
              const active = selectedGroup?.id === group.id;
              const role = roleOf(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => { setSelectedGroup(group); setMessage(null); }}
                  className={`flex items-center justify-between gap-3 p-3 rounded-md text-left transition-colors ${
                    active
                      ? 'bg-cyan-100 text-cyan-700 shadow-[inset_3px_0_0_#2440D6] dark:bg-cyan-900 dark:text-cyan-300 dark:shadow-[inset_3px_0_0_#93A5FF]'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex flex-col leading-tight min-w-0">
                    <span className={`${active ? 'font-bold' : 'font-semibold'} truncate`}>{group.name}</span>
                    <span className={`text-sm ${active ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>{role === 'admin' ? 'Admin' : 'Membre'}</span>
                  </span>
                  {memberCounts[group.id] !== undefined && (
                    <span className={`font-mono text-sm ${active ? '' : 'text-slate-500 dark:text-slate-400'}`} aria-label={`${memberCounts[group.id]} membres`}>
                      {memberCounts[group.id]}
                    </span>
                  )}
                </button>
              );
            })}
          </section>

          {invitations.map(inv => (
            <section key={inv.id} className="flex flex-col gap-2 p-4 rounded-md border border-amber-600 bg-amber-50 dark:bg-amber-900 dark:border-amber-600">
              <Eyebrow as="h2" className="!text-amber-700 dark:!text-amber-300">Invitation en attente</Eyebrow>
              <p className="m-0"><b>{inv.groups?.name || 'Un groupe'}</b> vous invite à rejoindre le groupe.</p>
              <div className="flex gap-2">
                <button type="button" disabled={actionLoading} onClick={() => handleInvitation(inv.id, true, inv.group_id)} className={smallBtn + ' bg-cyan-600 hover:bg-cyan-700 text-white'}>
                  Accepter
                </button>
                <button type="button" disabled={actionLoading} onClick={() => handleInvitation(inv.id, false)} className={smallBtn + ' border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-500'}>
                  Refuser
                </button>
              </div>
            </section>
          ))}

          {createForm}
        </div>

        {/* Détail du groupe */}
        {selectedGroup ? (
          <section aria-labelledby="group-title" className="flex-[999_1_480px] min-w-0 flex flex-col gap-6 p-6 md:px-7 border border-slate-200 dark:border-slate-800 rounded-xl">
            <header className="flex flex-wrap items-start justify-between gap-3">
              {isEditingName ? (
                <form onSubmit={updateGroupName} className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <label htmlFor="group-name" className="sr-only">Nom du groupe</label>
                  <input
                    id="group-name"
                    autoFocus
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setIsEditingName(false); }}
                    className={inputCls + ' flex-1 min-w-[200px] font-display font-bold text-xl'}
                  />
                  <button type="submit" disabled={actionLoading || !editNameValue.trim()} className={primaryBtn}>Enregistrer</button>
                  <button type="button" onClick={() => setIsEditingName(false)} className={secondaryBtn + ' h-11'}>Annuler</button>
                </form>
              ) : (
                <div className="min-w-0">
                  <h2 id="group-title" className="m-0 font-display font-extrabold text-[28px] leading-tight break-words" style={{ letterSpacing: '-0.02em' }}>{selectedGroup.name}</h2>
                  <p className="mt-1 mb-0 text-slate-600 dark:text-slate-400">
                    {[
                      `${sharedSongs} chanson${sharedSongs > 1 ? 's' : ''} partagée${sharedSongs > 1 ? 's' : ''}`,
                      setlistCount !== null ? `${setlistCount} setlist${setlistCount > 1 ? 's' : ''}` : null
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              )}
              {!isEditingName && (
                <div className="flex gap-1.5">
                  {isCreator && (
                    <button type="button" onClick={() => setIsEditingName(true)} className={smallBtn + ' border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-500'}>
                      Renommer
                    </button>
                  )}
                  {!isCreator && myMember && (
                    <button type="button" onClick={() => leaveGroup(myMember.id)} className={linkDanger}>Quitter le groupe</button>
                  )}
                </div>
              )}
            </header>

            {message && <p role="status" className={alertCls(message.type)}>{message.text}</p>}

            <div className="flex flex-col">
              <Eyebrow as="h3" className="mb-2">Membres</Eyebrow>
              {acceptedMembers.map(member => {
                const isMe = member.user_id === user.id;
                const name = member.user?.username || 'Compte sans nom';
                return (
                  <div key={member.id} className="flex items-center gap-3 py-3 border-t border-slate-200 dark:border-slate-800">
                    <Initials name={name} src={member.user?.avatar_url || undefined} size={36} className={isMe ? '' : '!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-100'} />
                    <span className="flex-1 min-w-0 font-semibold truncate">{name}{isMe && <span className="font-normal text-slate-500 dark:text-slate-400"> (vous)</span>}</span>
                    {member.role === 'admin' ? (
                      <span className="text-sm font-semibold px-2 py-0.5 rounded border border-ink dark:border-slate-300">Admin</span>
                    ) : (
                      <span className="text-sm font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Membre</span>
                    )}
                    <span className="w-8 shrink-0">
                      {isCreator && !isMe && (
                        <button
                          type="button"
                          onClick={() => removeMember(member.id, name, false)}
                          aria-label={`Retirer ${name}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <section aria-labelledby="inv-title" className="flex flex-col gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
              <Eyebrow as="h3"><span id="inv-title">Inviter des membres</span></Eyebrow>
              <form onSubmit={inviteMember} className="flex flex-col gap-2">
                <label htmlFor="invite" className={labelCls}>Nom d'utilisateur</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="invite"
                    type="text"
                    autoComplete="off"
                    placeholder="Le nom exact affiché sur son profil"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    className={inputCls + ' flex-[1_1_280px] min-w-0'}
                  />
                  <button type="submit" disabled={actionLoading || !inviteUsername.trim()} className={primaryBtn}>
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Envoyer l'invitation
                  </button>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">La personne doit déjà avoir un compte Unison. Elle verra l'invitation dans ses groupes.</span>
              </form>

              {pendingMembers.length > 0 && (
                <div className="flex flex-col pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Eyebrow as="h4" className="mb-1">Invitations envoyées</Eyebrow>
                  {pendingMembers.map(member => {
                    const name = member.user?.username || 'Compte sans nom';
                    return (
                      <div key={member.id} className="flex flex-wrap items-center gap-3 py-2">
                        <span className="flex-1 flex flex-col leading-snug min-w-0">
                          <span className="font-semibold truncate">{name}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">En attente de réponse</span>
                        </span>
                        {isCreator && (
                          <button type="button" onClick={() => removeMember(member.id, name, true)} className="h-8 px-2 text-sm font-semibold text-slate-600 dark:text-slate-400 underline underline-offset-[3px] decoration-1 hover:text-ink dark:hover:text-slate-100">
                            Annuler
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        ) : (
          !loading && (
            <section className="flex-[999_1_480px] min-w-0 flex flex-col items-start gap-3 p-7 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
              <h2 className="m-0 font-display font-extrabold text-[28px] leading-tight" style={{ letterSpacing: '-0.02em' }}>
                {groups.length === 0 ? 'Jouez à plusieurs' : 'Choisissez un groupe'}
              </h2>
              <p className="m-0 text-slate-600 dark:text-slate-400 max-w-[52ch]">
                {groups.length === 0
                  ? 'Créez un groupe pour votre band, votre chorale ou votre duo, puis invitez les membres : chacun retrouve les chansons partagées et les setlists du groupe.'
                  : 'Ses membres et les invitations s\'affichent ici.'}
              </p>
            </section>
          )
        )}
      </div>
    </div>
  );
};

export default GroupManager;
