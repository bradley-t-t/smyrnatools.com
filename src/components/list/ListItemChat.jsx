import React, {useEffect, useMemo, useRef, useState} from 'react'
import {ChatService} from '../../services/ChatService'
import {UserService} from '../../services/UserService'
import {ListService} from '../../services/ListService'
import './styles/ListItemChat.css'

function ListItemChat({itemId}) {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [deletingId, setDeletingId] = useState('')
    const [currentUserId, setCurrentUserId] = useState(null)
    const [userNames, setUserNames] = useState({})
    const listRef = useRef(null)

    useEffect(() => {
        let unsub = () => {
        }
        let mounted = true

        async function preloadNames(list) {
            try {
                const ids = Array.from(new Set((list || []).map(m => m.sender_id).filter(id => id && id !== currentUserId)))
                const missing = ids.filter(id => !userNames[id])
                if (!missing.length) return
                const entries = await Promise.all(missing.map(async id => {
                    try {
                        return [id, await UserService.getUserDisplayName(id)]
                    } catch {
                        return [id, id.slice(0, 8)]
                    }
                }))
                if (mounted && entries.length) setUserNames(prev => ({...prev, ...Object.fromEntries(entries)}))
            } catch {
            }
        }

        async function init() {
            try {
                const user = await UserService.getCurrentUser()
                if (mounted) setCurrentUserId(user?.id || null)
                const initial = await ChatService.fetchMessages(itemId)
                if (mounted) setMessages(initial)
                await preloadNames(initial)
                unsub = ChatService.subscribeToItem(itemId, async () => {
                    try {
                        const data = await ChatService.fetchMessages(itemId)
                        if (mounted) setMessages(data)
                        await preloadNames(data)
                    } catch (err) {
                    }
                })
            } catch (err) {
            }
        }

        if (itemId) init()
        return () => {
            mounted = false
            try {
                unsub()
            } catch {
            }
        }
    }, [itemId, currentUserId, userNames])

    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    }, [messages])

    const canSend = useMemo(() => input.trim().length > 0 && !sending && !!itemId, [input, sending, itemId])

    async function refresh() {
        try {
            const data = await ChatService.fetchMessages(itemId)
            setMessages(data)
            const ids = Array.from(new Set((data || []).map(m => m.sender_id).filter(id => id && id !== currentUserId && !userNames[id])))
            if (ids.length) {
                const entries = await Promise.all(ids.map(async id => {
                    try {
                        return [id, await UserService.getUserDisplayName(id)]
                    } catch {
                        return [id, id.slice(0, 8)]
                    }
                }))
                setUserNames(prev => ({...prev, ...Object.fromEntries(entries)}))
            }
        } catch {
        }
    }

    async function handleSend(e) {
        e?.preventDefault?.()
        if (!canSend) return
        setSending(true)
        try {
            await ChatService.sendMessage(itemId, input)
            setInput('')
            await refresh()
        } catch (err) {
            const msg = err?.message || 'Failed to send message'
            try {
                window.alert(msg)
            } catch {
            }
        } finally {
            setSending(false)
        }
    }

    async function handleDelete(messageId) {
        if (!messageId || deletingId) return
        setDeletingId(messageId)
        try {
            await ChatService.deleteMessage(messageId)
            await refresh()
        } catch (err) {
            const msg = err?.message || 'Failed to delete message'
            try {
                window.alert(msg)
            } catch {
            }
        } finally {
            setDeletingId('')
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="list-item-chat">
            <div className="chat-header">
                <i className="fas fa-comments"></i>
                <span>Item Chat</span>
            </div>
            <div className="chat-messages" ref={listRef}>
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <i className="fas fa-comment-dots"></i>
                        <span>No messages yet. Start the conversation.</span>
                    </div>
                ) : (
                    messages.map(m => {
                        const isSelf = currentUserId && m.sender_id === currentUserId
                        const displayName = isSelf ? 'You' : (userNames[m.sender_id] || (m.sender_id || '').slice(0, 8))
                        return (
                            <div key={m.id} className={"chat-message" + (isSelf ? ' self' : '')}>
                                <div className="meta">
                                    <div className="meta-left">
                                        <span className="author">{displayName}</span>
                                        <span className="time">{ListService.formatDate(m.created_at)}</span>
                                    </div>
                                    {isSelf && (
                                        <button
                                            className="delete-message"
                                            title="Delete"
                                            aria-label="Delete message"
                                            disabled={!!deletingId}
                                            onClick={() => handleDelete(m.id)}
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    )}
                                </div>
                                <div className="body">{m.message}</div>
                            </div>
                        )
                    })
                )}
            </div>
            <form className="chat-input" onSubmit={handleSend}>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Write a message"
                    disabled={sending}
                />
                <button type="submit" className="send-button" disabled={!canSend}>
                    <i className="fas fa-paper-plane"></i>
                </button>
            </form>
        </div>
    )
}

export default ListItemChat
