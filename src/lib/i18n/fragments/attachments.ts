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
      delete: 'Delete',
      cancel: 'Cancel',
      uploaded: 'File uploaded.',
      deleted: 'Attachment deleted.',
      confirmDeleteTitle: 'Delete attachment?',
      confirmDelete: 'Delete “{name}”? This cannot be undone.',
      blobSetupTitle: 'Attachments aren’t available yet',
      blobSetupBody:
        'File uploads will show up here once file storage is turned on for your account. If you’re the account owner, connect file storage in your website dashboard (Vercel → Storage → Blob), save the token it gives you as an environment variable, and redeploy your site.',
      errors: {
        rateLimited: 'Too many requests. Please wait a moment and try again.',
        notConfigured: 'File uploads aren’t available yet. Please try again later.',
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
      delete: 'Supprimer',
      cancel: 'Annuler',
      uploaded: 'Fichier téléversé.',
      deleted: 'Pièce jointe supprimée.',
      confirmDeleteTitle: 'Supprimer la pièce jointe?',
      confirmDelete: 'Supprimer « {name} »? Cette action est irréversible.',
      blobSetupTitle: 'Les pièces jointes ne sont pas encore disponibles',
      blobSetupBody:
        'Le téléversement de fichiers apparaîtra ici une fois le stockage de fichiers activé pour votre compte. Si vous êtes le propriétaire du compte, connectez le stockage de fichiers dans votre tableau de bord (Vercel → Storage → Blob), enregistrez le jeton fourni comme variable d’environnement, puis redéployez votre site.',
      errors: {
        rateLimited: 'Trop de requêtes. Veuillez patienter un instant et réessayer.',
        notConfigured: 'Le téléversement de fichiers n’est pas encore disponible. Veuillez réessayer plus tard.',
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
