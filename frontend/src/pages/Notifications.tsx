import { Bell, Check, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../services/api'
import { notify } from '../utils/toast'

interface Notification {
  id: number
  notification_type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export default function Notifications() {
  const queryClient = useQueryClient()

  const {
    data: notifications = [],
    isLoading,
    isError,
  } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(false),
    refetchInterval: 60_000,
  })

  const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)

  const markAllReadMutation = useMutation({
    mutationFn: (ids: number[]) => notificationsApi.markRead(ids),
    onMutate: async (ids: number[]) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread'] })

      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications'])
      const previousUnreadNotifications = queryClient.getQueryData<Notification[]>(['notifications', 'unread'])

      queryClient.setQueryData<Notification[]>(['notifications'], (current = []) =>
        current.map((notification) =>
          ids.includes(notification.id)
            ? { ...notification, is_read: true }
            : notification,
        ),
      )

      queryClient.setQueryData<Notification[]>(['notifications', 'unread'], (current = []) =>
        current.filter((notification) => !ids.includes(notification.id)),
      )

      return { previousNotifications, previousUnreadNotifications }
    },
    onError: (_error, _ids, context) => {
      if (!context) {
        notify.error('Unable to mark notifications as read right now.')
        return
      }

      queryClient.setQueryData(['notifications'], context.previousNotifications)
      queryClient.setQueryData(['notifications', 'unread'], context.previousUnreadNotifications)
      notify.error('Unable to mark notifications as read right now.')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.delete(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread'] })

      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications'])
      const previousUnreadNotifications = queryClient.getQueryData<Notification[]>(['notifications', 'unread'])

      queryClient.setQueryData<Notification[]>(['notifications'], (current = []) =>
        current.filter((notification) => notification.id !== id),
      )

      queryClient.setQueryData<Notification[]>(['notifications', 'unread'], (current = []) =>
        current.filter((notification) => notification.id !== id),
      )

      return { previousNotifications, previousUnreadNotifications }
    },
    onError: (_error, _id, context) => {
      if (!context) {
        notify.error('Unable to delete notification right now.')
        return
      }

      queryClient.setQueryData(['notifications'], context.previousNotifications)
      queryClient.setQueryData(['notifications', 'unread'], context.previousUnreadNotifications)
      notify.error('Unable to delete notification right now.')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
    },
  })

  const handleMarkAllRead = () => {
    if (unreadIds.length === 0 || markAllReadMutation.isPending) {
      return
    }
    markAllReadMutation.mutate(unreadIds)
  }

  const handleDelete = (id: number) => {
    if (deleteMutation.isPending) {
      return
    }
    deleteMutation.mutate(id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Your recent compliance and system events</p>
        </div>
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={unreadIds.length === 0 || markAllReadMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {markAllReadMutation.isPending ? 'Marking...' : 'Mark all read'}
        </button>
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">Loading notifications...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-red-500">Unable to load notifications right now.</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
          <p className="text-gray-500 mt-1">You're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${
                n.is_read ? 'border-gray-200' : 'border-primary-200 bg-primary-50'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  n.is_read ? 'bg-gray-300' : 'bg-primary-600'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                <p className="text-gray-600 text-sm mt-0.5">{n.message}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                disabled={deleteMutation.isPending}
                className="p-1 text-gray-400 hover:text-red-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
