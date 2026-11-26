export interface SectionRoom {
  name: string;
  studentCount: number;
}

export interface SectionRoomDetail {
  section: string;
  rooms: SectionRoom[];
}

export interface Exam {
  courseCode: string;
  courseTitle: string;
  date: string;
  weekday: string;
  dayLabel: string;
  time: string;
  start: string;
  end: string;
  sectionCount: number;
  studentCount: number;
  rooms: string[];
  sectionRoomDetails: SectionRoomDetail[] | null;
}

export interface UnscheduledCourse {
  courseCode: string;
  courseTitle: string;
  studentCount: number;
  reason: string;
}

export interface ScheduleData {
  meta: {
    term: string;
    examYear: number;
    dateRange: { start: string; end: string };
    source: string;
    scheduledCourseCount: number;
    unscheduledCourseCount: number;
    reconciledSectionRoomCount: number;
    reviewedRoomRosterSheetCount: number;
    privacyNote: string;
    dateNote: string;
    roomNote: string;
    qualityNote: string;
  };
  exams: Exam[];
  unscheduled: UnscheduledCourse[];
}

export interface PlanSelection {
  courseCode: string;
  section: string;
}

export interface Conflict {
  first: Exam;
  second: Exam;
}

export function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function intervalsOverlap(first: Exam, second: Exam): boolean {
  if (first.date !== second.date) return false;
  return toMinutes(first.start) < toMinutes(second.end)
    && toMinutes(second.start) < toMinutes(first.end);
}

export function findConflicts(exams: Exam[]): Conflict[] {
  const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const conflicts: Conflict[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (sorted[j].date !== sorted[i].date) break;
      if (intervalsOverlap(sorted[i], sorted[j])) conflicts.push({ first: sorted[i], second: sorted[j] });
    }
  }
  return conflicts;
}

export function localExamDate(exam: Pick<Exam, 'date' | 'start'>): Date {
  const [year, month, day] = exam.date.split('-').map(Number);
  const [hour, minute] = exam.start.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function dateAtNoon(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return new Intl.DateTimeFormat('en', options).format(dateAtNoon(date));
}

export function formatTime(time: string): string {
  const [hourString, minute] = time.split(':');
  const hour = Number(hourString);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const shownHour = hour % 12 || 12;
  return `${shownHour}:${minute} ${suffix}`;
}

export function examsForSelection(exams: Exam[], selections: PlanSelection[]): Exam[] {
  const selectedCodes = new Set(selections.map((selection) => selection.courseCode));
  return exams.filter((exam) => selectedCodes.has(exam.courseCode))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export function getSectionForExam(exam: Exam, selections: PlanSelection[]): string {
  return selections.find((selection) => selection.courseCode === exam.courseCode)?.section ?? '';
}

export function getSectionRooms(exam: Exam, section: string): SectionRoom[] | null {
  if (!section || !exam.sectionRoomDetails) return null;
  return exam.sectionRoomDetails.find((detail) => detail.section === section)?.rooms ?? null;
}

export function monthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1, 12);
  const firstCell = new Date(year, monthIndex, 1 - first.getDay(), 12);
  return Array.from({ length: 42 }, (_, index) => new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index, 12));
}

export function createCalendarFile(exams: Exam[], selections: PlanSelection[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = examsForSelection(exams, selections).map((exam) => {
    const section = getSectionForExam(exam, selections);
    const sectionRooms = getSectionRooms(exam, section);
    const listedRooms = sectionRooms?.map((room) => room.name) ?? exam.rooms;
    const day = exam.date.replaceAll('-', '');
    const start = exam.start.replace(':', '') + '00';
    const end = exam.end.replace(':', '') + '00';
    const description = `${exam.courseTitle}${section ? `\nSection ${section}` : ''}\nListed rooms: ${listedRooms.join(', ')}\nTimes are local as listed in the source schedule.`;
    const uid = `${exam.courseCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${day}@examly.local`;
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${day}T${start}`,
      `DTEND:${day}T${end}`,
      `SUMMARY:${escapeICS(exam.courseCode)} · Final exam`,
      `DESCRIPTION:${escapeICS(description)}`,
      `LOCATION:${escapeICS(listedRooms.join(', '))}`,
      'END:VEVENT',
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EXAMLY//Fall 2026 Exam Plan//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
}

function escapeICS(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
