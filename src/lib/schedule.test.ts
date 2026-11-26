import { describe, expect, it } from 'vitest';
import scheduleData from '../../public/data/exams.json';
import { findConflicts, intervalsOverlap, type Exam } from './schedule';
import { PREP_TASKS, summarizePrep } from './prep';

function exam(courseCode: string, date: string, start: string, end: string): Exam {
  return {
    courseCode,
    courseTitle: courseCode,
    date,
    weekday: 'SAT',
    dayLabel: 'SAT 2nd JAN',
    time: `${start}-${end}`,
    start,
    end,
    sectionCount: 1,
    studentCount: 1,
    rooms: ['G006-B'],
    sectionRoomDetails: null,
  };
}

describe('exam schedule data', () => {
  it('contains the complete, expected public schedule', () => {
    expect(scheduleData.exams).toHaveLength(243);
    expect(scheduleData.unscheduled).toHaveLength(56);
    expect(scheduleData.meta.reconciledSectionRoomCount).toBe(17);
  });

  it('contains no student identifiers or individual roster fields', () => {
    const serialized = JSON.stringify(scheduleData);
    expect(serialized).not.toMatch(/\b\d{7,}\b/);
    const forbiddenKey = /student.?id|roster.?id|instructor|student.?name/i;
    const inspectKeys = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(inspectKeys);
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          expect(key).not.toMatch(forbiddenKey);
          inspectKeys(child);
        }
      }
    };
    inspectKeys(scheduleData);
  });
});

describe('personal timetable conflicts', () => {
  it('detects overlapping exams on the same date', () => {
    const first = exam('MATH 201', '2027-01-02', '08:30', '10:30');
    const second = exam('CIE 239', '2027-01-02', '10:00', '12:00');
    expect(intervalsOverlap(first, second)).toBe(true);
    expect(findConflicts([first, second])).toHaveLength(1);
  });

  it('does not flag separate or back-to-back exam windows', () => {
    const first = exam('CIE 239', '2027-01-02', '08:30', '10:30');
    const nextSlot = exam('MATH 101', '2027-01-02', '10:30', '12:30');
    const otherDay = exam('DSAI 307', '2027-01-03', '08:30', '10:30');
    expect(findConflicts([first, nextSlot, otherDay])).toHaveLength(0);
  });
});

describe('course preparation tracker', () => {
  it('starts with four practical steps per selected course', () => {
    expect(PREP_TASKS).toHaveLength(4);
    expect(summarizePrep(['CIE 239'], {}).percent).toBe(0);
  });

  it('calculates readiness across selected courses only', () => {
    const summary = summarizePrep(['CIE 239', 'MATH 101'], {
      'CIE 239': [true, true, false, false],
      'MATH 101': [true, false, false, false],
      'PHYS 104': [true, true, true, true],
    });
    expect(summary).toEqual({ completed: 3, total: 8, percent: 38 });
  });
});
