# Error catalogue (Part G)

Every error the app can show, with its user message in English and French. Written against docs/VOICE.md: say what happened, then what to do. No apologies, no jokes.

Total: 115 error strings across 26 files.

## attachments.ts

| Key | English | Français |
|---|---|---|
| `deleteFailed` | Could not delete the attachment. | Impossible de supprimer la pièce jointe. |
| `entityNotFound` | That record could not be found. | Cet enregistrement est introuvable. |
| `invalidEntity` | Invalid attachment target. | Cible de pièce jointe invalide. |
| `notFound` | Attachment not found. | Pièce jointe introuvable. |
| `uploadFailed` | Upload failed. Please try again. | Le téléversement a échoué. Veuillez réessayer. |

## attention.ts

| Key | English | Français |
|---|---|---|
| `micDenied` | Microphone blocked. Allow mic access in your browser settings, then tap again. | Micro bloqué. Autorisez l’accès au micro dans les réglages du navigateur, puis touchez de nouveau. |
| `micError` | Microphone trouble. Try again, or use the buttons below instead. | Problème de micro. Réessayez, ou utilisez les boutons ci-dessous. |

## billing.ts

| Key | English | Français |
|---|---|---|
| `amountInvalid` | Enter a valid amount. | Entrez un montant valide. |
| `jobNotFound` | Job not found. | Travail introuvable. |
| `labelRequired` | Milestone label is required. | Le libellé de l’étape est requis. |
| `loadError` | Could not load the invoice preview. Please try again. | Impossible de charger l’aperçu. Veuillez réessayer. |
| `someInvalid` | Some jobs are no longer eligible (already invoiced or not completed). Nothing was created. Refresh and try again. | Certains travaux ne sont plus admissibles (déjà facturés ou non terminés). Rien n’a été créé. Actualisez et réessayez. |

## crews.ts

| Key | English | Français |
|---|---|---|
| `crewRequired` | Select a crew or leave it empty. | Sélectionnez une équipe ou laissez vide. |

## customer-extras.ts

| Key | English | Français |
|---|---|---|
| `invalidAddress` | The property needs an address. | La propriété doit avoir une adresse. |
| `invalidLabel` | Give the property a label (up to 60 characters). | Donnez une étiquette à la propriété (60 caractères max). |
| `invalidName` | Field names need 1-40 characters. | Le nom du champ doit faire 1 à 40 caractères. |
| `invalidNotes` | Notes are too long (max 2000 characters). | Notes trop longues (2000 caractères max). |
| `saveFailed` | Could not save. Please try again. | Impossible d’enregistrer. Veuillez réessayer. |

## customer.ts

| Key | English | Français |
|---|---|---|
| `errorGeneric` | Something went wrong. Please try again. | Un problème est survenu. Veuillez réessayer. |

## google-auth.ts

| Key | English | Français |
|---|---|---|
| `ageRequired` | Please go back and confirm you are 18 or older before creating an account with Google. | Veuillez revenir en arrière et confirmer que vous avez 18 ans ou plus avant de créer un compte avec Google. |
| `phoneInvalid` | That doesn’t look like a valid Canadian number. Use a 10-digit number like (416) 555-1234. | Ce numéro ne semble pas valide au Canada. Utilisez un numéro à 10 chiffres comme (416) 555-1234. |
| `phoneRequired` | Please enter your contact number, or skip for now. | Veuillez entrer votre numéro de téléphone, ou passez cette étape. |
| `signInFailed` | Google sign-in failed. Please try again. | La connexion avec Google a échoué. Veuillez réessayer. |
| `signInFailedReason` | Google sign-in failed: {reason}. Please try again. | La connexion avec Google a échoué : {reason}. Veuillez réessayer. |

## google-reviews.ts

| Key | English | Français |
|---|---|---|
| `couldNotSave` | Could not save. | Enregistrement impossible. |
| `loadLocationsError` | Could not load locations. | Impossible de charger les établissements. |
| `statusDenied` | You declined the Google consent screen. Nothing was connected. | Vous avez refusé l’écran de consentement Google. Rien n’a été connecté. |
| `statusError` | Something went wrong with Google. Please try again. | Un problème est survenu avec Google. Veuillez réessayer. |
| `syncFailed` | Sync failed. | Échec de la synchro. |

