'use client';

import React, { useState } from 'react';
import { Plus, Search, Calendar, FileText, Trash2 } from '@/components/icons';
import { Button, IconButton, Link } from './Button';
import { Input, Textarea, Select, DateField, TimeField, MoneyInput, PhoneInput, FieldWrapper } from './fields';
import { Checkbox, Radio, Switch, SegmentedControl } from './controls';
import { Banner, Toast, EmptyState, Skeleton, OfflineIndicator } from './feedback';
import { Dialog, ConfirmDialog, BottomSheet } from './overlays';
import { ListRow, Stat, Timeline, SectionHeader } from './lists';
import { SearchField, FilterChip, Tabs, ProgressChecklist } from './navigation';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-ej-ink mb-4 pb-2 border-b border-ej-border">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-32 shrink-0 text-sm font-semibold text-ej-secondary">{label}</span>
      <div className="flex flex-wrap items-center gap-3 flex-1">{children}</div>
    </div>
  );
}

export function DesignShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [switchOn, setSwitchOn] = useState(false);
  const [segment, setSegment] = useState('day');
  const [tab, setTab] = useState('all');
  const [chip, setChip] = useState('all');

  return (
    <div className="min-h-screen bg-ej-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-ej-ink mb-2">Design System</h1>
        <p className="text-base text-ej-secondary mb-8">
          EveryJob component library. All components use design tokens only.
          Interactive states are live — click, focus, and toggle them.
        </p>

        <Section title="Buttons">
          <Row label="Variants">
            <Button variant="primary"><Plus size={16} /> Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="destructive"><Trash2 size={16} /> Destructive</Button>
          </Row>
          <Row label="Sizes">
            <Button size="md">Medium (44px)</Button>
            <Button size="lg">Large (52px)</Button>
          </Row>
          <Row label="States">
            <Button loading>Loading keeps label</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <Row label="IconButton">
            <IconButton label="Search"><Search size={20} /></IconButton>
            <IconButton label="Calendar"><Calendar size={20} /></IconButton>
          </Row>
          <Row label="Link">
            <Link href="#">View all</Link>
            <Link href="#" variant="subtle">Subtle link</Link>
          </Row>
        </Section>

        <Section title="Form fields">
          <Input label="Customer name" hint="Full name as it appears on invoices" placeholder="e.g. Farha Ahmed" />
          <Input label="Required field" required error="This field is required" placeholder="Type something" />
          <Input label="Disabled" disabled placeholder="Cannot edit" />
          <Input label="Read only" readOnly value="Fixed value" />
          <Textarea label="Notes" hint="Optional details about the job" rows={3} />
          <Select
            label="Trade"
            options={[
              { value: '', label: 'Select a trade' },
              { value: 'plumbing', label: 'Plumbing' },
              { value: 'electrical', label: 'Electrical' },
            ]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateField label="Start date" />
            <TimeField label="Arrival time" />
          </div>
          <MoneyInput label="Contract price" hint="What the customer pays" />
          <PhoneInput label="Phone" />
        </Section>

        <Section title="Controls">
          <Checkbox label="Send receipt by email" hint="The customer gets a PDF copy" />
          <Radio label="Cash" name="payment" hint="Recorded immediately" />
          <Radio label="E-Transfer" name="payment" hint="Match when it arrives" />
          <Switch label="Enable notifications" hint="Get alerts for new jobs" checked={switchOn} onChange={(e) => setSwitchOn(e.target.checked)} />
          <SegmentedControl
            label="View"
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </Section>

        <Section title="Navigation">
          <SearchField label="Search jobs" placeholder="Search by customer or address" value="" onClear={() => {}} />
          <div className="flex gap-2 flex-wrap">
            <FilterChip label="All" selected={chip === 'all'} onClick={() => setChip('all')} count={12} />
            <FilterChip label="New" selected={chip === 'new'} onClick={() => setChip('new')} count={3} />
            <FilterChip label="Scheduled" selected={chip === 'scheduled'} onClick={() => setChip('scheduled')} count={5} />
          </div>
          <Tabs
            label="Invoice status"
            tabs={[
              { id: 'all', label: 'All' },
              { id: 'unpaid', label: 'Unpaid' },
              { id: 'paid', label: 'Paid' },
            ]}
            activeId={tab}
            onChange={setTab}
          />
          <ProgressChecklist
            title="Get set up"
            items={[
              { label: 'Add your first customer', done: true },
              { label: 'Create a job', done: false },
              { label: 'Send a quote', done: false },
            ]}
          />
        </Section>

        <Section title="Lists">
          <div className="border border-ej-border rounded-xl overflow-hidden">
            <ListRow title="Home cleaning" subtitle="Farha Ahmed · Tue, Sep 29" trailing="$120.00" href="#" />
            <ListRow title="Pipe repair" subtitle="John Smith · 3 days late" trailing="$85.00" onMenu={() => {}} menuLabel="Actions for Pipe repair" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Collected" timeRange="Last 7 days" value="$1,240.00" />
            <Stat label="Outstanding" timeRange="All unpaid" value="$860.00" hint="3 invoices" />
          </div>
          <Timeline
            items={[
              { title: 'Job created', timestamp: 'Oct 17, 2026 at 9:00 AM' },
              { title: 'Technician assigned', timestamp: 'Oct 17, 2026 at 9:15 AM', description: 'Mike assigned to the visit' },
            ]}
          />
          <SectionHeader title="Upcoming" action={<Link href="#">View all</Link>} />
        </Section>

        <Section title="Feedback">
          <Banner tone="info" title="Heads up" message="Your trial ends in 3 days." />
          <Banner tone="success" title="Payment recorded" message="Invoice INV-0001 is now paid." />
          <Banner tone="warning" title="Action needed" message="3 jobs are overdue." action={<Button variant="secondary" size="md">Review</Button>} />
          <Banner tone="error" title="Something went wrong" message="We could not save. Try again." onDismiss={() => {}} />
          <EmptyState
            icon={<FileText size={24} />}
            title="No jobs yet"
            description="Jobs you create will appear here."
            action={<Button variant="primary"><Plus size={16} /> New job</Button>}
          />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <OfflineIndicator />
          <Button variant="secondary" onClick={() => setToastVisible(true)}>Show toast</Button>
          {toastVisible && (
            <Toast
              message="Job deleted"
              actionLabel="Undo"
              onAction={() => setToastVisible(false)}
              onDismiss={() => setToastVisible(false)}
            />
          )}
        </Section>

        <Section title="Overlays">
          <div className="flex gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>Delete (confirm)</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open sheet</Button>
          </div>
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Job details">
            <p className="text-base text-ej-secondary">Dialog content goes here.</p>
          </Dialog>
          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => setConfirmOpen(false)}
            title="Delete invoice INV-0001?"
            message="This will permanently delete the invoice. This cannot be undone."
            confirmLabel="Delete invoice"
            destructive
          />
          <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Pick a date">
            <p className="text-base text-ej-secondary">Sheet content goes here.</p>
          </BottomSheet>
        </Section>

        <Section title="States reference">
          <p className="text-sm text-ej-secondary">
            All components support: default, hover (desktop), pressed, focus-visible,
            disabled, loading, error, success, selected, read-only. Toggle them above.
            Long text, French, 200% text size, and dark mode are verified in Part F.
          </p>
        </Section>
      </div>
    </div>
  );
}
