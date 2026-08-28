import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react"

interface ImportProgressProps {
  jobId: string
  totalItems: number
  onComplete: (results: any) => void
}

export function ImportProgress({ jobId, totalItems, onComplete }: ImportProgressProps) {
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let pollInterval: NodeJS.Timeout

    const pollStatus = async () => {
      try {
        const statusData = await api.getImportJobStatus(jobId)
        setStatus(statusData)

        if (statusData.status === 'completed' || statusData.status === 'failed') {
          clearInterval(pollInterval)
          onComplete(statusData)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get import status')
        clearInterval(pollInterval)
      }
    }

    // Initial poll
    pollStatus()

    // Poll every 2 seconds
    pollInterval = setInterval(pollStatus, 2000)

    return () => clearInterval(pollInterval)
  }, [jobId, onComplete])

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="w-5 h-5" />
          <p className="font-medium">Error polling import status</p>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const progress = status.total > 0 ? (status.completed / status.total) * 100 : 0
  const isComplete = status.status === 'completed'
  const isFailed = status.status === 'failed'

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">
            {isComplete ? 'Import Complete!' : isFailed ? 'Import Failed' : 'Importing Content...'}
          </h3>
          <span className="text-sm text-muted-foreground">
            {status.completed}/{status.total}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">
          {Math.round(progress)}% complete
        </p>
      </div>

      {status.failed > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <XCircle className="w-4 h-4 text-destructive" />
          <span className="text-destructive">
            {status.failed} {status.failed === 1 ? 'item' : 'items'} failed
          </span>
        </div>
      )}

      <div className="border rounded-lg">
        <div className="bg-muted px-4 py-2 border-b">
          <h4 className="text-sm font-medium">Progress Details</h4>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-4 space-y-2">
            {status.results.map((result: any, index: number) => {
              const isSuccess = result.status === 'success'
              const isPending = !result.status || result.status === 'pending'
              const isProcessing = result.status === 'processing'

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isSuccess && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {result.status === 'failed' && (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    {(isPending || isProcessing) && (
                      <Clock className="w-5 h-5 text-muted-foreground animate-pulse" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {isSuccess ? (
                      <>
                        <p className="font-medium text-sm truncate">
                          {result.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.content_type || 'Unknown type'}
                        </p>
                      </>
                    ) : result.status === 'failed' ? (
                      <>
                        <p className="font-medium text-sm text-destructive truncate">
                          Failed
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {result.url}
                        </p>
                        {result.error && (
                          <p className="text-xs text-destructive mt-1">
                            {result.error}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-sm text-muted-foreground truncate">
                          {isProcessing ? 'Processing...' : 'Pending'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {result.url}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {(isComplete || isFailed) && (
        <div className="flex justify-end">
          <Button onClick={() => onComplete(status)}>
            {isComplete ? 'View Notes' : 'Close'}
          </Button>
        </div>
      )}
    </div>
  )
}
