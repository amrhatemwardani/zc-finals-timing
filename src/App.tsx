import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Grid2X2,
  Info,
  ListChecks,
  MapPin,
  Moon,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import {
  createCalendarFile,
  dateAtNoon,
  examsForSelection,
  findConflicts,
  formatDate,
  formatTime,
  getSectionForExam,
  getSectionRooms,
  localExamDate,
  monthGrid,
  type Exam,
  type PlanSelection,
  type ScheduleData,
} from './lib/schedule';
import { normalizePrepChecks, PREP_TASKS, summarizePrep, type PrepProgress } from './lib/prep';

const PLAN_KEY = 'examly-fall26-plan-v1';
const PREP_KEY = 'examly-fall26-prep-v1';
const THEME_KEY = 'examly-theme-v1';
const ALL_SCHEDULE_DATES = [
  '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05', '2027-01-09',
  '2027-01-10', '2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14',
  '2027-01-16', '2027-01-17', '2027-01-18',
];

type Theme = 'dark' | 'light';
type CalendarMode = 'calendar' | 'agenda';
type CalendarScope = 'mine' | 'all';

function loadPlan(): PlanSelection[] {
  try {
    const saved = localStorage.getItem(PLAN_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PlanSelection => (
      Boolean(entry)
      && typeof entry.courseCode === 'string'
      && typeof entry.section === 'string'
    ));
  } catch {
    return [];
  }
}

function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function loadPrepProgress(): PrepProgress {
  try {
    const saved = localStorage.getItem(PREP_KEY);
    if (!saved) return {};
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([courseCode, checks]) => (
      [courseCode, normalizePrepChecks(checks)]
    )));
  } catch {
    return {};
  }
}

