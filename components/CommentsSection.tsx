import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Comment } from '../types';
import { User, Send, Trash2, MessageSquare } from 'lucide-react';

interface CommentsSectionProps {
  songId: string;
  session: any;
  onOpenAuth: () => void;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ songId, session, onOpenAuth }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [songId]);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*, user:users(username, avatar_url)')
      .eq('song_id', songId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onOpenAuth();
      return;
    }
    if (!newComment.trim()) return;

    setSubmitting(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({
        song_id: songId,
        user_id: session.user.id,
        content: newComment.trim()
      })
      .select('*, user:users(username, avatar_url)')
      .single();

    if (!error && data) {
      setComments([...comments, data]);
      setNewComment('');
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (!error) {
      setComments(comments.filter(c => c.id !== commentId));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 font-sans text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>
        Commentaires · {comments.length}
      </h2>

      <div className="flex flex-col">
        {loading ? (
          <p className="m-0 py-3 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">Chargement…</p>
        ) : comments.length === 0 ? (
          <p className="m-0 py-3 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">Aucun commentaire pour l'instant.</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="group flex flex-col gap-1 py-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 text-sm">
                  <b>{comment.user?.username || 'Membre'}</b>{' '}
                  <span className="text-slate-500">· {formatDate(comment.created_at)}</span>
                </p>
                {session && session.user.id === comment.user_id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    aria-label="Supprimer le commentaire"
                    className="w-8 h-8 inline-flex items-center justify-center rounded text-slate-500 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="m-0 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor={`comment-${songId}`} className="sr-only">Ajouter un commentaire</label>
        <textarea
          id={`comment-${songId}`}
          rows={2}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={session ? 'Ajouter un commentaire' : 'Connectez-vous pour commenter'}
          className="w-full resize-y px-3 py-2.5 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base outline-none focus:border-cyan-600 dark:focus:border-cyan-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        {(newComment.trim() || !session) && (
          <button
            type="submit"
            disabled={submitting}
            className="self-start inline-flex items-center gap-2 h-9 px-3 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            <Send size={14} /> {session ? 'Publier' : 'Se connecter'}
          </button>
        )}
      </form>
    </section>
  );
};

export default CommentsSection;