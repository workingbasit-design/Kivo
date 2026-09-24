import type { Dictionary } from '../en';

/**
 * Export buttons (CSV / Excel) shared by the Customers, Jobs, Quotes and
 * Invoices list pages, plus column headers for those exports.
 * Every key exists in both en and fr.
 */
const fragment = {
  en: {
    exports: {
      csv: 'Export CSV',
      excel: 'Export Excel',
      preparing: 'Preparing…',
      importBtn: 'Import CSV/Excel',
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
    },
  },
  fr: {
    exports: {
      csv: 'Exporter CSV',
      excel: 'Exporter Excel',
      preparing: 'Préparation…',
      importBtn: 'Importer CSV/Excel',
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
    },
  },
} as const;

export default fragment;
