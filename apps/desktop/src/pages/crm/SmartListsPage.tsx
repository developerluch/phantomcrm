import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  IconDotsVertical,
  IconPinned,
  IconPinnedOff,
  IconPlus,
  IconEdit,
  IconCopy,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { SaveSmartListDialog } from '@/components/crm/SaveSmartListDialog'
import {
  useSmartLists,
  useDeleteSmartList,
  usePinSmartList,
  useCreateSmartList,
} from '@/hooks/useSmartLists'
import { usePermission } from '@/hooks/usePermission'
import { useState } from 'react'
import type { SmartList } from '@/types/portal'

export default function SmartListsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useSmartLists()
  const pin = usePinSmartList()
  const del = useDeleteSmartList()
  const duplicate = useCreateSmartList()
  const isAdmin = usePermission('crm.admin')

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<SmartList | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const lists = data?.smartlists ?? []

  async function onDuplicate(sl: SmartList) {
    try {
      const copy = await duplicate.mutateAsync({
        name: `${sl.name} (copy)`,
        description: sl.description,
        filter: sl.filter,
        isPinned: false,
      })
      toast.success(`Duplicated to "${copy.name}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Duplicate failed')
    }
  }

  function onEdit(sl: SmartList) {
    setEditTarget(sl)
    setEditOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Smart Lists</h1>
          <p className="text-sm text-muted-foreground">
            Saved contact queries. Open one to see matches, or pin it for quick access from the Contacts page.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/crm/contacts')}>
          <IconPlus size={14} className="mr-1" /> Create from Contacts
        </Button>
      </div>

      {lists.length === 0 ? (
        <Card className="bg-card/40 backdrop-blur">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You have no saved smart lists yet. Save the current Contacts view to create your first.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((sl) => (
            <Card key={sl.id} className="bg-card/50 backdrop-blur hover:border-accent/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent hover:underline"
                      onClick={() => navigate(`/crm/lists/${sl.id}`)}
                    >
                      {sl.name}
                    </Button>
                    {sl.isPinned && <IconPinned size={12} className="text-accent-foreground" />}
                  </CardTitle>
                  <SmartListActions
                    isPinned={sl.isPinned}
                    onTogglePin={() => pin.mutate({ id: sl.id, pinned: !sl.isPinned })}
                    onOpen={() => navigate(`/crm/lists/${sl.id}`)}
                    onEdit={() => onEdit(sl)}
                    onDuplicate={() => onDuplicate(sl)}
                    onDelete={() => setConfirmDeleteId(sl.id)}
                  />
                </div>
                {sl.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{sl.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <Badge variant="outline">
                  {sl.count != null ? `${sl.count} matches` : `${sl.filter?.rules?.length ?? 0} rules`}
                </Badge>
                <span>Updated {formatDistanceToNow(new Date(sl.updatedAt), { addSuffix: true })}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete smart list?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved filter will be removed permanently. Contacts matched by it are NOT affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDeleteId) return
                try {
                  await del.mutateAsync(confirmDeleteId)
                  toast.success('Smart list deleted')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Delete failed')
                }
                setConfirmDeleteId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog — prefills from the selected smart list. */}
      <SaveSmartListDialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v)
          if (!v) setEditTarget(null)
        }}
        filter={editTarget?.filter ?? { combinator: 'and', rules: [] }}
        smartList={editTarget ?? undefined}
        isAdmin={isAdmin}
      />
    </div>
  )
}

function SmartListActions({
  isPinned,
  onTogglePin,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  isPinned: boolean
  onTogglePin: () => void
  onOpen: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <IconDotsVertical size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>Open</DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <IconEdit size={14} className="mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <IconCopy size={14} className="mr-2" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onTogglePin}>
          {isPinned ? (
            <>
              <IconPinnedOff size={14} className="mr-2" /> Unpin
            </>
          ) : (
            <>
              <IconPinned size={14} className="mr-2" /> Pin
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
