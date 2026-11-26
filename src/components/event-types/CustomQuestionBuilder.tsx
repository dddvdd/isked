"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  parseOptionsText,
  type CustomQuestion,
  type CustomQuestionType,
} from "@/lib/validations/event-type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface CustomQuestionBuilderProps {
  questions: CustomQuestion[];
  onChange: (questions: CustomQuestion[]) => void;
}

const QUESTION_TYPES: { value: CustomQuestionType; label: string }[] = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text (Textarea)" },
  { value: "email", label: "Email Address" },
  { value: "phone", label: "Contact Number" },
  { value: "select", label: "Dropdown Select" },
  { value: "checkbox", label: "Checkbox / Multi-Select" },
];

export function CustomQuestionBuilder({
  questions,
  onChange,
}: CustomQuestionBuilderProps) {
  const [rawOptionsById, setRawOptionsById] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const q of questions) {
        if (q.options && q.options.length > 0) {
          initial[q.id] = q.options.join("\n");
        }
      }
      return initial;
    }
  );

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
    const target = questions[index];
    if (target) {
      setRawOptionsById((prev) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
    }
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

  function handleOptionsTextChange(
    idx: number,
    questionId: string,
    rawText: string
  ) {
    setRawOptionsById((prev) => ({ ...prev, [questionId]: rawText }));
    const parsed = parseOptionsText(rawText);
    updateQuestion(idx, {
      options: parsed.length > 0 ? parsed : undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Custom Invitee Questions</h3>
          <p className="text-xs text-muted-foreground">
            First/Middle/Last Name, Suffix, Email, and PSGC Address (Province, Municipality, Barangay) are collected by default.
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
          {questions.map((question, idx) => {
            const supportsOptions =
              question.type === "select" || question.type === "checkbox";
            const rawText =
              rawOptionsById[question.id] ??
              (question.options ? question.options.join("\n") : "");
            const parsedOptions = question.options ?? [];

            return (
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
                    <Label htmlFor={`q-label-${question.id}`}>
                      Prompt / Label
                    </Label>
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
                        if (nextType === "select") {
                          const defaultOpts =
                            question.options && question.options.length > 0
                              ? question.options
                              : ["Option 1", "Option 2"];
                          setRawOptionsById((prev) => ({
                            ...prev,
                            [question.id]:
                              prev[question.id] ?? defaultOpts.join("\n"),
                          }));
                          updateQuestion(idx, {
                            type: nextType,
                            options: defaultOpts,
                          });
                        } else if (nextType === "checkbox") {
                          updateQuestion(idx, {
                            type: nextType,
                            options: question.options,
                          });
                        } else {
                          updateQuestion(idx, {
                            type: nextType,
                            options: undefined,
                          });
                        }
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

                {supportsOptions && (
                  <div className="space-y-2">
                    <Label htmlFor={`q-options-${question.id}`}>
                      {question.type === "select"
                        ? "Dropdown Options (one per line or separated by commas)"
                        : "Checkbox Options (optional — one per line or comma-separated)"}
                    </Label>
                    <Textarea
                      id={`q-options-${question.id}`}
                      rows={3}
                      placeholder={
                        question.type === "select"
                          ? "Option 1\nOption 2\nOption 3 (or Option 1, Option 2, Option 3)"
                          : "Leave blank for a single Yes/No checkbox, or list multiple options:\nConsulting\nTraining\nSupport"
                      }
                      value={rawText}
                      onChange={(e) =>
                        handleOptionsTextChange(idx, question.id, e.target.value)
                      }
                    />
                    {parsedOptions.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Options ({parsedOptions.length}):
                        </span>
                        {parsedOptions.map((opt, optIdx) => (
                          <Badge
                            key={`${opt}-${optIdx}`}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {opt}
                          </Badge>
                        ))}
                      </div>
                    ) : question.type === "checkbox" ? (
                      <p className="text-xs text-muted-foreground">
                        Renders as a single Yes/No checkbox. Add lines or comma-separated items above to turn it into a multi-select checklist.
                      </p>
                    ) : (
                      <p className="text-xs text-destructive">
                        Add at least one option for this dropdown.
                      </p>
                    )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