## gps.ts

| Key | English | Français |
|---|---|---|
| `permissionDenied` | Location permission was denied. Allow location access in your browser to share. | La permission de localisation a été refusée. Autorisez l’accès à la position dans votre navigateur pour partager. |
| `pingFailed` | Could not send the location update. Will retry. | Impossible d’envoyer la mise à jour. Nouvel essai. |
| `trackingExpired` | This tracking link has expired or is invalid. | Ce lien de suivi a expiré ou est invalide. |

## imports.ts

| Key | English | Français |
|---|---|---|
| `errorLabel` | Error | Erreur |
| `errorsWillBeSkipped` | {count} rows with errors will be skipped | {count} lignes avec erreurs seront ignorées |
| `failedToRead` | Could not read that file. Please choose a .csv file. | Impossible de lire ce fichier. Veuillez choisir un fichier .csv. |
| `hasErrorsSkipped` | Some rows have errors and will be skipped | Certaines lignes ont des erreurs et seront ignorées |
| `importFailed` | Import failed. Please try again. | L’importation a échoué. Veuillez réessayer. |
| `loadFailed` | Could not load calendar events. | Impossible de charger les événements d’agenda. |
| `rowsWithErrors` | {count} row(s) with errors | {count} ligne(s) avec erreurs |

## integrations.ts

| Key | English | Français |
|---|---|---|
| `calendarSyncFailed` | Sync failed. Try reconnecting Google. | Échec de la synchro. Essayez de reconnecter Google. |
| `statusFailed` | Failed | Échoué |

## jobops.ts

| Key | English | Français |
|---|---|---|
| `expenseAmountInvalid` | Enter an amount greater than 0. | Entrez un montant supérieur à 0. |
| `expenseCategoryInvalid` | Pick a valid category. | Choisissez une catégorie valide. |
| `expenseDateInvalid` | Enter a valid date. | Entrez une date valide. |
| `expenseDescriptionRequired` | Enter a description for the expense. | Entrez une description pour la dépense. |
| `expenseInvalid` | Check the expense details and try again. | Vérifiez les détails de la dépense et réessayez. |
| `failed` | Could not create the review link. Please try again. | Impossible de créer le lien d’avis. Veuillez réessayer. |
| `itemLabelRequired` | Enter an item label. | Entrez un libellé. |
| `rateInvalid` | Enter a valid hourly rate (0 or more). | Entrez un taux horaire valide (0 ou plus). |
| `templateItemsRequired` | Add at least one item to the template. | Ajoutez au moins un élément au modèle. |
| `templateNameRequired` | Enter a template name (min 2 characters). | Entrez un nom de modèle (min. 2 caractères). |

## payments.ts

| Key | English | Français |
|---|---|---|
| `createError` | Could not create the payment link. Try again. | Impossible de créer le lien de paiement. Réessayez. |

## pricebook.ts

| Key | English | Français |
|---|---|---|
| `errorForbidden` | Your role cannot manage the price book. | Votre rôle ne peut pas gérer le livre de prix. |
| `errorInvalid` | Enter a name, a price of 0 or more, and a valid cost. | Entrez un nom, un prix de 0 ou plus, et un coût valide. |

## projects.ts

| Key | English | Français |
|---|---|---|
| `phaseNameRequired` | Give the phase a name. | Donnez un nom à la phase. |
| `titleRequired` | Give the project a name. | Donnez un nom au projet. |

## pwa.ts

| Key | English | Français |
|---|---|---|
| `denied` | Notifications are blocked. | Les notifications sont bloquées. |
| `deniedHelp` | Allow notifications for this site in your browser settings, then try again. | Autorisez les notifications pour ce site dans les réglages de votre navigateur, puis réessayez. |
| `subscribeFailed` |  | Impossible d’activer les notifications. Veuillez réessayer. |
| `testFailed` |  | Impossible d’envoyer la notification d’essai. |

