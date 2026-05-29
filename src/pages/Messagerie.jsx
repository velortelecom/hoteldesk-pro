import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Messagerie() {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [texte, setTexte] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    supabase.from('profiles').select('*').neq('id', profile.id).then(({ data }) => setContacts(data || []))
  }, [profile])

  useEffect(() => {
    if (!selected) return
    fetchMessages()
    const sub = supabase.channel('messages-' + selected.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new
        if ((m.expediteur_id === profile.id && m.destinataire_id === selected.id) ||
            (m.expediteur_id === selected.id && m.destinataire_id === profile.id)) {
          setMessages(prev => [...prev, m])
        }
      })
      .subscribe()
    return () => sub.unsubscribe()
  }, [selected])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchMessages() {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(expediteur_id.eq.${profile.id},destinataire_id.eq.${selected.id}),and(expediteur_id.eq.${selected.id},destinataire_id.eq.${profile.id})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    await supabase.from('messages').update({ lu: true }).eq('expediteur_id', selected.id).eq('destinataire_id', profile.id).eq('lu', false)
  }

  async function send() {
    if (!texte.trim() || !selected) return
    await supabase.from('messages').insert({ expediteur_id: profile.id, destinataire_id: selected.id, contenu: texte.trim() })
    setTexte('')
  }

  const av = (p) => {
    const colors = [['#E6F1FB', '#0C447C'], ['#EAF3DE', '#27500A'], ['#EEEDFE', '#534AB7'], ['#FAEEDA', '#633806']]
    const i = (p.prenom.charCodeAt(0) || 0) % colors.length
    return { bg: colors[i][0], text: colors[i][1], init: ((p.prenom[0] || '') + (p.nom[0] || '')).toUpperCase() }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '200px 1fr' : '1fr', gap: 12, height: 'calc(100vh - 100px)', minHeight: 400 }}>
      <div style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, borderBottom: '0.5px solid #e0dfd8', color: '#444' }}>Équipe</div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {contacts.map(c => {
            const a = av(c)
            return (
              <div key={c.id} onClick={() => setSelected(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '0.5px solid #f0efe8', background: selected?.id === c.id ? '#f0f7ff' : 'transparent' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: a.bg, color: a.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{a.init}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.prenom} {c.nom}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{c.departement}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected ? (
        <div style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #e0dfd8', display: 'flex', alignItems: 'center', gap: 10 }}>
            {(() => { const a = av(selected); return <div style={{ width: 34, height: 34, borderRadius: '50%', background: a.bg, color: a.text, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.init}</div> })()}
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.prenom} {selected.nom}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{selected.departement}</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, margin: 'auto' }}>Démarrez la conversation...</div>}
            {messages.map(m => {
              const isMine = m.expediteur_id === profile.id
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '70%', padding: '8px 12px', borderRadius: 12, background: isMine ? '#185FA5' : '#f0efe8', color: isMine ? '#fff' : '#222', fontSize: 13, lineHeight: 1.5, borderBottomRightRadius: isMine ? 4 : 12, borderBottomLeftRadius: isMine ? 12 : 4 }}>
                    {m.contenu}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{format(new Date(m.created_at), 'HH:mm', { locale: fr })}</div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e0dfd8', display: 'flex', gap: 8 }}>
            <input value={texte} onChange={e => setTexte(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Écrire un message..." style={{ flex: 1, padding: '8px 12px', border: '0.5px solid #d0cfc8', borderRadius: 20, fontSize: 13, outline: 'none', background: '#fafaf8' }} />
            <button onClick={send} style={{ width: 36, height: 36, borderRadius: '50%', background: '#185FA5', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16 }}>↑</button>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
          Sélectionnez un collègue pour discuter
        </div>
      )}
    </div>
  )
}
