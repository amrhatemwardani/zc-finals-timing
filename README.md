# EXAMLY

EXAMLY is a static, student-facing exam planner for the Fall 2026 final exam window. It uses React, TypeScript, Vite, and Tailwind CSS, and is set up to deploy to GitHub Pages.

## Run it locally

Requirements: Node.js 24 and npm.

```bash
npm ci
npm run dev
```

Run the checks and production build with:

```bash
npm test
npm run build
```

## What students can do

- Search and filter the scheduled exam list, then choose courses and enter a section where the source provides one.
- View a personal calendar or agenda, the next exam countdown, exam days and free days, and any overlapping exam times.
- Edit or reset a plan. Course and section selections, plus the theme choice, stay in that browser’s local storage.
- Track prep progress with a four-step checklist for each selected course and an overall readiness percentage.
- Print or save an A4 timetable as PDF, or download selected exams as an `.ics` calendar file.
- Review courses marked as unscheduled and the reason in the source schedule.

There is no account, student ID field, backend, or database. The browser stores selected course codes, optional section labels, checklist completion, and the theme preference.

## Data and privacy

The original `Fall26_FinalExam_RoomLists.xlsx` is not part of this project and must not be added to the public repository. The site reads only the sanitized `public/data/exams.json` file. It contains course-level exam data and aggregate section-to-room counts for reconciled sheets; it contains no student identifiers or individual roster records.

The workbook labels exam days without a year. Its weekday labels align with January 2027, and its term is Fall 2026, so the site displays January 2–18, 2027. The source has 243 scheduled course rows and 56 entries marked as unscheduled.

The summary schedule lists course-level rooms. Of 38 detailed room roster sheets, 17 reconcile with the summary’s student totals, room counts, room list, section count, and capacity. Only those 17 contribute section-to-room summaries. For the other 21, EXAMLY keeps the course-level room list and withholds section-room detail. Section data cannot identify an individual seat or personal room assignment; students should confirm their exact room against the official roster. One roster sheet also lists a room with zero capacity; that sheet’s section-room details are withheld.

## GitHub Pages deployment

1. Create a GitHub repository and push this project to its `main` branch. Keep the original workbook out of the repository.
2. In the repository, open **Settings → Pages** and set the publishing source to **GitHub Actions**.
3. Push to `main` (or run **Build and deploy EXAMLY** from the Actions tab). The workflow installs dependencies, runs the tests, builds the site, and deploys `dist/` to Pages.
4. Open the deployment job in **Actions** to find the published URL.

The Vite build automatically sets the repository subpath for GitHub Pages, so no repository-name edit is needed. For details on the Pages workflow, see [GitHub’s custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
