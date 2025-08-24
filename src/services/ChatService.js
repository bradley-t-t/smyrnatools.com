import supabase from './DatabaseService'
import {UserService} from './UserService'
import {getSupabaseErrorDetails, logSupabaseError} from './DatabaseService'
import APIUtility from '../utils/APIUtility'

class ChatServiceImpl {
    channelByItem = new Map()

    async fetchMessages(listItemId) {
        if (!listItemId) return []
        try {
            const {res, json} = await APIUtility.post('/chat-service/fetch-messages', {listItemId})
            if (!res.ok) throw new Error(json?.error || 'Failed to fetch messages')
            return json?.data || []
        } catch (error) {
            logSupabaseError('ChatService.fetchMessages', error)
            throw new Error(getSupabaseErrorDetails(error))
        }
    }

    async sendMessage(listItemId, text) {
        const sessionUserId = sessionStorage.getItem('userId')
        let userId = sessionUserId
        if (!userId) {
            const user = await UserService.getCurrentUser().catch(() => null)
            userId = user?.id || null
        }
        const message = String(text || '').trim()
        if (!listItemId) throw new Error('Missing list item')
        if (!userId) throw new Error('Not authenticated')
        if (!message) throw new Error('Empty message')
        try {
            const payload = {listItemId, message, userId, id: userId, user_id: userId, userid: userId}
            const {res, json} = await APIUtility.post('/chat-service/send-message', payload)
            if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to send message')
            return true
        } catch (error) {
            logSupabaseError('ChatService.sendMessage', error)
            throw new Error(getSupabaseErrorDetails(error))
        }
    }

    async deleteMessage(messageId) {
        const sessionUserId = sessionStorage.getItem('userId')
        let userId = sessionUserId
        if (!userId) {
            const user = await UserService.getCurrentUser().catch(() => null)
            userId = user?.id || null
        }
        if (!messageId) throw new Error('Missing message id')
        if (!userId) throw new Error('Not authenticated')
        try {
            const payload = {messageId, userId, id: userId, user_id: userId, userid: userId}
            const {res, json} = await APIUtility.post('/chat-service/delete-message', payload)
            if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to delete message')
            return true
        } catch (error) {
            logSupabaseError('ChatService.deleteMessage', error)
            throw new Error(getSupabaseErrorDetails(error))
        }
    }

    subscribeToItem(listItemId, handler) {
        if (!listItemId || typeof handler !== 'function') return () => {}
        const key = String(listItemId)
        if (this.channelByItem.has(key)) this.channelByItem.get(key).unsubscribe()
        const channel = supabase
            .channel(`list_item_messages:${key}`)
            .on('postgres_changes', {event: '*', schema: 'public', table: 'list_item_messages', filter: `list_item_id=eq.${key}`}, payload => {
                handler(payload)
            })
            .subscribe()
        this.channelByItem.set(key, channel)
        return () => {
            try {
                channel.unsubscribe()
            } catch {}
            this.channelByItem.delete(key)
        }
    }
}

export const ChatService = new ChatServiceImpl()
