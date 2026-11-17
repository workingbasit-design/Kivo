import type { Dictionary } from '../en';

/**
 * Export buttons (CSV) shared by the Customers, Jobs, Quotes and
 * Invoices list pages, plus column headers for those exports.
 * Every key exists in both en and fr.
 * 2026-10-15: the Excel export was removed (unpatched high-severity
 * advisories in the xlsx package); the `excel` key is kept for now so
 * older cached clients don't break, but nothing renders it.
 */
const fragment = {
  en: {
    exports: {
      csv: 'Export CSV',
      excel: 'Export Excel',
      preparing: 'Preparing…',
      title: 'Accounting export',
      subtitle: 'Export your data for QuickBooks, Xero, or Wave.',
      exported: 'Exported: {summary}',
      failed: 'Export failed.',
      exporting: 'Exporting…',
      importBtn: 'Import CSV',
      colName: 'Name',
      colPhone: 'Phone',
      colEmail: 'Email',
      colAddress: 'Address',
      colTags: 'Tags',
      colJobs: 'Jobs',
      colRevenue: 'Revenue',
      colTitle: 'Title',
      colCustomer: 'Customer',
      colDate: 'Date',
      colTime: 'Time',
      colStatus: 'Status',
      colPrice: 'Price',
      colNumber: 'Number',
      colTotal: 'Total',
      colType: 'Type',
      colDescription: 'Description',
      colAmount: 'Amount',
    },
  },
  fr: {
    exports: {
      csv: 'Exporter CSV',
      excel: 'Exporter Excel',
      preparing: 'Préparation…',
      title: 'Export comptable',
      subtitle: 'Exportez vos données pour QuickBooks, Xero ou Wave.',
      exported: 'Exporté: {summary}',
      failed: 'Échec de l’export.',
      exporting: 'Export…',
      importBtn: 'Importer CSV',
      colName: 'Nom',
      colPhone: 'Téléphone',
      colEmail: 'Courriel',
      colAddress: 'Adresse',
      colTags: 'Étiquettes',
      colJobs: 'Travaux',
      colRevenue: 'Revenus',
      colTitle: 'Titre',
      colCustomer: 'Client',
      colDate: 'Date',
      colTime: 'Heure',
      colStatus: 'Statut',
      colPrice: 'Prix',
      colNumber: 'Numéro',
      colTotal: 'Total',
      colType: 'Type',
      colDescription: 'Description',
      colAmount: 'Montant',
    },
  },
} as const;

export default fragment;