## quickbooks.ts

| Key | English | Français |
|---|---|---|
| `statusInvalid` | The connection attempt expired. Please try again. | La tentative de connexion a expiré. Réessayez. |

## quote-items.ts

| Key | English | Français |
|---|---|---|
| `invalidAmount` | Enter an amount greater than 0. | Entrez un montant supérieur à 0. |
| `invalidDiscount` | That discount isn’t valid. | Ce rabais n’est pas valide. |
| `invalidItems` | Add at least one valid line item. | Ajoutez au moins un poste valide. |
| `invalidMethod` | Choose a valid payment method. | Choisissez une méthode de paiement valide. |
| `invalidNote` | Notes are too long (max 500 characters). | Notes trop longues (500 caractères max). |

## reminders.ts

| Key | English | Français |
|---|---|---|
| `invalidTime` | Please pick a valid time slot. | Veuillez choisir une plage horaire valide. |
| `slotsError` | Couldn’t load availability. Pick a date and try again, or request without a time. | Impossible de charger les disponibilités. Choisissez une date et réessayez, ou envoyez sans heure. |
| `timeRequired` | Please pick a time slot for your booking. | Veuillez choisir une plage horaire pour votre réservation. |

## reports.ts

| Key | English | Français |
|---|---|---|
| `invalidReport` | Please give the report a name. | Veuillez nommer le rapport. |
| `runError` | Could not build that report. Try rephrasing. | Impossible de générer ce rapport. Reformulez votre demande. |

## support.ts

| Key | English | Français |
|---|---|---|
| `formError` | Something went wrong sending your ticket. Please try again. | Un problème est survenu lors de l’envoi. Veuillez réessayer. |
| `formInvalid` | Please check the highlighted fields and try again. | Vérifiez les champs surlignés et réessayez. |

## track10-misc.ts

| Key | English | Français |
|---|---|---|
| `confirmError` | The job could not be booked. Please try again. | Le travail n’a pas pu être réservé. Veuillez réessayer. |
| `deniedShort` | Mic blocked. Allow access in browser settings. | Micro bloqué. Autorisez l’accès dans les réglages. |
| `dismissError` | Dismiss error | Ignorer l’erreur |
| `draftError` | Something went wrong. Please try again. | Une erreur s’est produite. Veuillez réessayer. |
| `error` |  | Je n’ai pas bien entendu. Réessayez dans un endroit plus calme. |
| `errorPrefix` | Couldn’t save: | Enregistrement impossible : |
| `logoFailed` | Logo upload failed. Please try again. | Échec du téléversement. Veuillez réessayer. |
| `notFoundDesc` | Please sign in again. | Veuillez vous reconnecter. |
| `notFoundTitle` | Business not found | Entreprise introuvable |
| `qrSaveError` | Your request could not be saved. Please try again in a minute. | Votre demande n’a pas pu être enregistrée. Veuillez réessayer dans une minute. |
| `reportReasonWrongInfo` | Wrong contact info or prices | Mauvaises coordonnées ou prix |
| `reviewLinkError` | Couldn’t create the link. Try again. | Impossible de créer le lien. Réessayez. |
| `sendError` | Something went wrong. Please try again. | Une erreur s’est produite. Veuillez réessayer. |

## track10-money.ts

| Key | English | Français |
|---|---|---|
| `actionFailed` | Something went wrong. Please try again. | Un problème est survenu. Veuillez réessayer. |
| `noticeExpiredBody` | The link may have been revoked, expired, or typed incorrectly. Please ask the business to send you a fresh link. | Le lien a peut-être été révoqué, expiré ou mal saisi. Demandez à l’entreprise de vous envoyer un nouveau lien. |
| `noticeExpiredTitle` | This link is expired or invalid | Ce lien est expiré ou invalide |
| `reviewTokenExpiredBody` | Review links are single-use and expire after 30 days. Ask {business} for a fresh link. | Les liens d’avis sont à usage unique et expirent après 30 jours. Demandez à {business} un nouveau lien. |
| `reviewTokenExpiredTitle` | This review link has expired | Ce lien d’avis a expiré |
| `reviewTokenInvalidBody` | It may have already been used. Ask {business} for a fresh review link. | Il a peut-être déjà été utilisé. Demandez à {business} un nouveau lien d’avis. |
| `reviewTokenInvalidTitle` | This review link isn’t valid | Ce lien d’avis n’est pas valide |

