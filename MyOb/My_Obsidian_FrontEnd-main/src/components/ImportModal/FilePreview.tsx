import { ParsedUrlItem } from "@/lib/urlFileParser"
import { detectContentType, getContentTypeIcon } from "@/lib/urlFileParser"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

interface FilePreviewProps {
  fileName: string
  items: ParsedUrlItem[]
  onBack: () => void
  onContinue: () => void
}

export function FilePreview({ fileName, items, onBack, onContinue }: FilePreviewProps) {
  const itemsWithTitles = items.filter(item => item.custom_title).length
  const itemsWithoutTitles = items.length - itemsWithTitles

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">File Parsed Successfully</h3>
          <p className="text-sm text-muted-foreground mt-1">
            ✅ {fileName}
          </p>
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total URLs:</span>
          <span className="font-semibold">{items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">With titles:</span>
          <span className="font-semibold">{itemsWithTitles}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Auto-title:</span>
          <span className="font-semibold">{itemsWithoutTitles}</span>
        </div>
      </div>

      <div className="border rounded-lg">
        <div className="bg-muted px-4 py-2 border-b">
          <h4 className="text-sm font-medium">Preview</h4>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-4 space-y-3">
            {items.slice(0, 10).map((item, index) => {
              const contentType = detectContentType(item.url)
              const icon = getContentTypeIcon(contentType)

              return (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 text-2xl">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.custom_title || (
                            <span className="text-muted-foreground italic">
                              [Auto-generated]
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.url}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {contentType}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {items.length > 10 && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                ... and {items.length - 10} more
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onContinue}>
          Configure & Import
        </Button>
      </div>
    </div>
  )
}
