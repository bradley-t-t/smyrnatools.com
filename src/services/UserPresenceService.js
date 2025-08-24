import {supabase} from './DatabaseService';
import {UserService} from './UserService';
import APIUtility from '../utils/APIUtility'

class UserPresenceService {
    constructor() {
        this.listeners = []
        this.subscriptions = []
        this.isSetup = false
        this.currentUserId = null
        this.heartbeatInterval = null
        this.cleanupInterval = null
        this.onPresenceChange = this.handlePresenceChange.bind(this)
        this.onBeforeUnload = this.handleBeforeUnload.bind(this)
        this.onOnline = this.handleOnlineStatusChange.bind(this, true)
        this.onOffline = this.handleOnlineStatusChange.bind(this, false)
    }

    async setup() {
        if (this.isSetup) return true
        try {
            const user = await UserService.getCurrentUser()
            if (!user?.id) return false
            this.currentUserId = user.id
            const subscription = supabase
                .channel('presence_changes')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'users_presence'
                }, this.onPresenceChange)
                .subscribe()
            this.subscriptions.push(subscription)
            await this.setUserOnline(this.currentUserId)
            this.startHeartbeat()
            this.startCleanup()
            window.addEventListener('beforeunload', this.onBeforeUnload)
            window.addEventListener('online', this.onOnline)
            window.addEventListener('offline', this.onOffline)
            this.isSetup = true
            return true
        } catch {
            return false
        }
    }

    async setUserOnline(userId, options = {}) {
        if (!userId) return false
        const {res, json} = await APIUtility.post('/user-presence-service/set-online', {userId}, options)
        if (!res.ok || json?.success !== true) return false
        return true
    }

    async setUserOffline(userId, options = {}) {
        if (!userId) return false
        const {res, json} = await APIUtility.post('/user-presence-service/set-offline', {userId}, options)
        if (!res.ok || json?.success !== true) return false
        return true
    }

    async updateHeartbeat(options = {}) {
        if (!this.currentUserId) return false
        const {res, json} = await APIUtility.post('/user-presence-service/heartbeat', {userId: this.currentUserId}, options)
        if (!res.ok || json?.success !== true) return false
        return true
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
        this.heartbeatInterval = setInterval(() => this.updateHeartbeat(), 30000)
    }

    startCleanup() {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval)
        this.cleanupInterval = setInterval(async () => {
            const {res} = await APIUtility.post('/user-presence-service/cleanup')
            if (res.ok) this.notifyListeners()
        }, 60000)
    }

    handlePresenceChange() {
        this.notifyListeners()
    }

    handleBeforeUnload() {
        if (this.currentUserId) {
            this.setUserOffline(this.currentUserId, {keepalive: true})
        }
    }

    handleOnlineStatusChange(isOnline) {
        if (!this.currentUserId) return
        if (isOnline) {
            this.setUserOnline(this.currentUserId)
            this.startHeartbeat()
        } else {
            this.setUserOffline(this.currentUserId)
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval)
                this.heartbeatInterval = null
            }
        }
    }

    async getOnlineUsers() {
        try {
            const {res, json} = await APIUtility.post('/user-presence-service/fetch-online-users')
            if (!res.ok) return []
            const presences = json?.data ?? []
            const users = []
            for (const presence of presences) {
                try {
                    const name = await UserService.getUserDisplayName(presence.user_id)
                    users.push({
                        id: presence.user_id,
                        name,
                        lastSeen: presence.last_seen
                    })
                } catch {
                }
            }
            return users
        } catch {
            return []
        }
    }

    addListener(callback) {
        if (typeof callback === 'function') this.listeners.push(callback)
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback)
    }

    notifyListeners() {
        this.getOnlineUsers().then(users => {
            this.listeners.forEach(listener => {
                try {
                    listener(users)
                } catch {
                }
            })
        })
    }

    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
        window.removeEventListener('beforeunload', this.onBeforeUnload)
        window.removeEventListener('online', this.onOnline)
        window.removeEventListener('offline', this.onOffline)
        this.subscriptions.forEach(subscription => {
            if (subscription?.unsubscribe) subscription.unsubscribe()
        })
        this.subscriptions = []
        this.listeners = []
        if (this.currentUserId) {
            this.setUserOffline(this.currentUserId)
            this.currentUserId = null
        }
        this.isSetup = false
    }
}

const instance = new UserPresenceService()
export {instance as UserPresenceService}