## track10-work.ts

| Key | English | Français |
|---|---|---|
| `checklistErrorDelete` | Could not remove the item. Please try again. | Impossible de retirer l\u2019élément. Réessayez. |
| `checklistErrorToggle` | Could not update the item. Please try again. | Impossible de mettre à jour l\u2019élément. Réessayez. |
| `expenseErrorDelete` | Could not remove the expense. Please try again. | Impossible de retirer la dépense. Réessayez. |
| `jobReviewLinkFailed` | Couldn’t create the review link. Try again. | Impossible de créer le lien d’avis. Réessayez. |
| `milestoneCreateError` | Could not create the invoice. Please try again. | Impossible de créer la facture. Réessayez. |
| `noteErrorDelete` | Could not delete the note. Please try again. | Impossible de supprimer la note. Réessayez. |
| `routesCouldNotLocate` | Could not locate ({count}) | Introuvables ({count}) |
| `routesGeocodeFailed` | address could not be geocoded | adresse introuvable |
| `schedErrorDelete` | Could not remove the job. Please try again. | Impossible de retirer le travail. Réessayez. |
| `schedErrorSeed` | Could not add sample jobs. Please try again. | Impossible d\u2019ajouter les travaux d\u2019exemple. Réessayez. |
| `schedErrorStatus` | Could not update the job. Please try again. | Impossible de mettre à jour le travail. Réessayez. |
| `statusErrorDelete` | Could not delete the job. Please try again. | Impossible de supprimer le travail. Réessayez. |
| `statusErrorUpdate` | Could not update the job. Please try again. | Impossible de mettre à jour le travail. Réessayez. |

## track8.ts

| Key | English | Français |
|---|---|---|
| `ruleNotFound` | Automation rule not found. | Règle d’automatisation introuvable. |

## track9.ts

| Key | English | Français |
|---|---|---|
| `connectFailed` | Stripe connection failed. Stripe is not set up on this server yet. The owner needs to add the platform keys (STRIPE_SECRET_KEY, STRIPE_CLIENT_ID) in Vercel, then redeploy. | Échec de la connexion Stripe. Stripe n’est pas encore configuré sur ce serveur. Le propriétaire doit ajouter les clés de plateforme (STRIPE_SECRET_KEY, STRIPE_CLIENT_ID) dans Vercel, puis redéployer. |
| `depositRequired` | Deposit required | Acompte requis |
| `emailVerifiedFailedBody` | This link is invalid or has expired. Request a new one from Settings → Messaging. | Ce lien est invalide ou a expiré. Demandez-en un nouveau dans Réglages → Messagerie. |
| `emailVerifiedFailedTitle` | Verification failed | Échec de la vérification |
| `payError` | Could not start checkout. Please try again or contact the business. | Impossible de démarrer le paiement. Réessayez ou contactez l’entreprise. |
| `reportFailed` | failed | échoués |
| `st_FAILED` | Failed | Échec |
| `totpRequiredNotice` | Enable two-factor authentication before connecting Stripe payments. | Activez l’authentification à deux facteurs avant de connecter les paiements Stripe. |

## en.ts / fr.ts (top level)

| Key | English | Français |
|---|---|---|
| `loadErrorTitle` | Couldn't load customers | Impossible de charger les clients |
| `loadErrorBody` | We couldn't load your customers just now. Your data is safe. Please try again. | Nous n'avons pas pu charger vos clients pour le moment. Vos données sont en sécurité. Veuillez réessayer. |
| `errorRetry` | Could not book the job. Please try again. | Impossible de réserver le travail. Veuillez réessayer. |
