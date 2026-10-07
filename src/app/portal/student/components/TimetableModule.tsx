"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Sun,
  Coffee,
  Moon,
  Layers,
  GraduationCap,
  Zap,
  Info,
} from "lucide-react";
import { TierPresentationConfig } from "../types";

interface TimetableModuleProps {
  tierConfig: TierPresentationConfig;
  studentClass: string;
  studentName: string;
}

type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI";

interface Period {
  time: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  type: "LESSON" | "BREAK" | "ASSEMBLY" | "LAB" | "SPORT" | "FREE" | "LECTURE" | "TUTORIAL" | "ACTIVITY";
  color: string;
  units?: number; // For higher ed
}

type DaySchedule = Period[];
type WeekSchedule = Record<DayKey, DaySchedule>;

// ─────────────────────────────────────────────────────────────────────────────
// Tier-Adaptive Timetable Data
// ─────────────────────────────────────────────────────────────────────────────

const SECONDARY_TIMETABLE: WeekSchedule = {
  MON: [
    { time: "7:45", endTime: "8:00", subject: "Morning Assembly", teacher: "School Authority", room: "Assembly Hall", type: "ASSEMBLY", color: "amber" },
    { time: "8:00", endTime: "9:00", subject: "Mathematics", teacher: "Mr. Adewale Okafor", room: "Block A – Room 5", type: "LESSON", color: "indigo" },
    { time: "9:00", endTime: "10:00", subject: "English Language", teacher: "Mrs. Chisom Nwosu", room: "Block A – Room 5", type: "LESSON", color: "purple" },
    { time: "10:00", endTime: "10:20", subject: "Short Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:20", endTime: "11:20", subject: "Physics", teacher: "Mr. Emeka Eze", room: "Science Lab 1", type: "LAB", color: "sky" },
    { time: "11:20", endTime: "12:20", subject: "Chemistry", teacher: "Mrs. Fatima Bello", room: "Science Lab 2", type: "LAB", color: "emerald" },
    { time: "12:20", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Cafeteria", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "Civic Education", teacher: "Mr. Kunle Adeyemi", room: "Block A – Room 5", type: "LESSON", color: "rose" },
    { time: "14:00", endTime: "15:00", subject: "Digital Technologies / ICT", teacher: "Mrs. Grace Okoro", room: "Computer Lab", type: "LESSON", color: "violet" },
  ],
  TUE: [
    { time: "7:45", endTime: "8:00", subject: "Morning Assembly", teacher: "School Authority", room: "Assembly Hall", type: "ASSEMBLY", color: "amber" },
    { time: "8:00", endTime: "9:00", subject: "Biology", teacher: "Dr. Amina Hassan", room: "Science Lab 3", type: "LAB", color: "green" },
    { time: "9:00", endTime: "10:00", subject: "Technical Drawing", teacher: "Mr. Segun Alabi", room: "Drawing Studio", type: "LESSON", color: "orange" },
    { time: "10:00", endTime: "10:20", subject: "Short Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:20", endTime: "11:20", subject: "Mathematics", teacher: "Mr. Adewale Okafor", room: "Block A – Room 5", type: "LESSON", color: "indigo" },
    { time: "11:20", endTime: "12:20", subject: "English Language", teacher: "Mrs. Chisom Nwosu", room: "Block A – Room 5", type: "LESSON", color: "purple" },
    { time: "12:20", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Cafeteria", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "15:00", subject: "Sports & Physical Education", teacher: "Coach Tunde Bassey", room: "Sports Field", type: "SPORT", color: "teal" },
  ],
  WED: [
    { time: "7:45", endTime: "8:00", subject: "Morning Assembly", teacher: "School Authority", room: "Assembly Hall", type: "ASSEMBLY", color: "amber" },
    { time: "8:00", endTime: "9:00", subject: "Chemistry", teacher: "Mrs. Fatima Bello", room: "Science Lab 2", type: "LAB", color: "emerald" },
    { time: "9:00", endTime: "10:00", subject: "Physics", teacher: "Mr. Emeka Eze", room: "Science Lab 1", type: "LAB", color: "sky" },
    { time: "10:00", endTime: "10:20", subject: "Short Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:20", endTime: "11:20", subject: "Biology", teacher: "Dr. Amina Hassan", room: "Science Lab 3", type: "LAB", color: "green" },
    { time: "11:20", endTime: "12:20", subject: "Digital Technologies / ICT", teacher: "Mrs. Grace Okoro", room: "Computer Lab", type: "LESSON", color: "violet" },
    { time: "12:20", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Cafeteria", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "Civic Education", teacher: "Mr. Kunle Adeyemi", room: "Block A – Room 5", type: "LESSON", color: "rose" },
    { time: "14:00", endTime: "15:00", subject: "Free / Study Period", teacher: "", room: "Library", type: "FREE", color: "slate" },
  ],
  THU: [
    { time: "7:45", endTime: "8:00", subject: "Morning Assembly", teacher: "School Authority", room: "Assembly Hall", type: "ASSEMBLY", color: "amber" },
    { time: "8:00", endTime: "9:00", subject: "Technical Drawing", teacher: "Mr. Segun Alabi", room: "Drawing Studio", type: "LESSON", color: "orange" },
    { time: "9:00", endTime: "10:00", subject: "Mathematics", teacher: "Mr. Adewale Okafor", room: "Block A – Room 5", type: "LESSON", color: "indigo" },
    { time: "10:00", endTime: "10:20", subject: "Short Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:20", endTime: "11:20", subject: "English Language", teacher: "Mrs. Chisom Nwosu", room: "Block A – Room 5", type: "LESSON", color: "purple" },
    { time: "11:20", endTime: "12:20", subject: "Biology", teacher: "Dr. Amina Hassan", room: "Science Lab 3", type: "LAB", color: "green" },
    { time: "12:20", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Cafeteria", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "Chemistry", teacher: "Mrs. Fatima Bello", room: "Science Lab 2", type: "LAB", color: "emerald" },
    { time: "14:00", endTime: "15:00", subject: "Physics", teacher: "Mr. Emeka Eze", room: "Science Lab 1", type: "LAB", color: "sky" },
  ],
  FRI: [
    { time: "7:45", endTime: "8:00", subject: "Morning Assembly", teacher: "School Authority", room: "Assembly Hall", type: "ASSEMBLY", color: "amber" },
    { time: "8:00", endTime: "9:00", subject: "Digital Technologies / ICT", teacher: "Mrs. Grace Okoro", room: "Computer Lab", type: "LESSON", color: "violet" },
    { time: "9:00", endTime: "10:00", subject: "Mathematics", teacher: "Mr. Adewale Okafor", room: "Block A – Room 5", type: "LESSON", color: "indigo" },
    { time: "10:00", endTime: "10:20", subject: "Short Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:20", endTime: "11:20", subject: "English Language", teacher: "Mrs. Chisom Nwosu", room: "Block A – Room 5", type: "LESSON", color: "purple" },
    { time: "11:20", endTime: "12:20", subject: "Civic Education", teacher: "Mr. Kunle Adeyemi", room: "Block A – Room 5", type: "LESSON", color: "rose" },
    { time: "12:20", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Cafeteria", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "Technical Drawing", teacher: "Mr. Segun Alabi", room: "Drawing Studio", type: "LESSON", color: "orange" },
    { time: "14:00", endTime: "15:00", subject: "Sports & Physical Education", teacher: "Coach Tunde Bassey", room: "Sports Field", type: "SPORT", color: "teal" },
  ],
};

const PRIMARY_TIMETABLE: WeekSchedule = {
  MON: [
    { time: "8:00", endTime: "8:15", subject: "Morning Circle Time", teacher: "Class Teacher", room: "Classroom", type: "ASSEMBLY", color: "amber" },
    { time: "8:15", endTime: "9:15", subject: "Mathematics", teacher: "Mrs. Blessing Okonkwo", room: "Class 4B", type: "LESSON", color: "indigo" },
    { time: "9:15", endTime: "10:15", subject: "English Studies", teacher: "Mrs. Joy Adaeze", room: "Class 4B", type: "LESSON", color: "purple" },
    { time: "10:15", endTime: "10:30", subject: "Break Time", teacher: "", room: "Playground", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "11:30", subject: "Basic Science & Technology", teacher: "Mr. David Nwachukwu", room: "Class 4B", type: "LESSON", color: "sky" },
    { time: "11:30", endTime: "12:30", subject: "National Values Education", teacher: "Mrs. Patricia Obi", room: "Class 4B", type: "LESSON", color: "rose" },
    { time: "12:30", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Dining Hall", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "Basic Digital Literacy", teacher: "Mr. Kingsley Agu", room: "Computer Lab", type: "LESSON", color: "violet" },
  ],
  TUE: [
    { time: "8:00", endTime: "8:15", subject: "Morning Circle Time", teacher: "Class Teacher", room: "Classroom", type: "ASSEMBLY", color: "amber" },
    { time: "8:15", endTime: "9:15", subject: "English Studies", teacher: "Mrs. Joy Adaeze", room: "Class 4B", type: "LESSON", color: "purple" },
    { time: "9:15", endTime: "10:15", subject: "Cultural & Creative Arts", teacher: "Mrs. Ngozi Ekwueme", room: "Art Room", type: "ACTIVITY", color: "orange" },
    { time: "10:15", endTime: "10:30", subject: "Break Time", teacher: "", room: "Playground", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "11:30", subject: "Mathematics", teacher: "Mrs. Blessing Okonkwo", room: "Class 4B", type: "LESSON", color: "indigo" },
    { time: "11:30", endTime: "12:30", subject: "Basic Science & Technology", teacher: "Mr. David Nwachukwu", room: "Class 4B", type: "LESSON", color: "sky" },
    { time: "12:30", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Dining Hall", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "Physical & Health Education", teacher: "Coach Samuel Eze", room: "Sports Yard", type: "SPORT", color: "teal" },
  ],
  WED: [
    { time: "8:00", endTime: "8:15", subject: "Morning Circle Time", teacher: "Class Teacher", room: "Classroom", type: "ASSEMBLY", color: "amber" },
    { time: "8:15", endTime: "9:15", subject: "Basic Digital Literacy", teacher: "Mr. Kingsley Agu", room: "Computer Lab", type: "LESSON", color: "violet" },
    { time: "9:15", endTime: "10:15", subject: "Mathematics", teacher: "Mrs. Blessing Okonkwo", room: "Class 4B", type: "LESSON", color: "indigo" },
    { time: "10:15", endTime: "10:30", subject: "Break Time", teacher: "", room: "Playground", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "11:30", subject: "National Values Education", teacher: "Mrs. Patricia Obi", room: "Class 4B", type: "LESSON", color: "rose" },
    { time: "11:30", endTime: "12:30", subject: "English Studies", teacher: "Mrs. Joy Adaeze", room: "Class 4B", type: "LESSON", color: "purple" },
    { time: "12:30", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Dining Hall", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "Cultural & Creative Arts", teacher: "Mrs. Ngozi Ekwueme", room: "Art Room", type: "ACTIVITY", color: "orange" },
  ],
  THU: [
    { time: "8:00", endTime: "8:15", subject: "Morning Circle Time", teacher: "Class Teacher", room: "Classroom", type: "ASSEMBLY", color: "amber" },
    { time: "8:15", endTime: "9:15", subject: "Basic Science & Technology", teacher: "Mr. David Nwachukwu", room: "Class 4B", type: "LESSON", color: "sky" },
    { time: "9:15", endTime: "10:15", subject: "Mathematics", teacher: "Mrs. Blessing Okonkwo", room: "Class 4B", type: "LESSON", color: "indigo" },
    { time: "10:15", endTime: "10:30", subject: "Break Time", teacher: "", room: "Playground", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "11:30", subject: "English Studies", teacher: "Mrs. Joy Adaeze", room: "Class 4B", type: "LESSON", color: "purple" },
    { time: "11:30", endTime: "12:30", subject: "Basic Digital Literacy", teacher: "Mr. Kingsley Agu", room: "Computer Lab", type: "LESSON", color: "violet" },
    { time: "12:30", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Dining Hall", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "National Values Education", teacher: "Mrs. Patricia Obi", room: "Class 4B", type: "LESSON", color: "rose" },
  ],
  FRI: [
    { time: "8:00", endTime: "8:15", subject: "Morning Circle Time", teacher: "Class Teacher", room: "Classroom", type: "ASSEMBLY", color: "amber" },
    { time: "8:15", endTime: "9:15", subject: "Cultural & Creative Arts", teacher: "Mrs. Ngozi Ekwueme", room: "Art Room", type: "ACTIVITY", color: "orange" },
    { time: "9:15", endTime: "10:15", subject: "English Studies", teacher: "Mrs. Joy Adaeze", room: "Class 4B", type: "LESSON", color: "purple" },
    { time: "10:15", endTime: "10:30", subject: "Break Time", teacher: "", room: "Playground", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "11:30", subject: "Mathematics", teacher: "Mrs. Blessing Okonkwo", room: "Class 4B", type: "LESSON", color: "indigo" },
    { time: "11:30", endTime: "12:30", subject: "Physical & Health Education", teacher: "Coach Samuel Eze", room: "Sports Yard", type: "SPORT", color: "teal" },
    { time: "12:30", endTime: "13:00", subject: "Lunch Break", teacher: "", room: "Dining Hall", type: "BREAK", color: "slate" },
    { time: "13:00", endTime: "14:00", subject: "Free Period / Reading Time", teacher: "", room: "Library", type: "FREE", color: "slate" },
  ],
};

const HIGHER_ED_TIMETABLE: WeekSchedule = {
  MON: [
    { time: "8:00", endTime: "10:00", subject: "MTH 111 – Logic & Linear Algebra", teacher: "Prof. Babatunde Olatunji", room: "LT – Block C, Hall 1", type: "LECTURE", color: "indigo", units: 3 },
    { time: "10:00", endTime: "10:30", subject: "Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "12:30", subject: "COS 101 – Introduction to Computer Science", teacher: "Dr. Efosa Osagie", room: "LT – ICT Building, Hall 2", type: "LECTURE", color: "violet", units: 3 },
    { time: "12:30", endTime: "14:00", subject: "Lunch / Prayer Break", teacher: "", room: "Student Union", type: "BREAK", color: "slate" },
    { time: "14:00", endTime: "16:00", subject: "PHY 111 – General Physics I (Mechanics)", teacher: "Prof. Ibrahim Lawal", room: "Physics Lab A", type: "LAB", color: "sky", units: 3 },
  ],
  TUE: [
    { time: "8:00", endTime: "10:00", subject: "GST 111 – Use of English & Library Skills", teacher: "Dr. Mary Okafor", room: "LT – Humanities Block", type: "LECTURE", color: "purple", units: 2 },
    { time: "10:00", endTime: "10:30", subject: "Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "12:30", subject: "CHM 111 – General Chemistry I", teacher: "Prof. Ngozi Ekezie", room: "Chemistry Lab 3", type: "LAB", color: "emerald", units: 3 },
    { time: "12:30", endTime: "14:00", subject: "Lunch / Prayer Break", teacher: "", room: "Student Union", type: "BREAK", color: "slate" },
    { time: "14:00", endTime: "15:00", subject: "MTH 111 – Tutorial Session", teacher: "Mr. Chukwuma Nweke (TA)", room: "Tutorial Room 4", type: "TUTORIAL", color: "indigo", units: 3 },
  ],
  WED: [
    { time: "8:00", endTime: "10:00", subject: "COS 101 – Lab Session", teacher: "Dr. Efosa Osagie", room: "Computer Science Lab", type: "LAB", color: "violet", units: 3 },
    { time: "10:00", endTime: "10:30", subject: "Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "12:30", subject: "MTH 111 – Logic & Linear Algebra", teacher: "Prof. Babatunde Olatunji", room: "LT – Block C, Hall 1", type: "LECTURE", color: "indigo", units: 3 },
    { time: "12:30", endTime: "14:00", subject: "Lunch / Prayer Break", teacher: "", room: "Student Union", type: "BREAK", color: "slate" },
    { time: "14:00", endTime: "15:00", subject: "Free Period / Independent Study", teacher: "", room: "University Library", type: "FREE", color: "slate" },
  ],
  THU: [
    { time: "8:00", endTime: "10:00", subject: "PHY 111 – General Physics I", teacher: "Prof. Ibrahim Lawal", room: "Physics Lecture Hall", type: "LECTURE", color: "sky", units: 3 },
    { time: "10:00", endTime: "10:30", subject: "Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "12:30", subject: "CHM 111 – Tutorial & Problem Solving", teacher: "Dr. Angela Obi (TA)", room: "Tutorial Room 2", type: "TUTORIAL", color: "emerald", units: 3 },
    { time: "12:30", endTime: "14:00", subject: "Lunch / Prayer Break", teacher: "", room: "Student Union", type: "BREAK", color: "slate" },
    { time: "14:00", endTime: "16:00", subject: "GST 111 – Practical: Library & Research Skills", teacher: "Dr. Mary Okafor", room: "University Library", type: "LECTURE", color: "purple", units: 2 },
  ],
  FRI: [
    { time: "8:00", endTime: "10:00", subject: "GST 111 – Use of English", teacher: "Dr. Mary Okafor", room: "LT – Humanities Block", type: "LECTURE", color: "purple", units: 2 },
    { time: "10:00", endTime: "10:30", subject: "Break", teacher: "", room: "", type: "BREAK", color: "slate" },
    { time: "10:30", endTime: "12:30", subject: "PHY 111 – Physics Lab Practical", teacher: "Prof. Ibrahim Lawal", room: "Physics Lab B", type: "LAB", color: "sky", units: 3 },
    { time: "12:30", endTime: "14:00", subject: "Jumu'ah / Lunch Break", teacher: "", room: "Student Union", type: "BREAK", color: "slate" },
    { time: "14:00", endTime: "15:00", subject: "Faculty Seminar / Open Elective", teacher: "Various Faculty", room: "Seminar Room A", type: "TUTORIAL", color: "rose" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Styling helpers
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string; badge: string }> = {
  indigo:  { bg: "bg-indigo-950/60", border: "border-indigo-500/40", text: "text-indigo-200", dot: "bg-indigo-400", badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  purple:  { bg: "bg-purple-950/60", border: "border-purple-500/40", text: "text-purple-200", dot: "bg-purple-400", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  sky:     { bg: "bg-sky-950/60",    border: "border-sky-500/40",    text: "text-sky-200",    dot: "bg-sky-400",    badge: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  emerald: { bg: "bg-emerald-950/60",border: "border-emerald-500/40",text: "text-emerald-200",dot: "bg-emerald-400",badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  green:   { bg: "bg-green-950/60",  border: "border-green-500/40",  text: "text-green-200",  dot: "bg-green-400",  badge: "bg-green-500/20 text-green-300 border-green-500/30" },
  rose:    { bg: "bg-rose-950/60",   border: "border-rose-500/40",   text: "text-rose-200",   dot: "bg-rose-400",   badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  orange:  { bg: "bg-orange-950/60", border: "border-orange-500/40", text: "text-orange-200", dot: "bg-orange-400", badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  amber:   { bg: "bg-amber-950/60",  border: "border-amber-500/40",  text: "text-amber-200",  dot: "bg-amber-400",  badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  violet:  { bg: "bg-violet-950/60", border: "border-violet-500/40", text: "text-violet-200", dot: "bg-violet-400", badge: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  teal:    { bg: "bg-teal-950/60",   border: "border-teal-500/40",   text: "text-teal-200",   dot: "bg-teal-400",   badge: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  slate:   { bg: "bg-slate-800/40",  border: "border-slate-700/30",  text: "text-slate-400",  dot: "bg-slate-500",  badge: "bg-slate-700/40 text-slate-400 border-slate-600/30" },
};

const TYPE_LABELS: Record<string, string> = {
  LESSON: "Lesson",
  BREAK: "Break",
  ASSEMBLY: "Assembly",
  LAB: "Practical Lab",
  SPORT: "Sports",
  FREE: "Free Period",
  LECTURE: "Lecture",
  TUTORIAL: "Tutorial",
  ACTIVITY: "Activity",
};

const DAY_LABELS: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
};

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI"];

function getTodayKey(): DayKey {
  const map: Record<number, DayKey> = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI" };
  return map[new Date().getDay()] ?? "MON";
}

function getPeriodIcon(type: Period["type"]) {
  switch (type) {
    case "ASSEMBLY":   return <Sun className="w-3.5 h-3.5" />;
    case "BREAK":      return <Coffee className="w-3.5 h-3.5" />;
    case "LAB":        return <Zap className="w-3.5 h-3.5" />;
    case "SPORT":      return <GraduationCap className="w-3.5 h-3.5" />;
    case "FREE":       return <Moon className="w-3.5 h-3.5" />;
    case "LECTURE":    return <BookOpen className="w-3.5 h-3.5" />;
    case "TUTORIAL":   return <Layers className="w-3.5 h-3.5" />;
    case "ACTIVITY":   return <Zap className="w-3.5 h-3.5" />;
    default:           return <BookOpen className="w-3.5 h-3.5" />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PeriodCard({ period, isNow }: { period: Period; isNow: boolean }) {
  const c = COLOR_MAP[period.color] ?? COLOR_MAP.slate;
  const isBreak = period.type === "BREAK" || period.type === "FREE";

  if (isBreak) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${c.border} ${c.bg} opacity-60`}>
        <Coffee className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-[11px] font-semibold text-slate-400">{period.subject}</span>
        <span className="text-[10px] text-slate-500 ml-auto font-mono shrink-0">{period.time} – {period.endTime}</span>
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl border ${c.border} ${c.bg} p-4 transition-all duration-200 ${isNow ? "ring-2 ring-indigo-500/60 shadow-lg shadow-indigo-950/30" : ""}`}>
      {isNow && (
        <div className="absolute -top-2 left-4 flex items-center gap-1 bg-indigo-600 text-white text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Now
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Time Column */}
          <div className="shrink-0 flex flex-col items-center gap-1 w-14 pt-0.5">
            <span className={`text-[11px] font-black font-mono ${c.text}`}>{period.time}</span>
            <div className={`w-0.5 h-4 rounded-full ${c.dot} opacity-40`} />
            <span className="text-[10px] font-mono text-slate-500">{period.endTime}</span>
          </div>

          {/* Subject Info */}
          <div className="min-w-0 space-y-1.5">
            <p className={`text-sm font-bold leading-tight ${c.text} truncate`}>{period.subject}</p>
            {period.teacher && (
              <div className="flex items-center gap-1 text-slate-400">
                <User className="w-3 h-3 shrink-0" />
                <span className="text-[11px] font-medium truncate">{period.teacher}</span>
              </div>
            )}
            {period.room && (
              <div className="flex items-center gap-1 text-slate-500">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="text-[11px] truncate">{period.room}</span>
              </div>
            )}
          </div>
        </div>

        {/* Type Badge */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${c.badge}`}>
            {getPeriodIcon(period.type)}
            <span className="hidden sm:inline">{TYPE_LABELS[period.type]}</span>
          </span>
          {period.units !== undefined && (
            <span className="text-[10px] text-slate-500 font-mono">{period.units} units</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject summary pill list for the sidebar
// ─────────────────────────────────────────────────────────────────────────────
function SubjectSummary({ schedule }: { schedule: WeekSchedule }) {
  const subjectMap = new Map<string, { color: string; count: number }>();
  Object.values(schedule).forEach((day) => {
    day.forEach((p) => {
      if (p.type !== "BREAK" && p.type !== "ASSEMBLY" && p.type !== "FREE") {
        const key = p.subject.split("–")[0].split("–")[0].trim();
        if (!subjectMap.has(key)) subjectMap.set(key, { color: p.color, count: 0 });
        subjectMap.get(key)!.count++;
      }
    });
  });

  const entries = Array.from(subjectMap.entries()).slice(0, 8);

  return (
    <div className="space-y-2">
      {entries.map(([subj, meta]) => {
        const c = COLOR_MAP[meta.color] ?? COLOR_MAP.slate;
        return (
          <div key={subj} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
            <span className="text-[11px] text-slate-300 truncate flex-1">{subj}</span>
            <span className="text-[10px] text-slate-500 font-mono shrink-0">{meta.count}×/wk</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function TimetableModule({ tierConfig, studentClass, studentName }: TimetableModuleProps) {
  const todayKey = getTodayKey();
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey);
  const [view, setView] = useState<"day" | "week">("day");

  const schedule = useMemo<WeekSchedule>(() => {
    if (tierConfig.category === "HIGHER_ED") return HIGHER_ED_TIMETABLE;
    if (tierConfig.category === "SECONDARY") return SECONDARY_TIMETABLE;
    return PRIMARY_TIMETABLE;
  }, [tierConfig.category]);

  const currentDay = schedule[selectedDay];

  const currentPeriodIndex = useMemo(() => {
    if (selectedDay !== todayKey) return -1;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return currentDay.findIndex((p) => {
      const [sh, sm] = p.time.split(":").map(Number);
      const [eh, em] = p.endTime.split(":").map(Number);
      return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
    });
  }, [selectedDay, currentDay, todayKey]);

  // Stats
  const totalLessons = Object.values(schedule).reduce((acc, day) =>
    acc + day.filter((p) => p.type !== "BREAK" && p.type !== "FREE" && p.type !== "ASSEMBLY").length, 0);
  const uniqueSubjects = new Set(
    Object.values(schedule).flatMap((day) =>
      day.filter((p) => p.type === "LESSON" || p.type === "LECTURE" || p.type === "LAB" || p.type === "TUTORIAL" || p.type === "ACTIVITY").map((p) => p.subject.split("–")[0].trim())
    )
  ).size;

  return (
    <div className="space-y-5 w-full">

      {/* Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 shadow-lg border border-indigo-800/40 relative overflow-hidden">
        <div className="hidden sm:block absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden sm:block absolute -bottom-10 left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Weekly Timetable</h2>
              <p className="text-[11px] text-indigo-300/80 font-medium mt-0.5">
                {tierConfig.category === "HIGHER_ED" ? "Semester Course Schedule" : "Term Class Schedule"} • {studentClass}
              </p>
            </div>
          </div>

          {/* Stats Pill Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-200">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">{uniqueSubjects} Subjects</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-200">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">{totalLessons} Periods/wk</span>
            </div>
            {/* View Toggle */}
            <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5 ml-1">
              <button
                type="button"
                onClick={() => setView("day")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${view === "day" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setView("week")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${view === "week" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
              >
                Week
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Day Selector Strip */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {DAY_KEYS.map((day) => {
          const isToday = day === todayKey;
          const isSelected = day === selectedDay;
          const daySchedule = schedule[day];
          const lessonCount = daySchedule.filter(p => p.type !== "BREAK" && p.type !== "FREE" && p.type !== "ASSEMBLY").length;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`flex-1 min-w-[72px] flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg transition-all duration-200 ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">{day}</span>
              <span className={`text-xs font-black ${isSelected ? "text-white" : ""}`}>
                {DAY_LABELS[day].slice(0, 3)}
              </span>
              <span className={`text-[9px] font-semibold px-1.5 rounded-full ${isSelected ? "bg-indigo-500/40 text-indigo-100" : "bg-slate-800 text-slate-500"}`}>
                {lessonCount} cls
              </span>
              {isToday && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ──── DAY VIEW ──── */}
      {view === "day" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">

          {/* Period List */}
          <div className="space-y-2.5">
            {/* Day Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">{DAY_LABELS[selectedDay]}</h3>
                {selectedDay === todayKey && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold">
                    Today
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    const idx = DAY_KEYS.indexOf(selectedDay);
                    if (idx > 0) setSelectedDay(DAY_KEYS[idx - 1]);
                  }}
                  disabled={selectedDay === "MON"}
                  className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idx = DAY_KEYS.indexOf(selectedDay);
                    if (idx < DAY_KEYS.length - 1) setSelectedDay(DAY_KEYS[idx + 1]);
                  }}
                  disabled={selectedDay === "FRI"}
                  className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {currentDay.map((period, idx) => (
              <PeriodCard key={idx} period={period} isNow={idx === currentPeriodIndex} />
            ))}
          </div>

          {/* Right Sidebar: Info Panel */}
          <div className="space-y-4">
            {/* Today's Highlight */}
            {currentPeriodIndex !== -1 && (
              <div className="bg-indigo-950/60 rounded-xl border border-indigo-500/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300">
                  <Clock className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Happening Now</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-auto" />
                </div>
                <p className="text-sm font-black text-white leading-tight">{currentDay[currentPeriodIndex].subject}</p>
                {currentDay[currentPeriodIndex].teacher && (
                  <p className="text-[11px] text-indigo-300">{currentDay[currentPeriodIndex].teacher}</p>
                )}
                {currentDay[currentPeriodIndex].room && (
                  <div className="flex items-center gap-1 text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[11px]">{currentDay[currentPeriodIndex].room}</span>
                  </div>
                )}
              </div>
            )}

            {/* Next Period */}
            {currentPeriodIndex !== -1 && currentPeriodIndex + 1 < currentDay.length && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Up Next</span>
                </div>
                <p className="text-sm font-bold text-slate-200">{currentDay[currentPeriodIndex + 1].subject}</p>
                <p className="text-[11px] text-slate-500 font-mono">{currentDay[currentPeriodIndex + 1].time} – {currentDay[currentPeriodIndex + 1].endTime}</p>
              </div>
            )}

            {/* Subject Summary */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-300">
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Weekly Subjects</span>
              </div>
              <SubjectSummary schedule={schedule} />
            </div>

            {/* Disclaimer Note */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Timetable is indicative and subject to change by class teacher or academic registry. Always check the school noticeboard for updates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ──── WEEK VIEW ──── */}
      {view === "week" && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800">
                <th className="w-24 p-3 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Time</span>
                </th>
                {DAY_KEYS.map((day) => (
                  <th key={day} className={`p-3 text-center border-l border-slate-800 ${day === todayKey ? "bg-indigo-950/40" : ""}`}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[11px] font-black ${day === selectedDay ? "text-indigo-300" : "text-slate-300"}`}>{DAY_LABELS[day]}</span>
                      {day === todayKey && <span className="text-[9px] text-emerald-400 font-bold">Today</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Collect all unique time slots */}
              {Array.from(new Set(
                Object.values(schedule).flatMap((d) => d.map((p) => p.time))
              )).sort().map((timeSlot, rowIdx) => (
                <tr key={timeSlot} className={`border-b border-slate-800/60 ${rowIdx % 2 === 0 ? "bg-slate-900/30" : "bg-slate-900/10"}`}>
                  <td className="p-3 text-[10px] font-mono text-slate-500 font-bold border-r border-slate-800 whitespace-nowrap">
                    {timeSlot}
                  </td>
                  {DAY_KEYS.map((day) => {
                    const period = schedule[day].find((p) => p.time === timeSlot);
                    if (!period) return (
                      <td key={day} className={`p-2 text-center border-l border-slate-800 ${day === todayKey ? "bg-indigo-950/10" : ""}`}>
                        <span className="text-slate-700 text-[10px]">–</span>
                      </td>
                    );
                    const c = COLOR_MAP[period.color] ?? COLOR_MAP.slate;
                    const isBreak = period.type === "BREAK" || period.type === "FREE" || period.type === "ASSEMBLY";
                    return (
                      <td key={day} className={`p-2 border-l border-slate-800 ${day === todayKey ? "bg-indigo-950/10" : ""}`}>
                        <div className={`rounded-lg px-2 py-1.5 ${isBreak ? "bg-slate-800/30 border border-slate-700/20" : `${c.bg} border ${c.border}`}`}>
                          <p className={`text-[10px] font-bold leading-tight truncate ${isBreak ? "text-slate-500" : c.text}`}>
                            {period.subject.length > 28 ? period.subject.substring(0, 28) + "…" : period.subject}
                          </p>
                          {!isBreak && period.room && (
                            <p className="text-[9px] text-slate-500 mt-0.5 truncate">{period.room}</p>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