function App() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selections, setSelections] = useState<PlanSelection[]>(loadPlan);
  const [prepProgress, setPrepProgress] = useState<PrepProgress>(loadPrepProgress);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [query, setQuery] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [shownCourses, setShownCourses] = useState(8);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('calendar');
  const [calendarScope, setCalendarScope] = useState<CalendarScope>('all');
  const [selectedDate, setSelectedDate] = useState('2027-01-02');
  const [unscheduledQuery, setUnscheduledQuery] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/exams.json`)
      .then((response) => {
        if (!response.ok) throw new Error('Schedule file could not be loaded.');
        return response.json() as Promise<ScheduleData>;
      })
      .then((schedule) => { if (alive) setData(schedule); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PLAN_KEY, JSON.stringify(selections)); } catch { /* Private browsing can disable storage. */ }
  }, [selections]);

  useEffect(() => {
    try { localStorage.setItem(PREP_KEY, JSON.stringify(prepProgress)); } catch { /* Progress still works for this visit. */ }
  }, [prepProgress]);

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* Theme still works for this visit. */ }
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const allExams = useMemo(() => data
    ? [...data.exams].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.courseCode.localeCompare(b.courseCode))
    : [], [data]);
  const planExams = useMemo(() => examsForSelection(allExams, selections), [allExams, selections]);
  const planPrepSummary = useMemo(() => summarizePrep(selections.map(({ courseCode }) => courseCode), prepProgress), [selections, prepProgress]);
  const conflicts = useMemo(() => findConflicts(planExams), [planExams]);
  const calendarExams = calendarScope === 'mine' ? planExams : allExams;
  const calendarDates = monthGrid(2027, 0);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, Exam[]>();
    for (const exam of calendarExams) grouped.set(exam.date, [...(grouped.get(exam.date) ?? []), exam]);
    return grouped;
  }, [calendarExams]);
  const selectedDayExams = eventsByDate.get(selectedDate) ?? [];
  const nextExam = planExams.find((exam) => localExamDate(exam).getTime() >= clockNow);
  const daysUntil = nextExam
    ? Math.max(0, Math.ceil((localExamDate(nextExam).getTime() - clockNow) / 86_400_000))
    : null;
  const windowOpensIn = allExams[0]
    ? Math.max(0, Math.ceil((localExamDate(allExams[0]).getTime() - clockNow) / 86_400_000))
    : null;
  const busyDays = new Set(planExams.map((exam) => exam.date));
  const freeDays = ALL_SCHEDULE_DATES.length - busyDays.size;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredExams = allExams.filter((exam) => {
    const matchesText = !normalizedQuery
      || `${exam.courseCode} ${exam.courseTitle}`.toLowerCase().includes(normalizedQuery);
    const matchesDay = dayFilter === 'all' || exam.date === dayFilter;
    return matchesText && matchesDay;
  });
  const visibleExams = filteredExams.slice(0, shownCourses);
  const filteredUnscheduled = (data?.unscheduled ?? []).filter((course) => (
    !unscheduledQuery
    || `${course.courseCode} ${course.courseTitle} ${course.reason}`.toLowerCase().includes(unscheduledQuery.toLowerCase())
  ));

  function addCourse(exam: Exam) {
    if (selections.some((selection) => selection.courseCode === exam.courseCode)) return;
    setSelections((current) => [...current, { courseCode: exam.courseCode, section: '' }]);
    setCalendarScope('mine');
    setSelectedDate(exam.date);
  }

  function removeCourse(courseCode: string) {
    setSelections((current) => current.filter((selection) => selection.courseCode !== courseCode));
    setPrepProgress((current) => {
      const next = { ...current };
      delete next[courseCode];
      return next;
    });
  }

  function updateSection(courseCode: string, section: string) {
    setSelections((current) => current.map((selection) => (
      selection.courseCode === courseCode ? { ...selection, section } : selection
    )));
  }

  function resetPlan() {
    setSelections([]);
    setPrepProgress({});
    setCalendarScope('all');
    setSelectedDate('2027-01-02');
  }

  function updatePrep(courseCode: string, taskIndex: number, complete: boolean) {
    setPrepProgress((current) => {
      const checks = normalizePrepChecks(current[courseCode]);
      checks[taskIndex] = complete;
      return { ...current, [courseCode]: checks };
    });
  }

  function exportCalendar() {
    if (planExams.length === 0) return;
    const file = new Blob([createCalendarFile(allExams, selections)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'examly-fall-2026-exams.ics';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loadError) {
    return <div className="load-screen"><div className="load-card"><span className="brand-mark">E</span><h1>Schedule took a wrong turn.</h1><p>Refresh in a moment. The timetable data could not be loaded.</p><button className="button button-primary" onClick={() => window.location.reload()}>Try again <ArrowRight size={16} /></button></div></div>;
  }

  if (!data) {
    return <div className="load-screen"><div className="loader-mark"><span className="brand-mark">E</span><span className="loader-dot" /></div><p>Getting your dates in order…</p></div>;
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="EXAMLY home"><span className="brand-mark">E</span><span>EXAMLY</span><span className="brand-period">/ 26</span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#planner" className="nav-link active">Your plan <span className="nav-dot" /></a>
          <a href="#schedule" className="nav-link">Calendar</a>
          <a href="#unscheduled" className="nav-link">No final exam</a>
        </nav>
        <div className="top-actions">
          <span className="term-chip"><span className="pulse-dot" />FALL '26</span>
          <button className="icon-button theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero content-width">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" />THE FINALS PLANNER, REBOOTED</div>
            <h1>Finals,<br /><span>figured out.</span></h1>
            <p className="hero-subtitle">All the dates. Your courses. One less thing to panic about.</p>
            <div className="hero-actions">
              <a href="#planner" className="button button-primary">Build my timetable <ArrowDown size={16} /></a>
              <span className="no-id-note"><Check size={14} />No ID needed</span>
            </div>
            <div className="hero-footnote"><span className="mono-label">01—18 JAN 2027</span><span className="footnote-divider" />A calmer finals era starts here.</div>
          </div>

          <div className="hero-visual" aria-label="Final exam schedule overview">
            <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <div className="hero-sticker sticker-spark">✳</div>
            <div className="hero-sticker sticker-smile">: )</div>
            <div className="hero-schedule-card">
              <div className="card-topline"><span><span className="live-dot" />LIVE SCHEDULE</span><span className="mono-label">F26</span></div>
              <div className="hero-card-date"><span className="mono-label">THE WINDOW OPENS IN</span><strong>{windowOpensIn === null ? '—' : `${windowOpensIn}`}<small>{windowOpensIn === 1 ? 'DAY' : 'DAYS'}</small></strong><span className="hero-card-date-label">SAT, 02 JAN 2027 · 08:30</span></div>
              <div className="hero-card-divider" />
              <div className="hero-stat-row"><div><b>{data.meta.scheduledCourseCount}</b><span>scheduled</span></div><div><b>13</b><span>exam days</span></div><div><b>{data.meta.unscheduledCourseCount}</b><span>no final</span></div></div>
              <div className="hero-card-bottom"><span>MAKE SPACE FOR WHAT'S NEXT</span><span className="card-arrow"><ArrowUpRight size={16} /></span></div>
            </div>
            <div className="visual-caption"><span className="caption-mark">✳</span> YOUR SEMESTER, DECODED</div>
          </div>
        </section>

        <div className="ticker" aria-hidden="true"><div className="ticker-track"><span>LESS SCROLLING, MORE SLEEP</span><i>✳</i><span>YOUR EXAMS, YOUR WAY</span><i>✳</i><span>LESS SCROLLING, MORE SLEEP</span><i>✳</i><span>YOUR EXAMS, YOUR WAY</span><i>✳</i><span>LESS SCROLLING, MORE SLEEP</span><i>✳</i></div></div>

        <section className="main-section content-width" id="planner">
          <div className="section-heading">
            <div><div className="eyebrow section-eyebrow"><span className="section-index">01</span>YOUR PERSONAL FINALS BOARD</div><h2>Make it <span>yours.</span></h2></div>
            <p>Pick your courses and sections. We’ll do the calendar math.<br /><span>Saved on this device. No account, no awkward forms.</span></p>
          </div>

          <div className="planner-grid">
            <section className="picker-panel panel" aria-labelledby="course-picker-title">
              <div className="panel-heading">
                <div><span className="panel-kicker">THE SHORTLIST</span><h3 id="course-picker-title">Add your courses<span className="lime-period">.</span></h3></div>
                <span className="count-pill">{selections.length.toString().padStart(2, '0')} ADDED</span>
              </div>
              <div className="filter-row">
                <label className="search-box"><Search size={17} /><span className="sr-only">Search courses</span><input value={query} onChange={(event) => { setQuery(event.target.value); setShownCourses(8); }} placeholder="Course code or title" /></label>
                <label className="select-box"><span className="sr-only">Filter by exam date</span><CalendarDays size={15} /><select value={dayFilter} onChange={(event) => { setDayFilter(event.target.value); setShownCourses(8); }}><option value="all">All dates</option>{ALL_SCHEDULE_DATES.map((date) => <option value={date} key={date}>{formatDate(date, { month: 'short', day: 'numeric' })}</option>)}</select><ChevronDown size={14} /></label>
              </div>
              <div className="results-meta"><span>{filteredExams.length} MATCH{filteredExams.length === 1 ? '' : 'ES'}</span><span>243 COURSES IN THE MIX</span></div>
              <div className="course-results" aria-live="polite">
                {visibleExams.map((exam) => {
                  const selected = selections.some((selection) => selection.courseCode === exam.courseCode);
                  return <CourseRow key={exam.courseCode} exam={exam} selected={selected} onAdd={() => addCourse(exam)} />;
                })}
                {visibleExams.length === 0 && <div className="empty-results"><span className="empty-icon"><Search size={18} /></span><strong>No matches found</strong><span>Try a shorter code or another date.</span><button className="text-button" onClick={() => { setQuery(''); setDayFilter('all'); }}>Clear search</button></div>}
              </div>
              {filteredExams.length > visibleExams.length && <button className="load-more" onClick={() => setShownCourses((count) => count + 8)}>Load 8 more <span>({filteredExams.length - visibleExams.length} left)</span><ArrowDown size={14} /></button>}
              <div className="picker-footer"><span><span className="tiny-spark">✳</span> You can change these any time.</span><span className="mono-label">{data.meta.scheduledCourseCount} EXAMS</span></div>
            </section>

            <section className="plan-panel panel" aria-labelledby="your-plan-title">
              <div className="panel-heading plan-heading">
                <div><span className="panel-kicker">YOUR CALL SHEET</span><h3 id="your-plan-title">Your plan<span className="lime-period">.</span></h3></div>
                <div className="plan-tools">
                  <button className="icon-button subtle-button" onClick={resetPlan} disabled={selections.length === 0} aria-label="Reset selections" title="Reset your selections"><RotateCcw size={15} /></button>
                  <button className="icon-button subtle-button" onClick={() => window.print()} disabled={planExams.length === 0} aria-label="Print or save as PDF" title="Print or save as PDF"><Printer size={15} /></button>
                  <button className="icon-button subtle-button" onClick={exportCalendar} disabled={planExams.length === 0} aria-label="Export calendar file" title="Export calendar file"><Download size={15} /></button>
                </div>
              </div>

              {planExams.length > 0 ? <>
                <div className="plan-summary">
                  <div className="summary-next"><div className="summary-label"><Zap size={13} fill="currentColor" /> NEXT UP</div>{nextExam ? <><strong>{daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}</strong><span>{nextExam.courseCode} · {formatDate(nextExam.date, { month: 'short', day: 'numeric' })}</span></> : <><strong>That’s a wrap.</strong><span>All selected exam dates have passed.</span></>}</div>
                  <div className="summary-stats"><div><b>{planExams.length.toString().padStart(2, '0')}</b><span>EXAMS</span></div><div><b>{busyDays.size.toString().padStart(2, '0')}</b><span>BUSY DAYS</span></div><div><b>{freeDays.toString().padStart(2, '0')}</b><span>FREE DAYS</span></div></div>
                </div>
                <div className="prep-progress-strip" aria-label={`${planPrepSummary.percent}% of preparation checklist completed`}>
                  <div className="prep-progress-top"><span><ListChecks size={14} />PREP PROGRESS</span><strong>{planPrepSummary.percent}%</strong></div>
                  <div className="prep-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={planPrepSummary.percent}><span style={{ width: `${planPrepSummary.percent}%` }} /></div>
                  <div className="prep-progress-bottom"><span>{planPrepSummary.completed} of {planPrepSummary.total} steps checked</span><span>Saved on this device</span></div>
                </div>
                {conflicts.length > 0 && <div className="conflict-alert"><span className="conflict-icon">!</span><div><strong>{conflicts.length} time clash{conflicts.length === 1 ? '' : 'es'} to review</strong><span>{conflicts.slice(0, 2).map(({ first, second }) => `${first.courseCode} + ${second.courseCode}`).join(' · ')}</span></div></div>}
              </> : <div className="plan-empty"><div className="empty-orbit"><Grid2X2 size={21} /></div><div><strong>Your slate is still blank.</strong><span>Add a course on the left to get the good overview.</span></div><span className="empty-arrow">↖</span></div>}

              <div className="selected-list">
                {selections.map((selection) => {
                  const exam = allExams.find((item) => item.courseCode === selection.courseCode);
                  if (!exam) return null;
                  return <SelectedCourse key={exam.courseCode} exam={exam} section={selection.section} prepChecks={prepProgress[exam.courseCode]} onSection={(section) => updateSection(exam.courseCode, section)} onRemove={() => removeCourse(exam.courseCode)} onPrep={(taskIndex, complete) => updatePrep(exam.courseCode, taskIndex, complete)} />;
                })}
              </div>

              <div className="plan-data-note"><Info size={15} /><span>Rooms shown are course or section listings. Your personal room isn’t determined by this planner.</span><button onClick={() => setShowNotes((show) => !show)} aria-expanded={showNotes}>{showNotes ? 'Hide' : 'Why?'} <ArrowRight size={12} /></button></div>
              {showNotes && <div className="source-note-inline">Only 17 of 38 room roster sheets reconcile with the course summary. Section-room details appear only for those 17; all other courses show the summary’s course-level rooms. Check your official roster for your exact assigned room.</div>}
            </section>
          </div>
        </section>

        <section className="calendar-section content-width" id="schedule">
          <div className="section-heading calendar-heading">
            <div><div className="eyebrow section-eyebrow"><span className="section-index violet-index">02</span>THE DATES THAT MATTER</div><h2>See the <span>shape</span> of it.</h2></div>
            <div className="calendar-mode-switch" role="tablist" aria-label="Calendar view">
              <button role="tab" aria-selected={calendarMode === 'calendar'} className={calendarMode === 'calendar' ? 'mode-active' : ''} onClick={() => setCalendarMode('calendar')}><Grid2X2 size={15} />Calendar</button>
              <button role="tab" aria-selected={calendarMode === 'agenda'} className={calendarMode === 'agenda' ? 'mode-active' : ''} onClick={() => setCalendarMode('agenda')}><CalendarDays size={15} />Agenda</button>
            </div>
          </div>
          <div className="calendar-grid panel">
            <div className="calendar-main">
              <div className="calendar-toolbar">
                <div><span className="panel-kicker">THE EXAM WINDOW</span><h3>January <span>2027</span></h3></div>
                <div className="scope-switch" role="group" aria-label="Choose which exams to show"><button className={calendarScope === 'mine' ? 'scope-active' : ''} onClick={() => setCalendarScope('mine')}>My plan <span>{planExams.length}</span></button><button className={calendarScope === 'all' ? 'scope-active' : ''} onClick={() => setCalendarScope('all')}>All exams</button></div>
              </div>
              {calendarMode === 'calendar' ? <>
                <div className="weekday-row">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => <span key={day}>{day}</span>)}</div>
                <div className="calendar-cells">
                  {calendarDates.map((day) => {
                    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                    const count = eventsByDate.get(iso)?.length ?? 0;
                    const inMonth = day.getMonth() === 0;
                    const daySelected = selectedDate === iso;
                    return <button key={iso} disabled={!inMonth} className={`calendar-cell ${inMonth ? '' : 'outside-month'} ${daySelected ? 'day-selected' : ''} ${count > 0 ? 'has-exam' : ''}`} onClick={() => { setSelectedDate(iso); if (count > 0) document.getElementById('day-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }} aria-label={`${formatDate(iso, { weekday: 'long', month: 'long', day: 'numeric' })}${count ? `, ${count} exams` : ''}`}>
                      <span>{day.getDate()}</span>{count > 0 && <i className="calendar-indicator">{count > 9 ? '9+' : count}</i>}
                    </button>;
                  })}
                </div>
              </> : <AgendaList exams={calendarExams} selections={selections} onSelectDate={(date) => { setSelectedDate(date); setCalendarMode('calendar'); }} />}
              <div className="calendar-legend"><span><i className="legend-lime" />Exam day</span><span><i className="legend-violet" />Selected date</span><span className="calendar-source">13 exam days · 02—18 Jan</span></div>
            </div>
            <aside className="day-detail" id="day-detail">
              <div className="detail-top"><span className="panel-kicker">{calendarScope === 'mine' ? 'YOUR DAY' : 'ON THE GRID'}</span><span className="detail-day-number">{dateAtNoon(selectedDate).getDate().toString().padStart(2, '0')}</span></div>
              <h3>{formatDate(selectedDate, { weekday: 'long', month: 'long' })}<span>,</span><br /><em>2027</em></h3>
              {selectedDayExams.length > 0 ? <>
                <div className="day-exam-count">{selectedDayExams.length} EXAM{selectedDayExams.length === 1 ? '' : 'S'} {calendarScope === 'mine' ? 'IN YOUR PLAN' : 'ON THE SCHEDULE'}</div>
                <div className="day-exam-list">
                  {selectedDayExams.slice(0, 7).map((exam) => <DayExam key={exam.courseCode} exam={exam} section={getSectionForExam(exam, selections)} />)}
                  {selectedDayExams.length > 7 && <span className="more-exams">+ {selectedDayExams.length - 7} more in this slot list</span>}
                </div>
              </> : <div className="day-empty"><span>◌</span><strong>{calendarScope === 'mine' && planExams.length === 0 ? 'Add a course to see your day.' : ALL_SCHEDULE_DATES.includes(selectedDate) ? 'No exams in your plan.' : 'No exams scheduled.'}</strong><button onClick={() => { if (calendarScope === 'mine' && planExams.length === 0) setCalendarScope('all'); }}>Browse the schedule <ArrowRight size={13} /></button></div>}
              <div className="day-detail-bottom"><span className="mono-label">LOCAL EXAM TIMES</span><span className="calendar-mini-logo">E.</span></div>
            </aside>
          </div>
          <div className="calendar-bottom-note"><span className="note-star">✳</span><span>Weekends are in the mix. Your selected dates get the spotlight.</span><span className="mono-label">F26 / JAN 2027</span></div>
        </section>

        <section className="unscheduled-section content-width" id="unscheduled">
          <div className="unscheduled-card">
            <div className="unscheduled-intro"><span className="section-index coral-index">03</span><div><div className="eyebrow">A HEADS-UP, NOT A SURPRISE</div><h2>No final<br /><span>exam listed.</span></h2><p>These courses are marked as unscheduled in the source file. Check the note beside each one before making plans.</p></div><span className="unscheduled-count">{data.meta.unscheduledCourseCount.toString().padStart(2, '0')}<small>COURSES</small></span></div>
            <div className="unscheduled-content">
              <div className="unscheduled-toolbar"><div><span className="panel-kicker">SOURCE STATUS</span><strong>{filteredUnscheduled.length} courses listed</strong></div><label className="search-box unscheduled-search"><Search size={16} /><span className="sr-only">Search courses without a final exam</span><input value={unscheduledQuery} onChange={(event) => setUnscheduledQuery(event.target.value)} placeholder="Find a course" /></label></div>
              <div className="unscheduled-list">
                {filteredUnscheduled.slice(0, 9).map((course) => <article className="unscheduled-row" key={course.courseCode}><div className="unscheduled-code">{course.courseCode}</div><div className="unscheduled-title">{course.courseTitle}<span>{course.studentCount} students in source summary</span></div><div className="reason-chip">{course.reason}</div></article>)}
                {filteredUnscheduled.length === 0 && <div className="empty-unscheduled">No matches. Try a course code.</div>}
              </div>
              {filteredUnscheduled.length > 9 && <details className="more-unscheduled"><summary>Show all {filteredUnscheduled.length} entries <ChevronDown size={14} /></summary><div>{filteredUnscheduled.slice(9).map((course) => <article className="unscheduled-row" key={course.courseCode}><div className="unscheduled-code">{course.courseCode}</div><div className="unscheduled-title">{course.courseTitle}<span>{course.studentCount} students in source summary</span></div><div className="reason-chip">{course.reason}</div></article>)}</div></details>}
              <div className="unscheduled-footnote"><Info size={14} />“No final exam listed” follows the workbook’s reason. Confirm course requirements with your department.</div>
            </div>
          </div>
        </section>

        <section className="closing-band content-width">
          <div className="closing-spark">✳</div><div><span className="eyebrow">YOU'VE GOT THIS</span><h2>Make a plan.<br /><span>Then go live your life.</span></h2></div><a href="#top" className="back-top">Back to top <ArrowUpRight size={16} /></a>
        </section>
      </main>

      <footer className="site-footer content-width"><a className="wordmark footer-brand" href="#top"><span className="brand-mark">E</span><span>EXAMLY</span><span className="brand-period">/ 26</span></a><span>Built for the in-between moments.</span><button onClick={() => { setShowNotes(true); document.getElementById('planner')?.scrollIntoView({ behavior: 'smooth' }); }}><Info size={14} />Source & privacy notes</button><span className="footer-year">FALL '26 · JAN '27</span></footer>
      <div className="print-header"><span className="wordmark"><span className="brand-mark">E</span><span>EXAMLY</span></span><span>FALL 2026 · PERSONAL EXAM TIMETABLE</span></div>
      <section className="print-only print-plan" aria-label="Printable personal timetable">
        <h1>My exam timetable</h1><p>Fall 2026 finals · January 2027 · Times are local as listed in the source schedule.</p>
        {planExams.length === 0 ? <p>No courses selected yet. Return to EXAMLY to build your timetable.</p> : planExams.map((exam) => {
          const section = getSectionForExam(exam, selections);
          const sectionRooms = getSectionRooms(exam, section);
          return <article className="print-exam" key={exam.courseCode}><div className="print-date">{formatDate(exam.date, { weekday: 'long', month: 'long', day: 'numeric' })}</div><div><h2>{exam.courseCode} · {exam.courseTitle}</h2><p>{exam.time} · {section ? `Section ${section} · ` : ''}{(sectionRooms?.map((room) => room.name) ?? exam.rooms).join(', ')}</p><small>Course/section room listing only. Confirm your personal assignment against the official roster.</small></div></article>;
        })}
        <p className="print-footer">EXAMLY · No student ID is collected or required.</p>
      </section>
    </div>
  );
}

function CourseRow({ exam, selected, onAdd }: { exam: Exam; selected: boolean; onAdd: () => void }) {
  return <article className={`course-row ${selected ? 'course-added' : ''}`}>
    <div className="course-date-block"><span>{formatDate(exam.date, { month: 'short' }).toUpperCase()}</span><strong>{dateAtNoon(exam.date).getDate().toString().padStart(2, '0')}</strong></div>
    <div className="course-row-copy"><div className="course-row-top"><strong>{exam.courseCode}</strong><span>{exam.weekday}</span></div><p>{exam.courseTitle}</p><div className="course-row-meta"><span><Clock3 size={12} />{exam.time}</span><span><MapPin size={12} />{exam.rooms.length} room{exam.rooms.length === 1 ? '' : 's'}</span></div></div>
    <button className={`add-course-button ${selected ? 'added' : ''}`} onClick={onAdd} disabled={selected} aria-label={selected ? `${exam.courseCode} added` : `Add ${exam.courseCode}`} title={selected ? 'Added to your plan' : 'Add to your plan'}>{selected ? <Check size={16} /> : <Plus size={17} />}</button>
  </article>;
}

function SelectedCourse({ exam, section, prepChecks, onSection, onRemove, onPrep }: { exam: Exam; section: string; prepChecks: boolean[] | undefined; onSection: (section: string) => void; onRemove: () => void; onPrep: (taskIndex: number, complete: boolean) => void }) {
  const sectionDetails = exam.sectionRoomDetails;
  const checks = normalizePrepChecks(prepChecks);
  const completedTasks = checks.filter(Boolean).length;
  return <article className="selected-course">
    <div className="selected-course-main"><span className="selected-check"><Check size={13} /></span><div className="selected-course-name"><strong>{exam.courseCode}</strong><span>{formatDate(exam.date, { month: 'short', day: 'numeric' })} · {exam.time}</span></div><button className="remove-course" onClick={onRemove} aria-label={`Remove ${exam.courseCode}`} title="Remove course"><X size={15} /></button></div>
    <div className="section-choice"><label htmlFor={`section-${exam.courseCode}`}>YOUR SECTION</label>{sectionDetails ? <select id={`section-${exam.courseCode}`} value={section} onChange={(event) => onSection(event.target.value)}><option value="">Choose your section</option>{sectionDetails.map((detail) => <option key={detail.section} value={detail.section}>Section {detail.section}</option>)}</select> : <input id={`section-${exam.courseCode}`} value={section} onChange={(event) => onSection(event.target.value)} placeholder="Optional · not listed in source" />}<span>{sectionDetails ? 'Section details verified' : `${exam.sectionCount} section${exam.sectionCount === 1 ? '' : 's'} listed · labels not provided`}</span></div>
    <details className="prep-accordion">
      <summary><span className="prep-summary-icon"><ListChecks size={12} /></span><span className="prep-summary-label">PREP CHECKLIST</span><span className="prep-summary-count">{completedTasks}/{PREP_TASKS.length}</span><span className="prep-mini-track"><i style={{ width: `${(completedTasks / PREP_TASKS.length) * 100}%` }} /></span><ChevronDown size={13} /></summary>
      <div className="prep-task-list">
        {PREP_TASKS.map((task, index) => <label className={`prep-task ${checks[index] ? 'task-done' : ''}`} key={task.id}><input type="checkbox" checked={checks[index]} onChange={(event) => onPrep(index, event.target.checked)} /><span className="prep-checkbox"><Check size={10} /></span><span>{task.label}</span></label>)}
        <small>Quick reminders only. Your progress stays on this device.</small>
      </div>
    </details>
  </article>;
}

function DayExam({ exam, section }: { exam: Exam; section: string }) {
  const rooms = getSectionRooms(exam, section);
  const listedRooms = rooms?.map((room) => `${room.name} (${room.studentCount})`).join(', ');
  return <article className="day-exam"><div className="day-exam-time"><span>{formatTime(exam.start)}</span><i /></div><div className="day-exam-copy"><strong>{exam.courseCode}</strong><span>{exam.courseTitle}</span><small>{section ? `Section ${section} · ` : ''}{rooms ? `Section rooms: ${listedRooms}` : `Course rooms: ${exam.rooms.join(', ')}`}</small></div></article>;
}

function AgendaList({ exams, selections, onSelectDate }: { exams: Exam[]; selections: PlanSelection[]; onSelectDate: (date: string) => void }) {
  if (exams.length === 0) return <div className="agenda-empty"><span>◌</span><strong>No exams in this view.</strong><span>Add courses or switch to all exams.</span></div>;
  const dates = [...new Set(exams.map((exam) => exam.date))];
  const shownDates = dates.slice(0, 5);
  return <div className="agenda-list">
    {shownDates.map((date) => <button className="agenda-day" key={date} onClick={() => onSelectDate(date)}><span className="agenda-date"><b>{dateAtNoon(date).getDate().toString().padStart(2, '0')}</b><small>{formatDate(date, { weekday: 'short', month: 'short' }).toUpperCase()}</small></span><span className="agenda-day-events">{exams.filter((exam) => exam.date === date).slice(0, 3).map((exam) => <span key={exam.courseCode}><i />{formatTime(exam.start)} <b>{exam.courseCode}</b></span>)}{exams.filter((exam) => exam.date === date).length > 3 && <small>+ {exams.filter((exam) => exam.date === date).length - 3} more</small>}</span><ArrowRight size={14} /></button>)}
    {dates.length > 5 && <span className="agenda-caption">Showing 5 of {dates.length} exam days. Select a date to explore it.</span>}
    {selections.length === 0 && <span className="agenda-caption">This is the public exam agenda.</span>}
  </div>;
}

export default App;
