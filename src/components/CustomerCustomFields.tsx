'use client';

import CustomFieldsEditor from './CustomFieldsEditor';
import {
  listFieldDefs,
  createFieldDef,
  renameFieldDef,
  deleteFieldDef,
  setFieldValue,
  type CustomFieldDefRow,
  type CustomFieldValueRow,
} from '@/app/actions/custom-fields';
import type { Locale } from '@/lib/i18n';

/**
 * Customer custom fields — thin wrapper over the shared editor, passing
 * the customer actions unchanged (slice 6 extraction preserves the
 * original behavior exactly).
 */
export default function CustomerCustomFields({
  customerId,
  locale,
  initial,
}: {
  customerId: string;
  locale: Locale;
  initial: { defs: CustomFieldDefRow[]; values: CustomFieldValueRow[] };
}) {
  return (
    <CustomFieldsEditor
      recordId={customerId}
      locale={locale}
      initial={initial}
      titleKey="customfields.title"
      hintKey="customfields.hint"
      listAction={listFieldDefs}
      setAction={setFieldValue}
      createAction={createFieldDef}
      renameAction={renameFieldDef}
      deleteAction={deleteFieldDef}
    />
  );
}
