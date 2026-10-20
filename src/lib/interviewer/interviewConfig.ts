/**
 * Central configuration for Interview Timers, Deadlines, and Scoring Rubrics.
 * Mirrors backend/app/config/interview_config.py.
 */

// Total Interview Timer (40 minutes default)
export const TOTAL_INTERVIEW_DURATION_SECONDS = 40 * 60; // 2400 seconds

// Total Interview Warnings
export const TOTAL_WARNING_5MIN_SECONDS = 5 * 60; // 300 seconds (5 minutes)
export const TOTAL_WARNING_1MIN_SECONDS = 60;     // 60 seconds (1 minute)
export const TOTAL_WARNING_10SEC_SECONDS = 10;    // 10 seconds (final warning)

// Per-Question Answer Timer (90 seconds default)
export const PER_QUESTION_DURATION_SECONDS = 90; // 90 seconds

// Per-Question Warnings
export const QUESTION_WARNING_15SEC_SECONDS = 15;
export const QUESTION_WARNING_5SEC_SECONDS = 5;

// Answer Statuses
export type AnswerStatus = 'answered' | 'unanswered' | 'timed_out' | 'transcription_failed';

export const INSUFFICIENT_EVIDENCE_ASSESSMENT =
  'Insufficient evidence to assess technical ability. No valid answers were recorded.';
