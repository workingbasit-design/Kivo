import type { Dictionary } from '../en';

/**
 * Track 6A strings: universal attachments (Vercel Blob).
 * Every key exists in both en and fr.
 */
const fragment = {
  en: {
    attachments: {
      title: 'Attachments',
      hint: 'Images, PDF or CSV up to 10 MB.',
      chooseFile: 'Choose file',
      uploadButton: 'Upload',
      uploading: 'Uploading…',
      noAttachments: 'No attachments yet.',
      openLabel: 'Open',
      deleteLabel: 'Delete',
      confirmDelete: 'Delete this attachment?',
      blobSetupTitle: 'File storage isn’t set up yet',
      blobSetupStep1: 'Create a Blob store in the Vercel dashboard (Storage → Create → Blob).',
      blobSetupStep2: 'Set BLOB_READ_WRITE_TOKEN as an environment variable and redeploy.',
      errors: {
        rateLimited: 'Too many requests. Please wait a moment and try again.',
        notConfigured: 'File storage is not configured on this server yet.',
        invalidEntity: 'Invalid attachment target.',
        entityNotFound: 'That record could not be found.',
        noFile: 'Please choose a file to upload.',
        notAFile: 'Please choose a file to upload.',
        empty: 'That file is empty.',
        tooLarge: 'Files must be 10 MB or smaller.',
        badType: 'Only images, PDFs and CSV files are allowed.',
        uploadFailed: 'Upload failed. Please try again.',
        notFound: 'Attachment not found.',
        deleteFailed: 'Could not delete the attachment.',
      },
    },
  },
  fr: {
    attachments: {
      title: 'Pièces jointes',
      hint: 'Images, PDF ou CSV jusqu’à 10 Mo.',
      chooseFile: 'Choisir un fichier',
      uploadButton: 'Téléverser',
      uploading: 'Téléversement…',
      noAttachments: 'Aucune pièce jointe pour l’instant.',
      openLabel: 'Ouvrir',
      deleteLabel: 'Supprimer',
      confirmDelete: 'Supprimer cette pièce jointe?',
      blobSetupTitle: 'Le stockage de fichiers n’est pas configuré',
      blobSetupStep1: 'Créez un magasin Blob dans le tableau de bord Vercel (Stockage → Créer → Blob).',
      blobSetupStep2: 'Définissez BLOB_READ_WRITE_TOKEN comme variable d’environnement, puis redéployez.',
      errors: {
        rateLimited: 'Trop de requêtes. Veuillez patienter un instant et réessayer.',
        notConfigured: 'Le stockage de fichiers n’est pas encore configuré sur ce serveur.',
        invalidEntity: 'Cible de pièce jointe invalide.',
        entityNotFound: 'Cet enregistrement est introuvable.',
        noFile: 'Veuillez choisir un fichier à téléverser.',
        notAFile: 'Veuillez choisir un fichier à téléverser.',
        empty: 'Ce fichier est vide.',
        tooLarge: 'Les fichiers doivent peser 10 Mo ou moins.',
        badType: 'Seules les images, les PDF et les CSV sont acceptés.',
        uploadFailed: 'Le téléversement a échoué. Veuillez réessayer.',
        notFound: 'Pièce jointe introuvable.',
        deleteFailed: 'Impossible de supprimer la pièce jointe.',
      },
    },
  },
} as const;

export default fragment;
