# EveryJob usability test kit

**Status:** Part J, item 5. Written 2026-10-17. For the founder to run.

This kit covers the 5-task usability test from the bar in `docs/PROMPTS-DESIGN.md`: 5 real tradespeople, on their own phones, no help. Target: at least 4 of 5 succeed at every task, with no critical errors. SUS average of 80 or higher.

## Before you start

- Test on production: `https://kivo-nine-silk.vercel.app`.
- Create one test business per participant (or reset the same one between sessions). Use a `QATEST` label in the business name so test data is easy to find and clean up later.
- Seed each test business with: 2 customers, 3 past jobs (one completed, one paid), 1 unpaid invoice, 1 upcoming job for tomorrow. The participant's tasks use this data.
- Each session takes 20 to 30 minutes: 5 tasks plus the SUS survey.

## Recruiting message

Send this to 5 tradespeople. You need a mix of iPhone and Android, and at least one French speaker.

> I am testing a new version of the EveryJob app and I need 5 tradespeople to try it for 20 to 30 minutes on their own phone. You will do 5 everyday tasks: create a job, send a quote, record a payment, find a past job, and reschedule a visit. There is nothing to install. I will watch over your shoulder or on a video call and take notes. Your business data stays yours and the test account is deleted after. Interested?

French version:

> Je teste une nouvelle version de l'application EveryJob et je cherche 5 gens de métier pour l'essayer 20 à 30 minutes sur leur propre téléphone. Vous ferez 5 tâches courantes : créer une tâche, envoyer une soumission, enregistrer un paiement, retrouver une ancienne tâche et déplacer une visite. Rien à installer. Je regarderai par-dessus votre épaule ou en appel vidéo et je prendrai des notes. Vos données restent à vous et le compte de test est supprimé après. Ça vous intéresse?

## Screening

- Runs a home-service business in Canada (1 to 5 people).
- Uses a smartphone for work at least weekly.
- Has never used EveryJob (fresh eyes; internal testers do not count).
- At least one participant primarily uses the app in French.

## The 5 tasks

Read the task out loud, then stay quiet. Do not help, hint, or touch their phone. If they ask for help, say: "Do what you would do if I were not here." Note the time each task takes and every error or wrong turn.

### Task 1. Create a job

"Your customer Marie Tremblay calls. Her kitchen sink is leaking. Create a job for tomorrow morning and assign it to yourself."

Success: a job exists for Marie Tremblay, scheduled for tomorrow, with a title describing the leak. The participant reaches the job detail or list and can see it.

### Task 2. Send a quote

"Marie also wants a price for replacing the faucet while you are there. Create a quote for $180 plus tax and send it to her."

Success: a quote for $180 (tax shown separately) exists and is marked sent, or the participant reaches the send confirmation. Note whether the tax breakdown was clear.

### Task 3. Record a payment

"You finished a job last week and the customer just paid $240 by e-transfer. Find the unpaid invoice and record the payment."

Success: the invoice shows as paid (or partially paid) for $240 with e-transfer as the method. Note whether they found the invoice without help.

### Task 4. Find a past job

"Marie asks what you charged her for the bathroom fan last spring. Find that job."

Success: the participant finds the past job using search or filters, and can read the amount. Note how long it took and whether they used search.

### Task 5. Reschedule a visit

"Tomorrow's job has to move to Thursday because of a parts delay. Reschedule it."

Success: the job's date is now Thursday. Note whether they used the schedule screen, the job detail, or another path.

## What counts as a critical error

- Charging or recording money against the wrong customer, job, or invoice.
- Deleting or voiding the wrong record.
- Sending a quote or invoice to the wrong person.
- Losing entered data (form cleared with no recovery).
- Any action the participant cannot undo or explain afterward.

One critical error fails that participant's task, even if they recover.

## Think-aloud script

Read this before task 1. Keep it short.

> There are no wrong answers here. I am testing the app, not you. As you work, please say out loud what you are looking at, what you are trying to do, and what you expect to happen before you tap. If something confuses you, say so. I will not help during the tasks, but I am taking notes on everything so we can fix it.

During tasks, use only neutral prompts:

- "What are you thinking?"
- "What did you expect to happen?"
- "Can you tell me what you are looking for?"

After task 5, ask:

- "Was there anything that surprised you?"
- "Was there a moment you felt stuck? What did you do?"
- "Is there anything missing that you would need on a real job day?"

Then hand them the SUS survey below.

## SUS questionnaire

The System Usability Scale. 10 statements, 1 (strongly disagree) to 5 (strongly agree). Keep the standard wording so the score compares to the published benchmark (average product: 68).

### English

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

### French

Working translation for the test. If you need a published validated version, get one before comparing against the benchmark.

1. Je pense que j'utiliserais ce système fréquemment.
2. J'ai trouvé ce système inutilement complexe.
3. J'ai trouvé ce système facile à utiliser.
4. Je pense que j'aurais besoin de l'aide d'une personne compétente pour utiliser ce système.
5. J'ai trouvé que les différentes fonctions de ce système étaient bien intégrées.
6. J'ai trouvé qu'il y avait trop d'incohérences dans ce système.
7. J'imagine que la plupart des gens apprendraient à utiliser ce système très rapidement.
8. J'ai trouvé ce système très lourd à utiliser.
9. Je me suis senti(e) très confiant(e) en utilisant ce système.
10. J'ai dû apprendre beaucoup de choses avant de pouvoir utiliser ce système.

### Scoring

- Odd-numbered items: score = response minus 1.
- Even-numbered items: score = 5 minus response.
- Add the 10 scores, multiply by 2.5. That is the SUS score (0 to 100).
- Average across the 5 participants. Target: 80 or higher.

## Results template

Copy this per participant, then fill the summary.

### Participant N

- Name:
- Phone: iPhone / Android (model if known)
- Language used: English / French
- Date:

| Task | Success (yes/no) | Time | Errors or wrong turns | Critical error (yes/no) |
|---|---|---|---|---|
| 1. Create a job | | | | |
| 2. Send a quote | | | | |
| 3. Record a payment | | | | |
| 4. Find a past job | | | | |
| 5. Reschedule a visit | | | | |

- SUS score:
- Quotes (their words):
- Surprises:
- Stuck moments:

### Summary (all 5 participants)

| Task | Succeeded (n/5) | Avg time | Critical errors | Pass (at least 4/5, no critical errors) |
|---|---|---|---|---|
| 1. Create a job | | | | |
| 2. Send a quote | | | | |
| 3. Record a payment | | | | |
| 4. Find a past job | | | | |
| 5. Reschedule a visit | | | | |

- SUS scores: _, _, _, _, _
- SUS average:
- SUS target met (80 or higher): yes / no

## After the test

Turn the results into fixes, per Part J:

1. Any task below 4 of 5, or any critical error, is a must-fix. Write the fix, add a test, and re-run that task with 2 new participants if the change is large.
2. SUS below 80: read the per-item scores. Low scores on items 2, 6, 8, 10 point at complexity; low scores on 3, 7, 9 point at learnability. Fix the pattern, not the screen.
3. Participant quotes go into the fix descriptions so the reason is never lost.
4. Record the final numbers in `docs/design/scorecard.md`.
