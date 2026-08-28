import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const MarkdownEditor = ({ value, onChange }: MarkdownEditorProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab handling
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = localValue.substring(0, start) + '  ' + localValue.substring(end);
      setLocalValue(newValue);
      onChange(newValue);
      
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }

    // Bold (Ctrl/Cmd + B)
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      wrapSelection('**', '**');
    }

    // Italic (Ctrl/Cmd + I)
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      wrapSelection('*', '*');
    }

    // Code (Ctrl/Cmd + `)
    if ((e.ctrlKey || e.metaKey) && e.key === '`') {
      e.preventDefault();
      wrapSelection('`', '`');
    }
  };

  const wrapSelection = (before: string, after: string) => {
    const textarea = document.activeElement as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localValue.substring(start, end);
    const newValue =
      localValue.substring(0, start) +
      before +
      selectedText +
      after +
      localValue.substring(end);

    setLocalValue(newValue);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = end + before.length;
    }, 0);
  };

  return (
    <div className="h-full bg-editor-bg">
      <Textarea
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full h-full resize-none border-0 bg-editor-bg editor-font text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 p-6 leading-relaxed"
        placeholder="Start writing your note..."
        spellCheck
      />
    </div>
  );
};
