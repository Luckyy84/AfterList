import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchCustomLists, fetchListMemberships, setListMembership, type CustomList } from '../../services/mediaLibrary'

export default function CustomListMemberships({ itemId }: { itemId: string }) {
  const { user } = useAuth()
  const [lists, setLists] = useState<CustomList[]>([])
  const [memberships, setMemberships] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  useEffect(() => {
    if (!user) return
    Promise.all([fetchCustomLists(user.id), fetchListMemberships(itemId, user.id)]).then(([nextLists, nextMemberships]) => { setLists(nextLists); setMemberships(nextMemberships) }).catch(() => setError('Could not load custom lists.'))
  }, [itemId, user])
  if (!user || (!lists.length && !error)) return null
  return <section className="custom-list-memberships" aria-label="Custom lists"><p className="details-section-label">Custom lists</p>{lists.map((list) => <label key={list.id}><input type="checkbox" checked={memberships.has(list.id)} onChange={(event) => { const included = event.currentTarget.checked; setMemberships((current) => { const next = new Set(current); if (included) next.add(list.id); else next.delete(list.id); return next }); void setListMembership(list.id, itemId, user.id, included).catch(() => setError('Could not update custom list.')) }} />{list.name}</label>)}{error && <p role="alert" className="details-api-error">{error}</p>}</section>
}
