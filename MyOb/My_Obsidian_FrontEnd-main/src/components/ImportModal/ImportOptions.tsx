import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Folder } from "@/lib/api"

export interface ImportOptionsData {
  generateSummary: boolean
  summaryLength: 'brief' | 'medium' | 'detailed'
  autoTag: boolean
  folderId: string | null
}

interface ImportOptionsProps {
  options: ImportOptionsData
  folders: Folder[]
  onChange: (options: ImportOptionsData) => void
}

export function ImportOptions({ options, folders, onChange }: ImportOptionsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="generate-summary"
            checked={options.generateSummary}
            onCheckedChange={(checked) =>
              onChange({ ...options, generateSummary: checked as boolean })
            }
          />
          <Label htmlFor="generate-summary" className="text-sm font-medium">
            Generate AI Summary
          </Label>
        </div>

        {options.generateSummary && (
          <div className="ml-6 space-y-2">
            <Label className="text-sm text-muted-foreground">Summary Length</Label>
            <RadioGroup
              value={options.summaryLength}
              onValueChange={(value) =>
                onChange({
                  ...options,
                  summaryLength: value as 'brief' | 'medium' | 'detailed',
                })
              }
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="brief" id="brief" />
                <Label htmlFor="brief" className="text-sm font-normal cursor-pointer">
                  Brief (~100 words)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="text-sm font-normal cursor-pointer">
                  Medium (~250 words)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="detailed" id="detailed" />
                <Label htmlFor="detailed" className="text-sm font-normal cursor-pointer">
                  Detailed (~500 words)
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="auto-tag"
          checked={options.autoTag}
          onCheckedChange={(checked) =>
            onChange({ ...options, autoTag: checked as boolean })
          }
        />
        <Label htmlFor="auto-tag" className="text-sm font-medium">
          Auto-generate Tags
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="folder-select" className="text-sm font-medium">
          Folder (optional)
        </Label>
        <Select
          value={options.folderId || 'root'}
          onValueChange={(value) =>
            onChange({ ...options, folderId: value === 'root' ? null : value })
          }
        >
          <SelectTrigger id="folder-select">
            <SelectValue placeholder="Select a folder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="root">Root (No Folder)</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                📁 {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
