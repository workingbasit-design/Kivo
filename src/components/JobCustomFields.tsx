'use client';

import CustomFieldsEditor from './CustomFieldsEditor';
import {
  listJobFieldDefs,
  createFieldDef,
  renameFieldDef,
  deleteFieldDef,
  setJobFieldValue,
  type CustomFieldDefRow,
  type CustomFieldValueRow,
} from '@/app/actions/custom-fields';
import type { Locale } from '@/lib/i18n';

/** Slice 6: job custom fields (same editor, JOB actions). */
export default function JobCustomFields({
  jobId,
  locale,
  initial,
  fetchOnMount = false,
}: {
  jobId: string;
  locale: Locale;
  initial: { defs: CustomFieldDefRow[]; values: CustomFieldValueRow[] };
  fetchOnMount?: boolean;
}) {
  return (
    <CustomFieldsEditor
      recordId={jobId}
      locale={locale}
      initial={initial}
      titleKey="customfields.titleJob"
      hintKey="customfields.hintJob"
      fetchOnMount={fetchOnMount}
      listAction={listJobFieldDefs}
      setAction={setJobFieldValue}
      createAction={(name) => createFieldDef(name, 'JOB')}
      renameAction={renameFieldDef}
      deleteAction={deleteFieldDef}
    />
  );
}
