'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SurfaceShell } from '@/components/dashboard/surface-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Send, Sparkles } from 'lucide-react';
import { type A2UINode, type A2UIAction } from '@/lib/a2ui';
import { renderInlineMarkdown } from '@/lib/markdown';
import { sanitizeHtml } from '@/lib/sanitize';
import { isAllowedMatrixUrl } from '@/lib/url-allow-list';

export interface A2UIRendererProps {
  node: A2UINode;
  /** A2UI protocol version emitted by the Agent (e.g. `"0.9"`). */
  schemaVersion?: string;
  /** True when the schema version is in the locally known set. */
  schemaRecognized?: boolean;
  /** True when at least one component type is not supported. */
  hasUnsupportedComponents?: boolean;
}

/**
 * Render an A2UI v0.9 node tree using shadcn / Radix primitives.
 * Action `submit` posts the form fields to the relative endpoint and
 * surfaces failures inline so the user can retry.
 *
 * Schema drift is surfaced as a soft banner above the render so the
 * user (and the developer console) can spot Agent upgrades before
 * they break the chat surface.
 */
export function A2UIRenderer({ node, schemaVersion, schemaRecognized, hasUnsupportedComponents }: A2UIRendererProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="my-1 space-y-2"
    >
      {(schemaVersion && !schemaRecognized) || hasUnsupportedComponents ? (
        <div
          className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300"
          role="status"
          aria-label="A2UI schema drift notice"
        >
          <Sparkles className="w-3 h-3 shrink-0" />
          <span>
            {schemaVersion && !schemaRecognized
              ? `A2UI schema ${schemaVersion} 未在此版本中验证 — 部分组件可能无法正确渲染。`
              : 'A2UI 文档包含未支持的组件类型。'}
          </span>
        </div>
      ) : null}
      <Node node={node} />
    </motion.div>
  );
}

function Node({ node }: { node: A2UINode }) {
  switch (node.kind) {
    case 'card':
      return (
        <SurfaceShell className="border-orange-500/20">
            {node.children.map((child, i) => (
              <Node key={i} node={child} />
            ))}
        </SurfaceShell>
      );
    case 'row':
      return (
        <div className="flex flex-row items-center gap-2">
          {node.children.map((child, i) => (
            <Node key={i} node={child} />
          ))}
        </div>
      );
    case 'column':
      return (
        <div className="flex flex-col gap-2">
          {node.children.map((child, i) => (
            <Node key={i} node={child} />
          ))}
        </div>
      );
    case 'text':
      if (node.markdown) {
        return (
          <div
            className="matrix-html-content text-sm"
            dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(node.text) }}
          />
        );
      }
      return <p className="text-sm text-foreground whitespace-pre-wrap">{node.text}</p>;
    case 'image': {
      const safeUrl = node.url && isAllowedMatrixUrl(node.url) ? node.url : '';
      if (!safeUrl) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground border border-border">
            <AlertCircle className="w-3 h-3" />
            Image URL not allowed
          </span>
        );
      }
      return (
        <img src={safeUrl} alt={sanitizeHtml(node.alt ?? '')} className="max-w-full rounded" />
      );
    }
    case 'button':
      return <ButtonNode label={node.label} action={node.action} />;
    case 'text-input':
      return <TextInputNode name={node.name} label={node.label} placeholder={node.placeholder} value={node.value} />;
    case 'form':
      return <FormNode submit={node.submit}>{node.children}</FormNode>;
    case 'unsupported':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground border border-border">
          <AlertCircle className="w-3 h-3" />
          Unsupported A2UI component: {node.componentType}
        </span>
      );
  }
}

function ButtonNode({ label, action }: { label: string; action?: A2UIAction }) {
  if (!action) {
    return (
      <Button size="sm" variant="outline" disabled>
        {label}
      </Button>
    );
  }
  return <FormSubmitButton label={label} action={action} />;
}

function FormSubmitButton({ label, action }: { label: string; action: A2UIAction }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(action.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body ?? {}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(text || `Request failed (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPending(false);
    }
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <Button size="sm" onClick={onClick} disabled={pending}>
        {pending ? 'Sending...' : label}
        {pending ? null : <Send className="w-3 h-3 ml-1" />}
      </Button>
      {error && (
        <span className="text-[10px] text-red-500">{error}</span>
      )}
    </span>
  );
}

function TextInputNode({
  name,
  label,
  placeholder,
  value,
}: {
  name: string;
  label?: string;
  placeholder?: string;
  value?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      {label && <span className="text-muted-foreground">{label}</span>}
      <Input name={name} defaultValue={value} placeholder={placeholder} className="h-8 text-xs" />
    </label>
  );
}

function FormNode({ children, submit }: { children: A2UINode[]; submit?: A2UIAction }) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (submit) {
          e.preventDefault();
          // Read form values from the closest form element and POST them
          // alongside the action body. The action body takes precedence on
          // key conflicts.
          const data = new FormData(e.currentTarget);
          const merged: Record<string, unknown> = { ...(submit.body ?? {}) };
          for (const [k, v] of data.entries()) merged[k] = v;
          void fetch(submit.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          });
        }
      }}
    >
      {children.map((child, i) => (
        <Node key={i} node={child} />
      ))}
      {submit && (
        <Button type="submit" size="sm" className="self-start">
          Submit
        </Button>
      )}
    </form>
  );
}