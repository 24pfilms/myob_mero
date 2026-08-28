import { useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FileText,
  Search,
  Save,
  Trash2,
  Download,
  Sparkles,
  FileJson,
  Settings,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommand: (command: string) => void;
}

export const CommandPalette = ({
  open,
  onOpenChange,
  onCommand,
}: CommandPaletteProps) => {
  const commands = [
    {
      group: "File",
      items: [
        { id: "new-note", icon: FileText, label: "New Note", shortcut: "Ctrl+N" },
        { id: "save", icon: Save, label: "Save Note", shortcut: "Ctrl+S" },
        { id: "delete", icon: Trash2, label: "Delete Note" },
        { id: "export", icon: Download, label: "Export as Markdown" },
        { id: "export-json", icon: FileJson, label: "Export as JSON" },
      ],
    },
    {
      group: "AI",
      items: [
        { id: "ai-suggest", icon: Sparkles, label: "AI Suggestions" },
        { id: "ai-summarize", icon: Sparkles, label: "Summarize Content" },
        { id: "ai-expand", icon: Sparkles, label: "Expand Section" },
        { id: "ai-tags", icon: Sparkles, label: "Suggest Tags" },
      ],
    },
    {
      group: "View",
      items: [
        { id: "search", icon: Search, label: "Search Notes", shortcut: "Ctrl+F" },
        { id: "settings", icon: Settings, label: "Settings" },
      ],
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {commands.map((group) => (
          <CommandGroup key={group.group} heading={group.group}>
            {group.items.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => {
                  onCommand(item.id);
                  onOpenChange(false);
                }}
                className="gap-3"
              >
                <item.icon className="w-4 h-4 text-primary" />
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-muted-foreground">
                    {item.shortcut}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};
