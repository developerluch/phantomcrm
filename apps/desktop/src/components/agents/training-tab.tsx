import { useState } from 'react'
import { useTrainingItems, useCreateTrainingItem, useUpdateTrainingItem, useDeleteTrainingItem } from '../../hooks/useTraining'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { IconPlus, IconTrash, IconLoader2, IconCheck } from '@tabler/icons-react'
import { toast } from 'sonner'

export function TrainingTab({ agentId }: { agentId: string }) {
  const { data: items, isLoading } = useTrainingItems(agentId)
  const createItem = useCreateTrainingItem()
  const updateItem = useUpdateTrainingItem()
  const deleteItem = useDeleteTrainingItem()

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  function handleCreate() {
    if (!title.trim()) return
    createItem.mutate(
      {
        agentId,
        data: {
          title: title.trim(),
          description: description || undefined,
          dueDate: dueDate || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Training item added')
          setTitle('')
          setDescription('')
          setDueDate('')
          setShowForm(false)
        },
        onError: () => toast.error('Failed to add training item'),
      }
    )
  }

  function toggleStatus(itemId: string, currentStatus: string) {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    updateItem.mutate(
      { agentId, itemId, data: { status: newStatus } },
      {
        onError: () => toast.error('Failed to update status'),
      }
    )
  }

  function handleDelete(itemId: string) {
    if (!confirm('Delete this training item?')) return
    deleteItem.mutate(
      { agentId, itemId },
      {
        onSuccess: () => toast.success('Item deleted'),
        onError: () => toast.error('Failed to delete item'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  const total = items?.length ?? 0
  const completed = items?.filter((i) => i.status === 'completed').length ?? 0
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {completed}/{total} completed
          </p>
          <Progress value={progress} className="w-32 h-2" />
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant="outline" size="sm" className="flex items-center gap-1">
          <IconPlus size={14} />
          Add Item
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/50 bg-popover p-4 space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Training item title" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={handleCreate} variant="gradient" size="sm" disabled={!title.trim() || createItem.isPending}>
              {createItem.isPending ? 'Adding...' : 'Add'}
            </Button>
            <Button onClick={() => setShowForm(false)} variant="outline" size="sm">Cancel</Button>
          </div>
        </div>
      )}

      {!items || items.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-popover p-12 text-center">
          <p className="text-muted-foreground">No training items yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/50 bg-popover p-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleStatus(item.id, item.status)}
                  className={`h-5 w-5 rounded border-2 shrink-0 p-0 transition-colors ${
                    item.status === 'completed'
                      ? 'bg-green-500 border-green-500 hover:bg-green-600 hover:border-green-600'
                      : 'border-border hover:border-muted-foreground bg-transparent hover:bg-transparent'
                  }`}
                >
                  {item.status === 'completed' && (
                    <IconCheck size={10} className="text-white" strokeWidth={3} />
                  )}
                </Button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  )}
                </div>

                {item.dueDate && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    Due {item.dueDate.slice(0, 10)}
                  </span>
                )}

                {item.completedAt && (
                  <span className="text-xs text-green-500 shrink-0">
                    Done {item.completedAt.slice(0, 10)}
                  </span>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-400"
                >
                  <IconTrash size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
