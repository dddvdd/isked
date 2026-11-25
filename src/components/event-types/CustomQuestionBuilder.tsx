"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type {
  CustomQuestion,
  CustomQuestionType,
} from "@/lib/validations/event-type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface CustomQuestionBuilderProps {
  questions: CustomQuestion[];
  onChange: (questions: CustomQuestion[]) => void;
}

const QUESTION_TYPES: { value: CustomQuestionType; label: string }[] = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text (Textarea)" },
  { value: "select", label: "Dropdown Select" },
  { value: "checkbox", label: "Checkbox" },
];

export function CustomQuestionBuilder({
  questions,
  onChange,
}: CustomQuestionBuilderProps) {
  function addQuestion() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    onChange([
      ...questions,
      {
        id,
        label: "",
        type: "text",
        required: false,
      },
    ]);
  }

  function updateQuestion(index: number, patch: Partial<CustomQuestion>) {
    const next = questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    onChange(next);
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Custom Invitee Questions</h3>
          <p className="text-xs text-muted-foreground">
            Name, Email, and Additional Notes are always collected by default.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No custom questions configured. Click &ldquo;Add Question&rdquo; to
          collect extra context from invitees.
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question, idx) => (
            <div
              key={question.id}
              className="space-y-3 rounded-lg border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Question #{idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === 0}
                    onClick={() => moveQuestion(idx, -1)}
                    aria-label="Move question up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === questions.length - 1}
                    onClick={() => moveQuestion(idx, 1)}
                    aria-label="Move question down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeQuestion(idx)}
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`q-label-${question.id}`}>Prompt / Label</Label>
                  <Input
                    id={`q-label-${question.id}`}
                    placeholder="e.g., What is your company size?"
                    value={question.label}
                    onChange={(e) =>
                      updateQuestion(idx, { label: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`q-type-${question.id}`}>Field Type</Label>
                  <select
                    id={`q-type-${question.id}`}
                    value={question.type}
                    onChange={(e) => {
                      const nextType = e.target.value as CustomQuestionType;
                      updateQuestion(idx, {
                        type: nextType,
                        options:
                          nextType === "select"
                            ? question.options?.length
                              ? question.options
                              : ["Option 1", "Option 2"]
                            : undefined,
                      });
                    }}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {question.type === "select" && (
                <div className="space-y-1.5">
                  <Label htmlFor={`q-options-${question.id}`}>
                    Dropdown Options (comma-separated)
                  </Label>
                  <Input
                    id={`q-options-${question.id}`}
                    placeholder="1-10, 11-50, 51-200, 200+"
                    value={(question.options ?? []).join(", ")}
                    onChange={(e) =>
                      updateQuestion(idx, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id={`q-req-${question.id}`}
                  checked={question.required}
                  onCheckedChange={(checked) =>
                    updateQuestion(idx, { required: Boolean(checked) })
                  }
                />
                <Label
                  htmlFor={`q-req-${question.id}`}
                  className="text-xs font-normal"
                >
                  Required field
                </Label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

