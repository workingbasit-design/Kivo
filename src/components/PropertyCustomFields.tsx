'use client';

import CustomFieldsEditor from './CustomFieldsEditor';
import {
  listPropertyFieldDefs,
  createFieldDef,
  renameFieldDef,
  deleteFieldDef,
  setPropertyFieldValue,
  type CustomFieldDefRow,
  type CustomFieldValueRow,
} from '@/app/actions/custom-fields';
import type { Locale } from '@/lib/i18n';

/** Slice 6: property custom fields (same editor, PROPERTY actions). */
export default function PropertyCustomFields({
  propertyId,
  locale,
  initial,
  fetchOnMount = false,
}: {
  propertyId: string;
  locale: Locale;
  initial: { defs: CustomFieldDefRow[]; values: CustomFieldValueRow[] };
  fetchOnMount?: boolean;
}) {
  return (
    <CustomFieldsEditor
      recordId={propertyId}
      locale={locale}
      initial={initial}
      titleKey="customfields.titleProperty"
      hintKey="customfields.hintProperty"
      fetchOnMount={fetchOnMount}
      listAction={listPropertyFieldDefs}
      setAction={setPropertyFieldValue}
      createAction={(name) => createFieldDef(name, 'PROPERTY')}
      renameAction={renameFieldDef}
      deleteAction={deleteFieldDef}
    />
  );
}
